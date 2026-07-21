import { modelOptionName } from "@/stores/use-config-store";

export type ImageModelProfile = {
    family: "gpt-image" | "nano-banana" | "seedream" | "generic";
    label: string;
    resolutions: readonly string[];
    aspects: readonly string[];
    referenceLimit: number;
};

const commonGeminiAspects = ["1:1", "3:2", "2:3", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];

export function resolveImageModelProfile(model: string): ImageModelProfile {
    const value = modelOptionName(model).toLowerCase();
    if (value.includes("gpt-image-gemini-3-flash") || value.includes("gemini-3.1-flash-image")) {
        return {
            family: "nano-banana",
            label: "Nano Banana 2",
            resolutions: ["512", "1K", "2K", "4K"],
            aspects: [...commonGeminiAspects, "1:4", "4:1", "1:8", "8:1", "9:21"],
            referenceLimit: 14,
        };
    }
    if (value.includes("gpt-image-gemini-3-pro") || value.includes("gemini-3-pro-image")) {
        return {
            family: "nano-banana",
            label: "Nano Banana Pro",
            resolutions: ["1K", "2K", "4K"],
            aspects: commonGeminiAspects,
            referenceLimit: 14,
        };
    }
    if (value.includes("gemini-2.5-flash-image")) {
        return {
            family: "nano-banana",
            label: "Nano Banana",
            resolutions: [],
            aspects: commonGeminiAspects,
            referenceLimit: 3,
        };
    }
    if (value.includes("seedream-5.0-lite") || value.includes("seedream-5-0-lite")) {
        return {
            family: "seedream",
            label: "Seedream 5.0 Lite",
            resolutions: ["2K", "3K", "4K"],
            aspects: ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "21:9"],
            referenceLimit: 14,
        };
    }
    if (value.startsWith("gpt-image-2") || /(?:^|[^a-z0-9])image[-_ ]?2(?:$|[^a-z0-9])/.test(value)) {
        return { family: "gpt-image", label: "GPT Image 2", resolutions: ["1K", "2K", "4K"], aspects: [], referenceLimit: 16 };
    }
    return { family: "generic", label: "通用图片模型", resolutions: ["1K", "2K", "4K"], aspects: [], referenceLimit: Number.POSITIVE_INFINITY };
}

export function readPresetImageSize(model: string, size: string) {
    const profile = resolveImageModelProfile(model);
    const match = size.match(/^(512|1K|2K|3K|4K)@(\d+:\d+)$/i);
    const defaultResolution = profile.resolutions.includes("1K") ? "1K" : profile.resolutions[0] || "";
    const resolution = match?.[1].toUpperCase() || defaultResolution;
    const aspect = match?.[2] || (/^\d+:\d+$/.test(size) ? size : "") || profile.aspects[0] || "1:1";
    return {
        resolution: profile.resolutions.includes(resolution) ? resolution : defaultResolution,
        aspect: profile.aspects.includes(aspect) ? aspect : profile.aspects[0] || "1:1",
    };
}

export function presetImageSize(resolution: string, aspect: string) {
    return resolution ? `${resolution}@${aspect}` : aspect;
}

export function normalizeImageSizeForModel(model: string, size: string) {
    const profile = resolveImageModelProfile(model);
    if (profile.family === "nano-banana" || profile.family === "seedream") {
        const value = readPresetImageSize(model, size);
        return presetImageSize(value.resolution, value.aspect);
    }
    if (/^(512|1K|2K|3K|4K)@\d+:\d+$/i.test(size)) return "1024x1024";
    if (profile.family === "gpt-image" && /^\d+:\d+$/.test(size) && !["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"].includes(size)) return "1024x1024";
    return size || "auto";
}
