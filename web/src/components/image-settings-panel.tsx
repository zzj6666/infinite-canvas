import { type ReactNode } from "react";
import { ConfigProvider } from "antd";

import { type CanvasTheme } from "@/lib/canvas-theme";
import { normalizeImageSizeForModel, presetImageSize, readPresetImageSize, resolveImageModelProfile } from "@/lib/image-model-profile";
import { modelOptionName, type AiConfig } from "@/stores/use-config-store";

const qualityOptions = [
    { value: "auto", label: "自动" },
    { value: "high", label: "高" },
    { value: "medium", label: "中" },
    { value: "low", label: "低" },
];
const DIMENSION_STEP = 16;
const resolutionOptions = [
    { value: "1k", label: "1K" },
    { value: "2k", label: "2K" },
    { value: "4k", label: "4K" },
] as const;
type ImageResolution = (typeof resolutionOptions)[number]["value"];

const aspectOptions: Array<{ value: string; label: string; width: number; height: number; sizes?: Record<ImageResolution, string> }> = [
    { value: "1:1", label: "1:1", width: 1024, height: 1024, sizes: { "1k": "1024x1024", "2k": "2048x2048", "4k": "2880x2880" } },
    { value: "3:2", label: "3:2", width: 1536, height: 1024, sizes: { "1k": "1536x1024", "2k": "2048x1360", "4k": "3520x2352" } },
    { value: "2:3", label: "2:3", width: 1024, height: 1536, sizes: { "1k": "1024x1536", "2k": "1360x2048", "4k": "2352x3520" } },
    { value: "4:3", label: "4:3", width: 1360, height: 1024, sizes: { "1k": "1360x1024", "2k": "2048x1536", "4k": "3312x2480" } },
    { value: "3:4", label: "3:4", width: 1024, height: 1360, sizes: { "1k": "1024x1360", "2k": "1536x2048", "4k": "2480x3312" } },
    { value: "16:9", label: "16:9", width: 1824, height: 1024, sizes: { "1k": "1824x1024", "2k": "2560x1440", "4k": "3840x2160" } },
    { value: "9:16", label: "9:16", width: 1024, height: 1824, sizes: { "1k": "1024x1824", "2k": "1440x2560", "4k": "2160x3840" } },
    { value: "auto", label: "自动", width: 0, height: 0 },
];

type ImageSettingsPanelProps = {
    config: AiConfig;
    onConfigChange: (key: "quality" | "size" | "count", value: string) => void;
    theme: CanvasTheme;
    showTitle?: boolean;
    className?: string;
};

export function ImageSettingsPanel({ config, onConfigChange, theme, showTitle = true, className = "w-[400px] space-y-5" }: ImageSettingsPanelProps) {
    const model = modelOptionName(config.model || config.imageModel);
    const profile = resolveImageModelProfile(model);
    const quality = config.quality || "auto";
    const count = Math.max(1, Math.min(4, Math.floor(Math.abs(Number(config.count)) || 1)));
    const activeSize = normalizeImageSizeForModel(model, config.size);
    const presetSize = readPresetImageSize(model, activeSize);
    const usesPresets = profile.family === "nano-banana" || profile.family === "seedream";
    const alignToStep = profile.family === "gpt-image";
    const inputDimensions = readSizeDimensions(activeSize, aspectOptions[0]);
    const selectedAspect = aspectOptions.find((item) => Object.values(item.sizes || {}).includes(activeSize) || item.value === activeSize) || closestAspect(inputDimensions.width, inputDimensions.height);
    const selectedResolution = resolutionOptions.find((item) => selectedAspect?.sizes?.[item.value] === activeSize)?.value || "1k";
    const dimensions = readSizeDimensions(activeSize, selectedAspect || aspectOptions[0]);
    const selectAspect = (value: string) => {
        const option = aspectOptions.find((item) => item.value === value);
        onConfigChange("size", option?.sizes?.[selectedResolution] || option?.value || "auto");
    };
    const selectResolution = (value: ImageResolution) => onConfigChange("size", selectedAspect?.sizes?.[value] || aspectOptions[0].sizes?.[value] || "1024x1024");
    const updateDimension = (key: "width" | "height", value: number | null) => {
        const next = Math.max(1, Math.floor(value || dimensions[key] || 1024));
        const width = key === "width" ? next : dimensions.width;
        const height = key === "height" ? next : dimensions.height;
        onConfigChange("size", `${alignDimension(width, alignToStep)}x${alignDimension(height, alignToStep)}`);
    };

    return (
        <ImageSettingsTheme theme={theme}>
            <div
                className={`${className} [&>section:first-of-type]:border-t-0 [&>section:first-of-type]:pt-0`}
                style={{ color: theme.node.text }}
                onMouseDown={(event) => {
                    event.stopPropagation();
                    if (event.target instanceof HTMLInputElement) return;
                    if (document.activeElement instanceof HTMLInputElement && event.currentTarget.contains(document.activeElement)) document.activeElement.blur();
                }}
            >
                {showTitle ? (
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="text-base font-semibold tracking-tight">图像设置</div>
                            <div className="mt-0.5 text-xs" style={{ color: theme.node.muted }}>
                                {profile.label}
                            </div>
                        </div>
                        <span className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium" style={{ background: theme.node.fill, color: theme.node.muted }}>
                            {usesPresets ? `${presetSize.resolution || "自动"} · ${presetSize.aspect}` : imageSizeLabel(activeSize)}
                        </span>
                    </div>
                ) : null}
                {usesPresets ? (
                    <>
                        {profile.resolutions.length ? (
                            <SettingSection title="输出分辨率" detail={presetSize.resolution} theme={theme}>
                                <div className={`grid gap-1.5 ${profile.resolutions.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
                                    {profile.resolutions.map((resolution) => (
                                        <OptionPill key={resolution} selected={presetSize.resolution === resolution} theme={theme} onClick={() => onConfigChange("size", presetImageSize(resolution, presetSize.aspect))}>
                                            {resolution}
                                        </OptionPill>
                                    ))}
                                </div>
                            </SettingSection>
                        ) : null}
                        <SettingSection title="宽高比" detail={presetSize.aspect} theme={theme}>
                            <div className={`grid gap-1.5 ${profile.aspects.length % 5 === 0 ? "grid-cols-5" : "grid-cols-4"}`}>
                                {profile.aspects.map((aspect) => (
                                    <AspectButton key={aspect} value={aspect} selected={presetSize.aspect === aspect} theme={theme} onClick={() => onConfigChange("size", presetImageSize(presetSize.resolution, aspect))} />
                                ))}
                            </div>
                        </SettingSection>
                    </>
                ) : (
                    <>
                        <SettingSection title="生成质量" detail={imageQualityLabel(quality)} theme={theme}>
                            <div className="grid grid-cols-4 gap-1.5">
                                {qualityOptions.map((item) => (
                                    <OptionPill key={item.value} selected={quality === item.value} theme={theme} onClick={() => onConfigChange("quality", item.value)}>
                                        {item.label}
                                    </OptionPill>
                                ))}
                            </div>
                        </SettingSection>
                        <SettingSection title="输出分辨率" detail={resolutionOptions.find((item) => item.value === selectedResolution)?.label || "1K"} theme={theme}>
                            <div className="grid grid-cols-3 gap-1.5">
                                {resolutionOptions.map((item) => (
                                    <OptionPill key={item.value} selected={selectedResolution === item.value} theme={theme} onClick={() => selectResolution(item.value)}>
                                        {item.label}
                                    </OptionPill>
                                ))}
                            </div>
                        </SettingSection>
                        <SettingSection title="像素尺寸" detail={activeSize === "auto" ? "自动" : `${dimensions.width} x ${dimensions.height}`} theme={theme}>
                            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                                <DimensionInput prefix="W" value={dimensions.width} disabled={activeSize === "auto"} theme={theme} alignToStep={alignToStep} onChange={(value) => updateDimension("width", value)} />
                                <span className="text-lg opacity-45">↔</span>
                                <DimensionInput prefix="H" value={dimensions.height} disabled={activeSize === "auto"} theme={theme} alignToStep={alignToStep} onChange={(value) => updateDimension("height", value)} />
                            </div>
                        </SettingSection>
                        <SettingSection title="宽高比" detail="构图" theme={theme}>
                            <div className="grid grid-cols-4 gap-1.5">
                                {aspectOptions.map((item) => (
                                    <AspectButton key={item.value} value={item.value} label={item.label} selected={selectedAspect?.value === item.value} theme={theme} onClick={() => selectAspect(item.value)} />
                                ))}
                            </div>
                        </SettingSection>
                    </>
                )}
                <SettingSection title="生成张数" detail={`${count} 张`} theme={theme}>
                    <div className="grid grid-cols-4 gap-1.5">
                        {Array.from({ length: 4 }, (_, index) => index + 1).map((value) => (
                            <OptionPill key={value} selected={count === value} theme={theme} onClick={() => onConfigChange("count", String(value))}>
                                {value}
                            </OptionPill>
                        ))}
                    </div>
                </SettingSection>
            </div>
        </ImageSettingsTheme>
    );
}

export function ImageSettingsTheme({ theme, children }: { theme: CanvasTheme; children: ReactNode }) {
    return (
        <ConfigProvider
            theme={{
                token: { colorBgContainer: theme.toolbar.panel, colorBgElevated: theme.toolbar.panel, colorBorder: theme.node.stroke, colorPrimary: theme.node.activeStroke, colorText: theme.node.text, colorTextLightSolid: theme.node.panel },
                components: { Button: { defaultBg: theme.toolbar.panel, defaultBorderColor: theme.node.stroke, defaultColor: theme.node.text } },
            }}
        >
            {children}
        </ConfigProvider>
    );
}

export function imageQualityLabel(value: string) {
    return ({ auto: "自动", high: "高", medium: "中", low: "低" } as Record<string, string>)[value] || value;
}

export function imageSizeLabel(size: string) {
    return aspectOptions.find((item) => Object.values(item.sizes || {}).includes(size) || item.value === size)?.label || size;
}

export function imageSettingsSummary(config: AiConfig) {
    const model = modelOptionName(config.model || config.imageModel);
    const profile = resolveImageModelProfile(model);
    const count = Math.max(1, Math.min(4, Math.floor(Math.abs(Number(config.count)) || 1)));
    if (profile.family === "nano-banana" || profile.family === "seedream") {
        const size = readPresetImageSize(model, config.size);
        return `${size.resolution ? `${size.resolution} · ` : ""}${size.aspect} · ${count} 张`;
    }
    return `${imageQualityLabel(config.quality || "auto")} · ${imageSizeLabel(normalizeImageSizeForModel(model, config.size))} · ${count} 张`;
}

function OptionPill({ selected, theme, onClick, children }: { selected: boolean; theme: CanvasTheme; onClick: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            className="h-8 cursor-pointer rounded-lg border px-2 text-xs font-medium transition hover:opacity-80"
            style={{ background: selected ? theme.toolbar.activeBg : "transparent", borderColor: selected ? theme.node.activeStroke : theme.node.stroke, color: selected ? theme.toolbar.activeText : theme.node.text }}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

function AspectButton({ value, label = value, selected, theme, onClick }: { value: string; label?: string; selected: boolean; theme: CanvasTheme; onClick: () => void }) {
    return (
        <button
            type="button"
            className="flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-1.5 text-xs font-medium transition hover:opacity-80"
            style={{ background: selected ? theme.toolbar.activeBg : "transparent", borderColor: selected ? theme.node.activeStroke : theme.node.stroke, color: selected ? theme.toolbar.activeText : theme.node.text }}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={onClick}
        >
            <AspectPreview value={value} color={selected ? theme.toolbar.activeText : theme.node.muted} />
            <span>{label}</span>
        </button>
    );
}

function AspectPreview({ value, color }: { value: string; color: string }) {
    if (value === "auto") return <span className="h-3.5 w-5 rounded-[2px] border border-dashed" style={{ borderColor: color }} />;
    const [width, height] = value.split(":").map(Number);
    const longSide = Math.max(width || 1, height || 1);
    return <span className="shrink-0 rounded-[2px] border" style={{ width: Math.max(3, Math.round(((width || 1) / longSide) * 20)), height: Math.max(3, Math.round(((height || 1) / longSide) * 20)), borderColor: color }} />;
}

function DimensionInput({ prefix, value, disabled, theme, alignToStep, onChange }: { prefix: string; value: number; disabled: boolean; theme: CanvasTheme; alignToStep: boolean; onChange: (value: number | null) => void }) {
    const commit = (input: HTMLInputElement) => {
        const next = alignDimension(Math.max(1, Math.floor(Number(input.value) || value || 1024)), alignToStep);
        input.value = String(next);
        onChange(next);
    };

    return (
        <label className="flex h-10 overflow-hidden rounded-lg border text-sm" style={{ borderColor: theme.node.stroke, background: theme.node.fill, color: theme.node.text, opacity: disabled ? 0.55 : 1 }}>
            <span className="grid w-9 place-items-center border-r text-xs font-medium" style={{ borderColor: theme.node.stroke, color: theme.node.muted }}>
                {prefix}
            </span>
            <input
                type="number"
                min={1}
                disabled={disabled}
                className="min-w-0 flex-1 bg-transparent px-2 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                defaultValue={value || ""}
                key={`${prefix}-${value}`}
                onBlur={(event) => commit(event.currentTarget)}
                onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                }}
                onMouseDown={(event) => event.stopPropagation()}
            />
        </label>
    );
}

function SettingSection({ title, detail, theme, children }: { title: string; detail: string; theme: CanvasTheme; children: ReactNode }) {
    return (
        <section className="space-y-2.5 border-t pt-4 first:border-t-0 first:pt-0" style={{ borderColor: theme.node.stroke }}>
            <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold tracking-wide" style={{ color: theme.node.muted }}>
                    {title}
                </div>
                <div className="text-[11px]" style={{ color: theme.node.faint }}>
                    {detail}
                </div>
            </div>
            {children}
        </section>
    );
}

function readSizeDimensions(size: string, fallback: { width: number; height: number }) {
    const match = size?.match(/^(\d+)x(\d+)$/);
    return {
        width: match ? Number(match[1]) : fallback.width,
        height: match ? Number(match[2]) : fallback.height,
    };
}

function closestAspect(width: number, height: number) {
    if (!width || !height) return undefined;
    const ratio = width / height;
    return aspectOptions.filter((item) => item.sizes).reduce<(typeof aspectOptions)[number] | undefined>((closest, item) => (!closest || Math.abs(item.width / item.height - ratio) < Math.abs(closest.width / closest.height - ratio) ? item : closest), undefined);
}

function alignDimension(value: number, enabled: boolean) {
    return enabled ? Math.ceil(value / DIMENSION_STEP) * DIMENSION_STEP : value;
}
