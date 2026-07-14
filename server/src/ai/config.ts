import { getSystemAiConfig } from "../routes/system-config";

export type ApiCallFormat = "openai" | "gemini" | "ark";

export type ModelChannel = {
    id: string;
    name: string;
    baseUrl: string;
    apiKey: string;
    apiFormat: ApiCallFormat;
    models: string[];
    enabled?: boolean;
};

export type SystemAiConfig = {
    channels: ModelChannel[];
    model: string;
    imageModel: string;
    videoModel: string;
    textModel: string;
    audioModel: string;
    audioVoice: string;
    audioFormat: string;
    audioSpeed: string;
    audioInstructions: string;
    videoSeconds: string;
    vquality: string;
    videoGenerateAudio: string;
    videoWatermark: string;
    systemPrompt: string;
    models: string[];
    imageModels: string[];
    videoModels: string[];
    textModels: string[];
    audioModels: string[];
    quality: string;
    size: string;
    count: string;
    canvasImageCount: string;
    apiKey?: string;
    baseUrl?: string;
    apiFormat?: ApiCallFormat;
};

const SEPARATOR = "::";

export function loadSystemConfig() {
    return getSystemAiConfig() as SystemAiConfig;
}

export function decodeChannelModel(value: string) {
    const index = value.indexOf(SEPARATOR);
    if (index <= 0) return { channelId: "", model: value };
    return { channelId: value.slice(0, index), model: value.slice(index + SEPARATOR.length) };
}

export function modelOptionName(value: string) {
    return decodeChannelModel(value).model;
}

export function resolveModelRequestConfig(config: SystemAiConfig, value: string) {
    const selected = value || config.imageModel || config.model || "";
    const { channelId, model } = decodeChannelModel(selected);
    const channels = Array.isArray(config.channels) ? config.channels : [];
    const selectedChannel = channels.find((item) => item.id === channelId);
    if (selectedChannel?.enabled === false) return { model, baseUrl: "", apiKey: "", apiFormat: selectedChannel.apiFormat || "openai", systemPrompt: config.systemPrompt || "", disabled: true };
    const channel = selectedChannel || channels.find((item) => item.enabled !== false);
    if (!channel) {
        return {
            model: modelOptionName(selected),
            baseUrl: String(config.baseUrl || ""),
            apiKey: String(config.apiKey || ""),
            apiFormat: (config.apiFormat || "openai") as ApiCallFormat,
            systemPrompt: config.systemPrompt || "",
        };
    }
    return {
        model: model || channel.models[0] || "",
        baseUrl: channel.baseUrl || "",
        apiKey: channel.apiKey || "",
        apiFormat: (channel.apiFormat || "openai") as ApiCallFormat,
        systemPrompt: config.systemPrompt || "",
    };
}

export function buildApiUrl(baseUrl: string, path: string) {
    const normalizedBase = baseUrl.trim().replace(/\/+$/, "");
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    if (/\/v1$/i.test(normalizedBase) || /\/api\/v3$/i.test(normalizedBase) || /\/api\/plan\/v3$/i.test(normalizedBase)) {
        return `${normalizedBase}${normalizedPath}`;
    }
    if (normalizedBase.includes("/v1/") || normalizedBase.endsWith("/v1")) return `${normalizedBase.replace(/\/v1.*/, "/v1")}${normalizedPath}`;
    return `${normalizedBase}/v1${normalizedPath}`;
}

export function assertProviderReady(request: { baseUrl: string; apiKey: string; model: string; disabled?: boolean }) {
    if (request.disabled) throw new Error("当前渠道已关闭");
    if (!request.model.trim()) throw new Error("请先在系统配置中选择模型");
    if (!request.baseUrl.trim()) throw new Error("请先由管理员配置 Base URL");
    if (!request.apiKey.trim()) throw new Error("请先由管理员配置 API Key");
}
