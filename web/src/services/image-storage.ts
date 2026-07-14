import { nanoid } from "nanoid";

import { readImageMeta } from "@/lib/image-utils";
import { mediaUrl, uploadMedia } from "@/services/api/media-api";

export type UploadedImage = {
    url: string;
    storageKey: string;
    thumbnailUrl?: string;
    thumbnailStorageKey?: string;
    width: number;
    height: number;
    bytes: number;
    mimeType: string;
};

export async function uploadImage(input: string | Blob, withThumbnail = false): Promise<UploadedImage> {
    const blob = typeof input === "string" ? await (await fetch(input)).blob() : input;
    const savedPromise = uploadMedia(blob, "image", `image-${nanoid()}.png`);
    const thumbnail = withThumbnail ? await createThumbnail(blob).catch(() => null) : null;
    const [saved, savedThumbnail] = await Promise.all([savedPromise, thumbnail ? uploadMedia(thumbnail.blob, "image-thumbnail", `thumbnail-${nanoid()}.webp`) : null]);
    const url = mediaUrl(saved.storageKey);
    const meta = thumbnail || (await readImageMeta(url));
    return {
        url,
        storageKey: saved.storageKey,
        thumbnailUrl: savedThumbnail ? mediaUrl(savedThumbnail.storageKey) : undefined,
        thumbnailStorageKey: savedThumbnail?.storageKey,
        width: meta.width,
        height: meta.height,
        bytes: saved.bytes,
        mimeType: saved.mimeType || meta.mimeType || blob.type || "image/png",
    };
}

async function createThumbnail(blob: Blob) {
    const url = URL.createObjectURL(blob);
    try {
        const image = new Image();
        await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () => reject(new Error("无法读取图片"));
            image.src = url;
        });
        const scale = Math.min(1, 960 / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.round(image.naturalWidth * scale);
        const height = Math.round(image.naturalHeight * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("无法生成图片缩略图");
        context.drawImage(image, 0, 0, width, height);
        const thumbnail = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.8));
        if (!thumbnail) throw new Error("无法生成图片缩略图");
        return { blob: thumbnail, width: image.naturalWidth, height: image.naturalHeight, mimeType: blob.type };
    } finally {
        URL.revokeObjectURL(url);
    }
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

function blobToDataUrl(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("读取图片失败"));
        reader.readAsDataURL(blob);
    });
}
