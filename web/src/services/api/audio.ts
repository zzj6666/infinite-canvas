import { audioMimeType, normalizeAudioFormatValue } from "@/lib/audio-generation";
import { uploadMediaFile, type UploadedFile } from "@/services/file-storage";
import type { AiConfig } from "@/stores/use-config-store";
import { apiFetch } from "./client";

type RequestOptions = { signal?: AbortSignal };

export async function requestAudioGeneration(config: AiConfig, prompt: string, options?: RequestOptions): Promise<Blob> {
    const format = normalizeAudioFormatValue(config.audioFormat);
    const response = await apiFetch("/api/ai/audio/speech", {
        method: "POST",
        body: JSON.stringify({
            model: config.model || config.audioModel,
            prompt,
            voice: config.audioVoice,
            format,
            speed: config.audioSpeed,
            instructions: config.audioInstructions,
        }),
        signal: options?.signal,
    });
    const blob = await response.blob();
    return blob.type.startsWith("audio/") ? blob : new Blob([blob], { type: audioMimeType(format) });
}

export async function storeGeneratedAudio(blob: Blob, format = "mp3"): Promise<UploadedFile> {
    const audio = blob.type.startsWith("audio/") ? blob : new Blob([blob], { type: audioMimeType(format) });
    return uploadMediaFile(audio, "audio");
}
