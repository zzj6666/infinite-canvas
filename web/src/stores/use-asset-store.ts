import { create } from "zustand";

import { createAsset, deleteAsset, fetchAssets, updateAsset as updateAssetApi } from "@/services/api/assets-api";
import { mediaUrl } from "@/services/api/media-api";

export type AssetKind = "text" | "image" | "video";
export type TextAsset = AssetBase<"text"> & { data: { content: string } };
export type ImageAsset = AssetBase<"image"> & { data: { dataUrl: string; storageKey?: string; width: number; height: number; bytes: number; mimeType: string } };
export type VideoAsset = AssetBase<"video"> & { data: { url: string; storageKey?: string; width: number; height: number; bytes: number; mimeType: string } };
export type Asset = TextAsset | ImageAsset | VideoAsset;

type AssetBase<T extends AssetKind> = {
    id: string;
    kind: T;
    title: string;
    coverUrl: string;
    tags: string[];
    source?: string;
    note?: string;
    createdAt: string;
    updatedAt: string;
    metadata?: Record<string, unknown>;
};

type AssetStore = {
    hydrated: boolean;
    assets: Asset[];
    loadAssets: () => Promise<void>;
    addAsset: (asset: Omit<Asset, "id" | "createdAt" | "updatedAt">) => string;
    updateAsset: (id: string, patch: Partial<Omit<Asset, "id" | "createdAt">>) => void;
    removeAsset: (id: string) => void;
    cleanupImages: (extra?: unknown) => void;
    reset: () => void;
};

function hydrateAssetUrls(asset: Asset): Asset {
    if (asset.kind === "image" && asset.data.storageKey) {
        const url = mediaUrl(asset.data.storageKey);
        return {
            ...asset,
            coverUrl: asset.coverUrl?.startsWith("/api/media/") || asset.coverUrl?.startsWith("blob:") || !asset.coverUrl ? url : asset.coverUrl,
            data: { ...asset.data, dataUrl: url },
        };
    }
    if (asset.kind === "video" && asset.data.storageKey) {
        const url = mediaUrl(asset.data.storageKey);
        return { ...asset, data: { ...asset.data, url } };
    }
    return asset;
}

export const useAssetStore = create<AssetStore>((set, get) => ({
    hydrated: false,
    assets: [],
    reset: () => set({ assets: [], hydrated: false }),
    loadAssets: async () => {
        try {
            const result = await fetchAssets();
            set({ assets: result.assets.map(hydrateAssetUrls), hydrated: true });
        } catch (error) {
            console.error(error);
            set({ assets: [], hydrated: true });
        }
    },
    addAsset: (asset) => {
        const tempId = `tmp_${Date.now()}`;
        const now = new Date().toISOString();
        const optimistic = hydrateAssetUrls({ ...asset, id: tempId, createdAt: now, updatedAt: now } as Asset);
        set((state) => ({ assets: [optimistic, ...state.assets] }));
        void createAsset({ ...asset, title: asset.title })
            .then(({ asset: created }) => {
                set((state) => ({
                    assets: state.assets.map((item) => (item.id === tempId ? hydrateAssetUrls(created) : item)),
                }));
            })
            .catch((error) => {
                console.error(error);
                set((state) => ({ assets: state.assets.filter((item) => item.id !== tempId) }));
            });
        return tempId;
    },
    updateAsset: (id, patch) => {
        set((state) => ({
            assets: state.assets.map((asset) => (asset.id === id ? hydrateAssetUrls({ ...asset, ...patch, updatedAt: new Date().toISOString() } as Asset) : asset)),
        }));
        void updateAssetApi(id, patch as Partial<Asset>).catch((error) => console.error(error));
    },
    removeAsset: (id) => {
        set((state) => ({ assets: state.assets.filter((asset) => asset.id !== id) }));
        void deleteAsset(id).catch((error) => console.error(error));
    },
    cleanupImages: () => {
        // server-side GC not implemented in MVP
        void get;
    },
}));
