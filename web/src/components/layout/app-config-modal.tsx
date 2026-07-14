import { App, Button, Form, Input, Modal, Select, Switch, Tabs } from "antd";
import { ChevronDown, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { ModelPicker } from "@/components/model-picker";
import { fetchChannelModels } from "@/services/api/image";
import { audioFormatOptions, audioVoiceOptions, normalizeAudioSpeedValue } from "@/lib/audio-generation";
import { createModelChannel, defaultBaseUrlForApiFormat, filterModelsByCapability, modelOptionLabel, modelOptionsFromChannels, normalizeModelOptionValue, useConfigStore, type AiConfig, type ApiCallFormat, type ConfigTabKey, type ModelCapability, type ModelChannel } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";

type ModelGroup = {
    capability: ModelCapability;
    modelKey: "imageModel" | "videoModel" | "textModel" | "audioModel";
    modelsKey: "imageModels" | "videoModels" | "textModels" | "audioModels";
    defaultLabel: string;
    optionsLabel: string;
};

const modelGroups: ModelGroup[] = [
    { capability: "image", modelKey: "imageModel", modelsKey: "imageModels", defaultLabel: "默认生图模型", optionsLabel: "生图模型可选项" },
    { capability: "video", modelKey: "videoModel", modelsKey: "videoModels", defaultLabel: "默认视频模型", optionsLabel: "视频模型可选项" },
    { capability: "text", modelKey: "textModel", modelsKey: "textModels", defaultLabel: "默认文本模型", optionsLabel: "文本模型可选项" },
    { capability: "audio", modelKey: "audioModel", modelsKey: "audioModels", defaultLabel: "默认音频模型", optionsLabel: "音频模型可选项" },
];

const apiFormatOptions: Array<{ label: string; value: ApiCallFormat }> = [
    { label: "OpenAI", value: "openai" },
    { label: "Gemini", value: "gemini" },
    { label: "火山方舟", value: "ark" },
];

export function AppConfigPanel({ showDoneButton = false, initialTab = "channels" }: { showDoneButton?: boolean; initialTab?: ConfigTabKey }) {
    const { message } = App.useApp();
    const [activeTab, setActiveTab] = useState<ConfigTabKey>(initialTab);
    const [loadingChannelId, setLoadingChannelId] = useState("");
    const [openChannelIds, setOpenChannelIds] = useState<Set<string>>(new Set());
    const config = useConfigStore((state) => state.config);
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const shouldPromptContinue = useConfigStore((state) => state.shouldPromptContinue);
    const setConfigDialogOpen = useConfigStore((state) => state.setConfigDialogOpen);
    const clearPromptContinue = useConfigStore((state) => state.clearPromptContinue);
    const saveSystemConfig = useConfigStore((state) => state.saveSystemConfig);
    const modelOptions = config.models.map((model) => ({ label: modelOptionLabel(config, model), value: model }));
    const isAdmin = useUserStore((state) => state.user?.role === "admin");
    useEffect(() => setActiveTab(initialTab), [initialTab]);

    const saveConfig = (nextConfig: AiConfig) => {
        (Object.keys(nextConfig) as Array<keyof AiConfig>).forEach((key) => updateConfig(key, nextConfig[key]));
    };

    const finishConfig = async () => {
        try {
            if (isAdmin) await saveSystemConfig();
            setConfigDialogOpen(false);
            message.success(shouldPromptContinue ? "配置已保存，请继续刚才的请求" : "配置已保存");
            clearPromptContinue();
        } catch (error) {
            message.error(error instanceof Error ? error.message : "保存失败");
        }
    };

    const updateChannels = (channels: ModelChannel[]) => {
        const nextConfig = withChannels(config, channels);
        saveConfig(nextConfig);
    };

    const updateChannel = (id: string, patch: Partial<ModelChannel>) => {
        updateChannels(config.channels.map((channel) => (channel.id === id ? { ...channel, ...patch, models: patch.models ? uniqueModels(patch.models) : channel.models } : channel)));
    };

    const updateChannelApiFormat = (channel: ModelChannel, apiFormat: ApiCallFormat) => {
        const baseUrl = !channel.baseUrl.trim() || channel.baseUrl.trim() === defaultBaseUrlForApiFormat(channel.apiFormat) ? defaultBaseUrlForApiFormat(apiFormat) : channel.baseUrl;
        updateChannel(channel.id, { apiFormat, baseUrl });
    };

    const addChannel = () => {
        const channel = createModelChannel({ name: `渠道 ${config.channels.length + 1}` });
        updateChannels([...config.channels, channel]);
        setOpenChannelIds((current) => new Set([...current, channel.id]));
    };

    const toggleChannel = (id: string) => {
        setOpenChannelIds((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const deleteChannel = (id: string) => {
        if (config.channels.length <= 1) {
            message.warning("至少保留一个渠道");
            return;
        }
        updateChannels(config.channels.filter((channel) => channel.id !== id));
        setOpenChannelIds((current) => {
            const next = new Set(current);
            next.delete(id);
            return next;
        });
    };

    const refreshChannelModels = async (channel: ModelChannel) => {
        if (channel.apiFormat === "ark") {
            message.info("火山方舟模型请手动填写官方模型 ID");
            return;
        }
        if (!channel.baseUrl.trim() || !(channel.apiKey.trim() || channel.hasApiKey)) {
            message.error("请先填写该渠道的 Base URL 和 API Key");
            return;
        }
        setLoadingChannelId(channel.id);
        try {
            const models = await fetchChannelModels(channel);
            updateChannels(config.channels.map((item) => (item.id === channel.id ? { ...item, models } : item)));
            message.success(`${channel.name} 模型列表已更新`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "读取模型失败");
        } finally {
            setLoadingChannelId("");
        }
    };

    const refreshAllModels = async () => {
        const runnable = config.channels.filter((channel) => channel.enabled !== false && channel.apiFormat !== "ark" && channel.baseUrl.trim() && channel.apiKey.trim());
        if (!runnable.length) {
            message.error("请先填写至少一个可拉取模型渠道的 Base URL 和 API Key");
            return;
        }
        setLoadingChannelId("all");
        try {
            const entries = await Promise.all(runnable.map(async (channel) => [channel.id, await fetchChannelModels(channel)] as const));
            const modelMap = new Map(entries);
            updateChannels(config.channels.map((channel) => (modelMap.has(channel.id) ? { ...channel, models: modelMap.get(channel.id) || [] } : channel)));
            message.success("模型列表已更新");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "读取模型失败");
        } finally {
            setLoadingChannelId("");
        }
    };

    const updateCapabilityModels = (group: ModelGroup, models: string[]) => {
        const next = uniqueModels(models.map((model) => normalizeModelOptionValue(model, config.channels)).filter(Boolean));
        updateConfig(group.modelsKey, next);
        if (!next.includes(config[group.modelKey])) updateConfig(group.modelKey, next[0] || "");
    };

    const tabItems = [
                    {
                        key: "channels",
                        label: "渠道",
                        children: (
                            <Form layout="vertical" requiredMark={false}>
                                <div className="mb-4 flex justify-end gap-2">
                                    <div className="flex shrink-0 gap-2">
                                        <Button icon={<RefreshCw className="size-4" />} loading={Boolean(loadingChannelId)} onClick={() => void refreshAllModels()}>
                                            拉取全部
                                        </Button>
                                        <Button type="primary" icon={<Plus className="size-4" />} onClick={addChannel}>
                                            新增渠道
                                        </Button>
                                    </div>
                                    </div>
                                    <div className="space-y-3">
                                        {config.channels.map((channel) => {
                                            const expanded = openChannelIds.has(channel.id);
                                            return (
                                                <section key={channel.id} className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 shadow-[0_8px_24px_rgba(41,37,36,.035)] dark:border-stone-800 dark:bg-stone-900/45">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => toggleChannel(channel.id)}>
                                                            <ChevronDown className={`size-4 shrink-0 text-stone-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
                                                            <span className="min-w-0">
                                                                <span className="block truncate text-sm font-semibold">{channel.name || "未命名渠道"}</span>
                                                                <span className="mt-1 block text-xs text-stone-500">{apiFormatLabel(channel.apiFormat)} · 已保存 {channel.models.length} 个模型</span>
                                                            </span>
                                                        </button>
                                                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                                                            <span className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-stone-200 bg-background px-2 text-xs font-medium text-stone-600 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-300">
                                                                <span>{channel.enabled !== false ? "已启用" : "已关闭"}</span>
                                                                <Switch size="small" checked={channel.enabled !== false} onChange={(enabled) => updateChannel(channel.id, { enabled })} />
                                                            </span>
                                                            <Button size="small" type="text" className="!h-7 !rounded-lg !px-2" icon={<RefreshCw className="size-3.5" />} disabled={channel.enabled === false || channel.apiFormat === "ark"} loading={loadingChannelId === channel.id} onClick={() => void refreshChannelModels(channel)}>
                                                                拉取模型
                                                            </Button>
                                                            <Button size="small" type="text" danger className="!h-7 !w-7 !rounded-lg !p-0" icon={<Trash2 className="size-3.5" />} onClick={() => deleteChannel(channel.id)} />
                                                        </div>
                                                    </div>
                                                    {expanded ? (
                                                        <div className="mt-4 grid animate-in fade-in slide-in-from-top-1 gap-4 border-t border-stone-200 pt-4 duration-200 dark:border-stone-800 md:grid-cols-2">
                                                            <Form.Item label="渠道名称" className="mb-0">
                                                                <Input value={channel.name} onChange={(event) => updateChannel(channel.id, { name: event.target.value })} />
                                                            </Form.Item>
                                                            <Form.Item label="调用格式" className="mb-0">
                                                                <Select value={channel.apiFormat} options={apiFormatOptions} onChange={(value: ApiCallFormat) => updateChannelApiFormat(channel, value)} />
                                                            </Form.Item>
                                                            <Form.Item label="Base URL" className="mb-0">
                                                                <Input value={channel.baseUrl} onChange={(event) => updateChannel(channel.id, { baseUrl: event.target.value })} />
                                                            </Form.Item>
                                                            <Form.Item label="API Key" className="mb-0">
                                                                <Input.Password value={channel.apiKey} onChange={(event) => updateChannel(channel.id, { apiKey: event.target.value })} />
                                                            </Form.Item>
                                                            <Form.Item label="模型列表" className="mb-0 md:col-span-2">
                                                                <Select mode="tags" showSearch allowClear maxTagCount="responsive" placeholder={channel.apiFormat === "ark" ? "手动输入火山方舟模型 ID" : "输入模型名，或点击拉取模型"} value={channel.models} onChange={(models) => updateChannel(channel.id, { models })} />
                                                            </Form.Item>
                                                        </div>
                                                    ) : null}
                                                </section>
                                            );
                                        })}
                                </div>
                            </Form>
                        ),
                    },
                    {
                        key: "models",
                        label: "模型",
                        children: (
                            <Form layout="vertical" requiredMark={false}>
                                <div className="mb-4 rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                                    <div className="text-sm font-semibold">默认模型和可选项</div>
                                    <div className="mt-1 text-xs leading-5 text-stone-500">可选项决定各处下拉框展示哪些模型。</div>
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    {modelGroups.map((group) => (
                                        <Form.Item key={group.modelsKey} label={group.optionsLabel} className="mb-0">
                                            <Select
                                                mode="tags"
                                                showSearch
                                                allowClear
                                                maxTagCount="responsive"
                                                placeholder={config.models.length ? `请选择或输入${group.optionsLabel}` : "先到渠道里填写或拉取模型"}
                                                value={config[group.modelsKey]}
                                                options={modelOptions}
                                                onChange={(models) => updateCapabilityModels(group, models)}
                                            />
                                        </Form.Item>
                                    ))}
                                </div>
                                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                    {modelGroups.map((group) => (
                                        <Form.Item key={group.modelKey} label={group.defaultLabel} className="mb-0">
                                            <ModelPicker config={config} value={config[group.modelKey]} onChange={(model) => updateConfig(group.modelKey, model)} capability={group.capability} fullWidth />
                                        </Form.Item>
                                    ))}
                                </div>
                            </Form>
                        ),
                    },
                    {
                        key: "preferences",
                        label: "生成偏好",
                        children: (
                            <Form layout="vertical" requiredMark={false}>
                                <div className="grid gap-4 md:grid-cols-4">
                                    <Form.Item label="画布默认生图张数" extra="新建画布生图和配置节点默认使用，单个节点仍可单独覆盖。" className="mb-4">
                                        <Input
                                            type="number"
                                            min={1}
                                            max={4}
                                            value={config.canvasImageCount}
                                            onChange={(event) => updateConfig("canvasImageCount", event.target.value)}
                                            onBlur={(event) => updateConfig("canvasImageCount", normalizeImageCount(event.target.value))}
                                        />
                                    </Form.Item>
                                    <Form.Item label="默认音频声音" className="mb-4">
                                        <Select value={config.audioVoice} options={audioVoiceOptions} onChange={(value) => updateConfig("audioVoice", value)} />
                                    </Form.Item>
                                    <Form.Item label="默认音频格式" className="mb-4">
                                        <Select value={config.audioFormat} options={audioFormatOptions} onChange={(value) => updateConfig("audioFormat", value)} />
                                    </Form.Item>
                                    <Form.Item label="默认音频语速" className="mb-4">
                                        <Input
                                            type="number"
                                            min={0.25}
                                            max={4}
                                            step={0.05}
                                            value={config.audioSpeed}
                                            onChange={(event) => updateConfig("audioSpeed", event.target.value)}
                                            onBlur={(event) => updateConfig("audioSpeed", normalizeAudioSpeedValue(event.target.value))}
                                        />
                                    </Form.Item>
                                </div>
                                <Form.Item label="默认音频指令" className="mb-4">
                                    <Input.TextArea rows={2} value={config.audioInstructions} placeholder="例如：自然、温暖、适合旁白。" onChange={(event) => updateConfig("audioInstructions", event.target.value)} />
                                </Form.Item>
                                <Form.Item label="系统提示词" className="mb-0">
                                    <Input.TextArea rows={4} value={config.systemPrompt} placeholder="例如：你是一位擅长电影感写实摄影的视觉导演。" onChange={(event) => updateConfig("systemPrompt", event.target.value)} />
                                </Form.Item>
                            </Form>
                        ),
                    },
                ];

    return (
        <>
            <Tabs
                activeKey={activeTab}
                onChange={(key) => setActiveTab(key as ConfigTabKey)}
                items={tabItems.filter((item) => isAdmin || (item.key !== "channels" && item.key !== "models"))}
            />
            {showDoneButton ? (
                <div className="mt-4 flex justify-end">
                    <Button type="primary" onClick={() => void finishConfig()}>
                        完成
                    </Button>
                </div>
            ) : isAdmin ? (
                <div className="mt-4 flex justify-end">
                    <Button type="primary" onClick={() => void finishConfig()}>
                        保存到服务器
                    </Button>
                </div>
            ) : null}
        </>
    );
}

export function AppConfigModal() {
    const isConfigOpen = useConfigStore((state) => state.isConfigOpen);
    const configTab = useConfigStore((state) => state.configTab);
    const setConfigDialogOpen = useConfigStore((state) => state.setConfigDialogOpen);
    return (
        <Modal
            title={
                <div>
                    <div className="text-lg font-semibold">配置与用户偏好</div>
                    <div className="mt-1 text-xs font-normal text-stone-500">渠道聚合、模型选择和生成偏好</div>
                </div>
            }
            open={isConfigOpen}
            width={980}
            centered
            onCancel={() => setConfigDialogOpen(false)}
            styles={{ body: { maxHeight: "72vh", overflowY: "auto", paddingRight: 12 } }}
            footer={null}
        >
            <AppConfigPanel showDoneButton initialTab={configTab} />
        </Modal>
    );
}

function withChannels(config: AiConfig, channels: ModelChannel[]): AiConfig {
    const models = modelOptionsFromChannels(channels);
    const imageModels = keepOrSuggest(config.imageModels, filterModelsByCapability(models, "image"), models);
    const videoModels = keepOrSuggest(config.videoModels, filterModelsByCapability(models, "video"), models);
    const textModels = keepOrSuggest(config.textModels, filterModelsByCapability(models, "text"), models);
    const audioModels = keepOrSuggest(config.audioModels, filterModelsByCapability(models, "audio"), models);
    return {
        ...config,
        channels,
        models,
        baseUrl: channels.find((channel) => channel.enabled !== false)?.baseUrl || config.baseUrl,
        apiKey: channels.find((channel) => channel.enabled !== false)?.apiKey || config.apiKey,
        apiFormat: channels.find((channel) => channel.enabled !== false)?.apiFormat || config.apiFormat,
        imageModels,
        videoModels,
        textModels,
        audioModels,
        imageModel: normalizeDefaultModel(config.imageModel, imageModels),
        videoModel: normalizeDefaultModel(config.videoModel, videoModels),
        textModel: normalizeDefaultModel(config.textModel, textModels),
        audioModel: normalizeDefaultModel(config.audioModel, audioModels),
    };
}

function keepOrSuggest(current: string[], suggested: string[], allModels: string[]) {
    const available = new Set(allModels);
    const kept = uniqueModels(current).filter((model) => available.has(model));
    return kept.length ? kept : suggested;
}

function normalizeDefaultModel(value: string, options: string[]) {
    if (options.includes(value)) return value;
    return options[0] || value;
}

function normalizeImageCount(value: string) {
    return String(Math.max(1, Math.min(4, Math.floor(Math.abs(Number(value)) || 3))));
}

function uniqueModels(models: string[]) {
    return Array.from(new Set(models.map((model) => model.trim()).filter(Boolean)));
}

function apiFormatLabel(apiFormat: ApiCallFormat) {
    if (apiFormat === "gemini") return "Gemini";
    if (apiFormat === "ark") return "火山方舟";
    return "OpenAI";
}
