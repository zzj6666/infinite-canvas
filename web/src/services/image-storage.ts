import { nanoid } from "nanoid";

import { readImageMeta } from "@/lib/image-utils";
import { mediaUrl, uploadMedia } from "@/services/api/media-api";

export type UploadedImage = {
    url: string;
    storageKey: string;
    width: number;
    height: number;
    bytes: number;
    mimeType: string;
};

export async function uploadImage(input: string | Blob): Promise<UploadedImage> {
    const blob = typeof input === "string" ? await (await fetch(input)).blob() : input;
    const saved = await uploadMedia(blob, "image", `image-${nanoid()}.png`);
    const url = mediaUrl(saved.storageKey);
    const meta = await readImageMeta(url);
    return {
        url,
        storageKey: saved.storageKey,
        width: meta.width,
        height: meta.height,
        bytes: saved.bytes,
        mimeType: saved.mimeType || meta.mimeType || blob.type || "image/png",
    };
}

export async function resolveImageUrl(storageKey?: string, fallback = "") {
    if (!storageKey) return fallback;
    return mediaUrl(storageKey);
}

export async function getImageBlob(storageKey: string) {
    const response = await fetch(mediaUrl(storageKey), { credentials: "include" });
    if (!response.ok) return null;
    return response.blob();
}

export async function setImageBlob(storageKey: string, blob: Blob) {
    const saved = await uploadMedia(blob, "image", storageKey, storageKey);
    return mediaUrl(saved.storageKey);
}

export async function imageToDataUrl(image: { url?: string; dataUrl?: string; storageKey?: string }) {
    if (image.dataUrl?.startsWith("data:")) return image.dataUrl;
    const url = image.dataUrl || (image.storageKey ? mediaUrl(image.storageKey) : image.url || "");
    if (!url) return "";
    if (url.startsWith("data:")) return url;
    const blob = await (await fetch(url, { credentials: "include" })).blob();
    return blobToDataUrl(blob);
}

export async function deleteStoredImages(_keys: Iterable<string>) {
    // MVP: keep media files; orphan cleanup can be added later.
}

export async function cleanupUnusedImages(_args?: unknown) {
    // no-op in server mode
}

export function collectImageStorageKeys(value: unknown, keys = new Set<string>()) {
    if (!value || typeof value !== "object") return keys;
    if ("storageKey" in value && typeof value.storageKey === "string" && value.storageKey.startsWith("image:")) keys.add(value.storageKey);
    Object.values(value).forEach((item) => (Array.isArray(item) ? item.forEach((child) => collectImageStorageKeys(child, keys)) : collectImageStorageKeys(item, keys)));
    return keys;
}

function blobToDataUrl(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("读取图片失败"));
        reader.readAsDataURL(blob);
    });
}
