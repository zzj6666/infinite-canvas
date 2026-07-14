import localforage from "localforage";

const thumbnailStore = localforage.createInstance({ name: "infinite-canvas", storeName: "canvas_thumbnails" });
const pendingLoads = new Map<string, Promise<Blob>>();
const thumbnailCacheTtl = 7 * 24 * 60 * 60 * 1000;

type CachedThumbnail = { blob: Blob; expiresAt: number };

export async function cleanupExpiredThumbnails() {
    const expiredKeys: string[] = [];
    try {
        await thumbnailStore.iterate<CachedThumbnail, void>((value, key) => {
            if (!value?.expiresAt || value.expiresAt <= Date.now()) expiredKeys.push(key);
        });
        await Promise.all(expiredKeys.map((key) => thumbnailStore.removeItem(key)));
    } catch {
        // Browser cache cleanup must not affect canvas loading.
    }
}

export async function loadThumbnail(storageKey: string, url: string) {
    const cached = await thumbnailStore.getItem<CachedThumbnail>(storageKey).catch(() => null);
    if (cached && cached.expiresAt > Date.now()) return cached.blob;
    if (cached) void thumbnailStore.removeItem(storageKey);

    let pending = pendingLoads.get(storageKey);
    if (!pending) {
        pending = fetch(url, { credentials: "include" }).then(async (response) => {
            if (!response.ok) throw new Error("图片缩略图加载失败");
            const blob = await response.blob();
            await thumbnailStore.setItem(storageKey, { blob, expiresAt: Date.now() + thumbnailCacheTtl }).catch(() => undefined);
            return blob;
        });
        pendingLoads.set(storageKey, pending);
    }
    try {
        return await pending;
    } finally {
        pendingLoads.delete(storageKey);
    }
}
