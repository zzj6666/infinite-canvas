import { dataUrlToFile } from "@/lib/image-utils";
import { normalizeImageSizeForModel, resolveImageModelProfile } from "@/lib/image-model-profile";
import { buildImageReferencePromptText } from "@/lib/image-reference-prompt";
import { imageToDataUrl } from "@/services/image-storage";
import type { ReferenceImage } from "@/types/image";
import { type AiConfig, type ModelChannel } from "@/stores/use-config-store";
import { apiJson } from "./client";

export type AiTextMessage = {
    role: "system" | "user" | "assistant";
    content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
};

type RequestOptions = { signal?: AbortSignal };

type GeneratedImage = { id: string; dataUrl: string };

export async function requestGeneration(config: AiConfig, prompt: string, options?: RequestOptions) {
    const model = config.model || config.imageModel;
    const profile = resolveImageModelProfile(model);
    const usesPresets = profile.family === "nano-banana" || profile.family === "seedream";
    const result = await apiJson<{ images: GeneratedImage[] }>("/api/ai/images/generations", {
        method: "POST",
        body: JSON.stringify({
            model,
            prompt,
            count: config.count,
            ...(usesPresets ? {} : { quality: config.quality }),
            size: normalizeImageSizeForModel(model, config.size),
        }),
        signal: options?.signal,
    });
    return result.images;
}

export async function requestEdit(config: AiConfig, prompt: string, references: ReferenceImage[], mask?: ReferenceImage, options?: RequestOptions) {
    const model = config.model || config.imageModel;
    const profile = resolveImageModelProfile(model);
    const usesPresets = profile.family === "nano-banana" || profile.family === "seedream";
    if (references.length > profile.referenceLimit) throw new Error(`${profile.label} 最多支持 ${profile.referenceLimit} 张参考图`);
    const requestPrompt = buildImageReferencePromptText(prompt, references);
    const formData = new FormData();
    formData.set("model", model || "");
    formData.set("prompt", requestPrompt);
    formData.set("n", String(Math.max(1, Math.min(4, Math.floor(Math.abs(Number(config.count)) || 1)))));
    if (!usesPresets && config.quality) formData.set("quality", config.quality);
    formData.set("size", normalizeImageSizeForModel(model, config.size));
    const files = await Promise.all(references.map(async (image) => dataUrlToFile({ ...image, dataUrl: await imageToDataUrl(image) })));
    files.forEach((file) => formData.append("image", file));
    if (mask) formData.set("mask", dataUrlToFile(mask));

    const result = await apiJson<{ images: GeneratedImage[] }>("/api/ai/images/edits", {
        method: "POST",
        body: formData,
        signal: options?.signal,
    });
    return result.images;
}

export async function requestImageQuestion(config: AiConfig, messages: AiTextMessage[], onDelta: (text: string) => void, options?: RequestOptions) {
    const result = await apiJson<{ content: string }>("/api/ai/responses", {
        method: "POST",
        body: JSON.stringify({
            model: config.model || config.textModel,
            messages,
        }),
        signal: options?.signal,
    });
    const content = result.content || "没有返回内容";
    onDelta(content);
    return content;
}

export async function fetchChannelModels(channel: ModelChannel) {
    const { fetchChannelModelsFromServer } = await import("./system-config");
    const result = await fetchChannelModelsFromServer(channel);
    return result.models;
}
