import { apiJson } from "./client";
import type { AiConfig } from "@/stores/use-config-store";

export async function fetchSystemAiConfig() {
    return apiJson<{ config: AiConfig; updatedAt: string }>("/api/system/ai-config");
}

export async function saveSystemAiConfig(config: AiConfig) {
    return apiJson<{ config: AiConfig; updatedAt: string }>("/api/system/ai-config", {
        method: "PUT",
        body: JSON.stringify(config),
    });
}

export async function fetchChannelModelsFromServer(channelId: string) {
    return apiJson<{ models: string[] }>(`/api/ai/models?channelId=${encodeURIComponent(channelId)}`);
}
