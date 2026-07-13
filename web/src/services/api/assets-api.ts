import { apiJson } from "./client";
import type { Asset } from "@/stores/use-asset-store";

export async function fetchAssets() {
    return apiJson<{ assets: Asset[] }>("/api/assets");
}

export async function createAsset(asset: Partial<Asset> & { kind: Asset["kind"]; title: string }) {
    return apiJson<{ asset: Asset }>("/api/assets", {
        method: "POST",
        body: JSON.stringify(asset),
    });
}

export async function updateAsset(id: string, patch: Partial<Asset>) {
    return apiJson<{ asset: Asset }>(`/api/assets/${id}`, {
        method: "PUT",
        body: JSON.stringify(patch),
    });
}

export async function deleteAsset(id: string) {
    return apiJson<{ ok: boolean }>(`/api/assets/${id}`, { method: "DELETE" });
}

export async function replaceAssets(assets: Asset[]) {
    return apiJson<{ assets: Asset[] }>("/api/assets/replace", {
        method: "POST",
        body: JSON.stringify({ assets }),
    });
}
