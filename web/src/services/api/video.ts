import { dataUrlToFile } from "@/lib/image-utils";
import { isSeedanceVideoConfig, normalizeSeedanceDuration, normalizeSeedanceRatio, normalizeSeedanceResolution, seedanceVideoReferenceError, boolConfig } from "@/lib/seedance-video";
import { uploadMediaFile, type UploadedFile } from "@/services/file-storage";
import { imageToDataUrl } from "@/services/image-storage";
import { modelOptionName, resolveModelRequestConfig, type AiConfig } from "@/stores/use-config-store";
import type { ReferenceImage } from "@/types/image";
import type { ReferenceAudio, ReferenceVideo } from "@/types/media";
import { apiFetch, apiJson } from "./client";

type RequestOptions = { signal?: AbortSignal };
export type VideoGenerationResult = { blob?: Blob; url?: string; mimeType?: string };
export type VideoGenerationTask = { id: string; provider: "openai" | "seedance"; model: string };
export type VideoGenerationTaskState = { status: "pending" } | { status: "completed"; result: VideoGenerationResult } | { status: "failed"; error: string };

export async function requestVideoGeneration(config: AiConfig, prompt: string, references: ReferenceImage[] = [], videoReferences: ReferenceVideo[] = [], audioReferences: ReferenceAudio[] = [], options?: RequestOptions): Promise<VideoGenerationResult> {
    const task = await createVideoGenerationTask(config, prompt, references, videoReferences, audioReferences, options);
    const delayMs = task.provider === "seedance" ? 5000 : 2500;
    for (let attempt = 0; attempt < 120; attempt += 1) {
        if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const state = await pollVideoGenerationTask(config, task, options);
        if (state.status === "completed") return state.result;
        if (state.status === "failed") throw new Error(state.error);
        if (attempt === 119) throw new Error("视频生成超时，请稍后重试");
        await delay(delayMs, options?.signal);
    }
    throw new Error("视频生成超时，请稍后重试");
}

export async function createVideoGenerationTask(config: AiConfig, prompt: string, references: ReferenceImage[] = [], videoReferences: ReferenceVideo[] = [], audioReferences: ReferenceAudio[] = [], options?: RequestOptions): Promise<VideoGenerationTask> {
    const selectedModel = (config.model || config.videoModel).trim();
    const requestConfig = resolveModelRequestConfig(config, selectedModel);
    if (isSeedanceVideoConfig(requestConfig)) {
        if (audioReferences.length && !references.length && !videoReferences.length) {
            throw new Error("Seedance 参考音频不能单独使用，请同时添加参考图或参考视频");
        }
        const error = seedanceVideoReferenceError(videoReferences);
        if (error) throw new Error(error);
        const content: Array<Record<string, unknown>> = [];
        if (prompt.trim()) content.push({ type: "text", text: prompt });
        for (const image of references) {
            const url = image.storageKey ? `media://${encodeURIComponent(image.storageKey)}` : await imageToDataUrl(image);
            if (url) content.push({ type: "image_url", image_url: { url }, role: "reference_image" });
        }
        for (const video of videoReferences) {
            const url = video.storageKey ? `media://${encodeURIComponent(video.storageKey)}` : video.url;
            if (url) content.push({ type: "video_url", video_url: { url }, role: "reference_video" });
        }
        for (const audio of audioReferences) {
            const url = audio.storageKey ? `media://${encodeURIComponent(audio.storageKey)}` : audio.url;
            if (url) content.push({ type: "audio_url", audio_url: { url }, role: "reference_audio" });
        }
        const payload = {
            model: selectedModel,
            content,
            ratio: normalizeSeedanceRatio(config.size),
            resolution: normalizeSeedanceResolution(config.vquality, modelOptionName(selectedModel)),
            duration: normalizeSeedanceDuration(config.videoSeconds),
            generate_audio: boolConfig(config.videoGenerateAudio, true),
            watermark: boolConfig(config.videoWatermark, false),
        };
        const created = await apiJson<any>("/api/ai/videos", {
            method: "POST",
            body: JSON.stringify(payload),
            signal: options?.signal,
        });
        const id = created.id || created.data?.id;
        if (!id) throw new Error("视频接口没有返回任务 ID");
        return { id, provider: "seedance", model: selectedModel };
    }

    if (videoReferences.length || audioReferences.length) {
        throw new Error("当前视频接口不支持参考视频或参考音频，请切换到 Seedance 2.0 / 火山 Agent Plan 模型，或移除参考素材");
    }

    const body = new FormData();
    body.append("model", selectedModel);
    body.append("prompt", prompt);
    body.append("seconds", config.videoSeconds || "6");
    if (config.size) body.append("size", config.size);
    body.append("resolution_name", config.vquality || "720");
    body.append("preset", "normal");
    const files = await Promise.all(references.slice(0, 7).map(async (image) => dataUrlToFile({ ...image, dataUrl: await imageToDataUrl(image) })));
    files.forEach((file) => body.append("input_reference[]", file));
    const created = await apiJson<any>("/api/ai/videos", {
        method: "POST",
        body,
        signal: options?.signal,
    });
    const id = created.id || created.data?.id;
    if (!id) throw new Error("视频接口没有返回任务 ID");
    return { id, provider: "openai", model: selectedModel };
}

export async function pollVideoGenerationTask(config: AiConfig, task: VideoGenerationTask, options?: RequestOptions): Promise<VideoGenerationTaskState> {
    const data = await apiJson<any>(`/api/ai/videos/${encodeURIComponent(task.id)}?model=${encodeURIComponent(task.model)}&provider=${task.provider}`, {
        signal: options?.signal,
    });
    const payload = data.data || data;
    const url = payload.url || payload.result_url || payload.video_url || payload.content?.video_url || payload.content?.url;
    if (url) return { status: "completed", result: { url } };

    const status = String(payload.status || "").toLowerCase();
    if (task.provider === "openai" && status === "completed") {
        const response = await apiFetch(`/api/ai/videos/${encodeURIComponent(task.id)}/content?model=${encodeURIComponent(task.model)}`, { signal: options?.signal });
        const blob = await response.blob();
        return { status: "completed", result: { blob } };
    }
    if (["failed", "cancelled", "expired"].includes(status)) {
        return { status: "failed", error: payload.error?.message || payload.msg || "视频生成失败" };
    }
    if (task.provider === "seedance" && (status === "succeeded" || status === "completed") && !url) {
        return { status: "failed", error: "任务成功但没有返回视频 URL" };
    }
    return { status: "pending" };
}

export async function storeGeneratedVideo(result: VideoGenerationResult): Promise<UploadedFile> {
    if (result.blob) return uploadMediaFile(result.blob, "video");
    if (result.url) {
        try {
            return await uploadMediaFile(result.url, "video");
        } catch {
            return { url: result.url, storageKey: "", bytes: 0, mimeType: result.mimeType || "video/mp4" };
        }
    }
    throw new Error("没有可保存的视频");
}

function delay(ms: number, signal?: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
        if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
        const timer = setTimeout(() => {
            signal?.removeEventListener("abort", onAbort);
            resolve();
        }, ms);
        const onAbort = () => {
            clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
        };
        signal?.addEventListener("abort", onAbort, { once: true });
    });
}
