import { nanoid } from "nanoid";

import { dataUrlToFile } from "@/lib/image-utils";
import { buildImageReferencePromptText } from "@/lib/image-reference-prompt";
import { imageToDataUrl } from "@/services/image-storage";
import type { ReferenceImage } from "@/types/image";
import { modelOptionName, type AiConfig, type ModelChannel } from "@/stores/use-config-store";
import { apiFetch, apiJson } from "./client";

export type AiTextMessage = {
    role: "system" | "user" | "assistant";
    content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
};

type RequestOptions = { signal?: AbortSignal };

type GeneratedImage = { id: string; dataUrl: string };

export async function requestGeneration(config: AiConfig, prompt: string, options?: RequestOptions) {
    const result = await apiJson<{ images: GeneratedImage[] }>("/api/ai/images/generations", {
        method: "POST",
        body: JSON.stringify({
            model: config.model || config.imageModel,
            prompt,
            count: config.count,
            quality: config.quality,
            size: config.size,
        }),
        signal: options?.signal,
    });
    return result.images;
}

export async function requestEdit(config: AiConfig, prompt: string, references: ReferenceImage[], mask?: ReferenceImage, options?: RequestOptions) {
    if (modelOptionName(config.model || config.imageModel).toLowerCase() === "gpt-image-2" && references.length > 16) throw new Error("gpt-image-2 最多支持 16 张参考图");
    const requestPrompt = buildImageReferencePromptText(prompt, references);
    const formData = new FormData();
    formData.set("model", config.model || config.imageModel || "");
    formData.set("prompt", requestPrompt);
    formData.set("n", String(Math.max(1, Math.min(4, Math.floor(Math.abs(Number(config.count)) || 1)))));
    if (config.quality) formData.set("quality", config.quality);
    if (config.size) formData.set("size", config.size);
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

export async function fetchImageModels(config: Pick<AiConfig, "baseUrl" | "apiKey" | "apiFormat">) {
    // Prefer server-side model listing when channel id is available via admin UI.
    void config;
    throw new Error("请在配置页通过服务端拉取模型");
}

export async function fetchChannelModels(channel: ModelChannel) {
    const { fetchChannelModelsFromServer } = await import("./system-config");
    const result = await fetchChannelModelsFromServer(channel.id);
    return result.models;
}

// Keep helper for any remaining call sites expecting generated image ids.
export function createGeneratedImageId() {
    return nanoid();
}
