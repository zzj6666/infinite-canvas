import { apiFetch, apiJson } from "./client";

export async function uploadMedia(file: Blob, prefix = "file", filename = "upload.bin", storageKey?: string) {
    const form = new FormData();
    form.set("file", file instanceof File ? file : new File([file], filename, { type: file.type || "application/octet-stream" }));
    form.set("prefix", prefix);
    if (storageKey) form.set("storageKey", storageKey);
    return apiJson<{ storageKey: string; url: string; bytes: number; mimeType: string }>("/api/media", {
        method: "POST",
        body: form,
    });
}

export function mediaUrl(storageKey: string) {
    return `/api/media/${encodeURIComponent(storageKey)}`;
}

export async function deleteMedia(storageKey: string) {
    return apiJson<{ ok: boolean }>(mediaUrl(storageKey), { method: "DELETE" });
}

export async function fetchMediaBlob(storageKey: string) {
    const response = await apiFetch(mediaUrl(storageKey));
    return response.blob();
}
