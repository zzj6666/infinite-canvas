import { apiJson } from "./client";
import type { AiConfig, ModelChannel } from "@/stores/use-config-store";

export async function fetchSystemAiConfig() {
    return apiJson<{ config: AiConfig; updatedAt: string }>("/api/system/ai-config");
}

export async function saveSystemAiConfig(config: AiConfig) {
    return apiJson<{ config: AiConfig; updatedAt: string }>("/api/system/ai-config", {
        method: "PUT",
        body: JSON.stringify(config),
    });
}

export async function fetchChannelModelsFromServer(channel: ModelChannel) {
    return apiJson<{ models: string[] }>("/api/ai/models", {
        method: "POST",
        body: JSON.stringify({ baseUrl: channel.baseUrl, apiKey: channel.apiKey, apiFormat: channel.apiFormat }),
    });
}
