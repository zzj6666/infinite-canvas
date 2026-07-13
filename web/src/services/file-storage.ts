import { nanoid } from "nanoid";

import { mediaUrl, uploadMedia } from "@/services/api/media-api";

export type UploadedFile = { url: string; storageKey: string; bytes: number; mimeType: string; width?: number; height?: number; durationMs?: number };

export async function uploadMediaFile(input: string | Blob, prefix = "file"): Promise<UploadedFile> {
    const blob = typeof input === "string" ? await (await fetch(input)).blob() : input;
    const saved = await uploadMedia(blob, prefix, `${prefix}-${nanoid()}`);
    const url = mediaUrl(saved.storageKey);
    const meta = blob.type.startsWith("video/") ? await readVideoMeta(url) : blob.type.startsWith("audio/") ? await readAudioMeta(url) : {};
    return {
        url,
        storageKey: saved.storageKey,
        bytes: saved.bytes,
        mimeType: saved.mimeType || blob.type || "application/octet-stream",
        ...meta,
    };
}

export async function resolveMediaUrl(storageKey?: string, fallback = "") {
    if (!storageKey) return fallback;
    return mediaUrl(storageKey);
}

export async function getMediaBlob(storageKey: string) {
    const response = await fetch(mediaUrl(storageKey), { credentials: "include" });
    if (!response.ok) return null;
    return response.blob();
}

export async function setMediaBlob(storageKey: string, blob: Blob) {
    const prefix = storageKey.includes(":") ? storageKey.split(":")[0] : "file";
    const saved = await uploadMedia(blob, prefix, storageKey, storageKey);
    return mediaUrl(saved.storageKey);
}

export async function deleteStoredMedia(_keys: Iterable<string>) {
    // no-op in MVP
}

export async function cleanupUnusedMedia(_args?: unknown) {
    // no-op in MVP
}

export function collectMediaStorageKeys(value: unknown, keys = new Set<string>()) {
    if (!value || typeof value !== "object") return keys;
    if ("storageKey" in value && typeof value.storageKey === "string" && value.storageKey.includes(":")) keys.add(value.storageKey);
    Object.values(value).forEach((item) => (Array.isArray(item) ? item.forEach((child) => collectMediaStorageKeys(child, keys)) : collectMediaStorageKeys(item, keys)));
    return keys;
}

function readVideoMeta(url: string) {
    return new Promise<{ width: number; height: number; durationMs?: number }>((resolve) => {
        const video = document.createElement("video");
        const done = () => resolve({ width: video.videoWidth || 1280, height: video.videoHeight || 720, durationMs: Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : undefined });
        video.onloadedmetadata = done;
        video.onerror = done;
        video.src = url;
    });
}

function readAudioMeta(url: string) {
    return new Promise<{ durationMs?: number }>((resolve) => {
        const audio = document.createElement("audio");
        const done = () => resolve({ durationMs: Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : undefined });
        audio.onloadedmetadata = done;
        audio.onerror = done;
        audio.src = url;
    });
}
