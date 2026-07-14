import { BookOpenText, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { App, Button, Empty, Form, Input, Modal, Select, Space, Tag, Tooltip } from "antd";

import { PromptCard } from "@/components/prompts/prompt-card";
import { usePromptList } from "@/components/prompts/use-prompt-list";
import { PromptDetailDialog } from "./components/prompt-detail-dialog";
import { useCopyText } from "@/hooks/use-copy-text";
import { cn } from "@/lib/utils";
import { ALL_PROMPTS_OPTION, type Prompt } from "@/services/api/prompts";
import { DEFAULT_PROMPT_CATEGORY, usePromptStore } from "@/stores/use-prompt-store";

type PromptFormValues = {
    title: string;
    prompt: string;
    category?: string | string[];
    tags?: string[];
    coverUrl?: string;
    note?: string;
};

export default function PromptsPage() {
    const { message, modal } = App.useApp();
    const [titleKeyword, setTitleKeyword] = useState("");
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState(ALL_PROMPTS_OPTION);
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form] = Form.useForm<PromptFormValues>();
    const copyText = useCopyText();
    const addPrompt = usePromptStore((state) => state.addPrompt);
    const updatePrompt = usePromptStore((state) => state.updatePrompt);
    const removePrompt = usePromptStore((state) => state.removePrompt);
    const allPrompts = usePromptStore((state) => state.prompts);
    const { items: promptItems, tags: promptTags, categories: promptCategoryOptions } = usePromptList({
        keyword: titleKeyword,
        tags: selectedTags,
        category: selectedCategory,
    });

    const categoryOptions = useMemo(() => {
        const values = Array.from(new Set([DEFAULT_PROMPT_CATEGORY, ...allPrompts.map((item) => item.category).filter(Boolean)]));
        return values.map((value) => ({ label: value, value }));
    }, [allPrompts]);

    const toggleTag = (tag: string) => {
        if (tag === ALL_PROMPTS_OPTION) return setSelectedTags([]);
        setSelectedTags((items) => (items.includes(tag) ? items.filter((item) => item !== tag) : [...items, tag]));
    };
    const clearFilters = () => {
        setTitleKeyword("");
        setSelectedTags([]);
        setSelectedCategory(ALL_PROMPTS_OPTION);
    };
    const hasFilters = Boolean(titleKeyword || selectedTags.length || selectedCategory !== ALL_PROMPTS_OPTION);

    const openCreate = () => {
        setEditingId(null);
        form.setFieldsValue({ title: "", prompt: "", category: [DEFAULT_PROMPT_CATEGORY], tags: [], coverUrl: "", note: "" });
        setEditorOpen(true);
    };

    const openEdit = (item: Prompt) => {
        setEditingId(item.id);
        form.setFieldsValue({
            title: item.title,
            prompt: item.prompt,
            category: [item.category || DEFAULT_PROMPT_CATEGORY],
            tags: item.tags,
            coverUrl: item.coverUrl,
            note: item.note || item.preview || "",
        });
        setEditorOpen(true);
    };

    const handleSubmit = async () => {
        const values = await form.validateFields();
        const categoryValue = Array.isArray(values.category) ? values.category[0] : values.category;
        const payload = {
            title: values.title.trim(),
            prompt: values.prompt.trim(),
            category: String(categoryValue || DEFAULT_PROMPT_CATEGORY).trim() || DEFAULT_PROMPT_CATEGORY,
            tags: values.tags || [],
            coverUrl: values.coverUrl?.trim() || "",
            note: values.note?.trim() || "",
        };
        if (!payload.prompt) {
            message.warning("请填写提示词内容");
            return;
        }
        if (editingId) {
            updatePrompt(editingId, payload);
            message.success("提示词已更新");
        } else {
            addPrompt(payload);
            message.success("提示词已添加");
        }
        setEditorOpen(false);
        setSelectedPrompt(null);
    };

    const handleDelete = (item: Prompt) => {
        modal.confirm({
            title: "删除提示词",
            content: `确认删除「${item.title}」？`,
            okText: "删除",
            okButtonProps: { danger: true },
            cancelText: "取消",
            onOk: () => {
                removePrompt(item.id);
                if (selectedPrompt?.id === item.id) setSelectedPrompt(null);
                message.success("已删除");
            },
        });
    };

    return (
        <div className="flex h-full flex-col overflow-hidden bg-background text-stone-800 dark:text-stone-100">
            <main className="app-page min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
                    <header className="flex flex-col gap-6 border-b border-stone-300/70 pb-8 dark:border-stone-700/80 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-2xl">
                            <div className="mb-4 flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-stone-500 dark:text-stone-400">
                                <BookOpenText className="size-4" />
                                团队提示词库
                            </div>
                            <h1 className="text-4xl font-semibold tracking-[-0.045em] text-stone-950 sm:text-5xl dark:text-stone-100">共享提示词</h1>
                            <p className="mt-3 text-sm leading-6 text-stone-600 dark:text-stone-400">沉淀可复用的创作表达，让团队在画布中快速调用同一套灵感。</p>
                        </div>
                        <Button type="primary" size="large" icon={<Plus className="size-4" />} onClick={openCreate}>
                            新建提示词
                        </Button>
                    </header>

                    <section className="app-surface mt-7 rounded-2xl p-4 sm:p-5">
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
                            <div className="w-full lg:max-w-md">
                                <div className="mb-2 text-xs font-medium text-stone-500 dark:text-stone-400">检索提示词</div>
                                <Input size="large" className="w-full" prefix={<Search className="size-4 text-stone-400" />} value={titleKeyword} placeholder="搜索标题、内容或标签" allowClear onChange={(event) => setTitleKeyword(event.target.value)} />
                            </div>
                            <div className="min-w-0 flex-1 space-y-3">
                                <div className="flex items-start gap-3">
                                    <span className="w-8 pt-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">分类</span>
                                    <div className="flex flex-1 flex-wrap gap-2">
                                        {promptCategoryOptions.map((category) => (
                                            <Tag.CheckableTag key={category} checked={selectedCategory === category} className={cn("prompt-filter-tag", selectedCategory === category && "is-active")} onChange={() => setSelectedCategory(category)}>
                                                {category}
                                            </Tag.CheckableTag>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="w-8 pt-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">标签</span>
                                    <div className="flex flex-1 flex-wrap gap-2">
                                        {promptTags.map((tag) => (
                                            <Tag.CheckableTag
                                                key={tag}
                                                checked={tag === ALL_PROMPTS_OPTION ? selectedTags.length === 0 : selectedTags.includes(tag)}
                                                className={cn("prompt-filter-tag", (tag === ALL_PROMPTS_OPTION ? selectedTags.length === 0 : selectedTags.includes(tag)) && "is-active")}
                                                onChange={() => toggleTag(tag)}
                                            >
                                                {tag}
                                            </Tag.CheckableTag>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            {hasFilters ? (
                                <Button type="text" className="self-start text-stone-500" onClick={clearFilters}>
                                    清除筛选
                                </Button>
                            ) : null}
                        </div>
                    </section>

                    <section className="mt-9">
                        <div className="mb-4 flex items-center justify-between gap-4">
                            <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">{hasFilters ? "筛选结果" : "全部提示词"}</h2>
                            <span className="text-xs text-stone-500 dark:text-stone-400">{promptItems.length} 条</span>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                            {promptItems.map((item) => (
                                <PromptCard
                                    key={item.id}
                                    item={item}
                                    onOpen={() => setSelectedPrompt(item)}
                                    onCopy={() => copyText(item.prompt, "提示词已复制")}
                                    extraAction={
                                        <Space size={2}>
                                            <Tooltip title="编辑">
                                                <Button size="small" type="text" icon={<Pencil className="size-3.5" />} aria-label="编辑" onClick={() => openEdit(item)} />
                                            </Tooltip>
                                            <Tooltip title="删除">
                                                <Button size="small" type="text" danger icon={<Trash2 className="size-3.5" />} aria-label="删除" onClick={() => handleDelete(item)} />
                                            </Tooltip>
                                        </Space>
                                    }
                                />
                            ))}
                        </div>
                        {promptItems.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={allPrompts.length === 0 ? "还没有提示词，点击上方新建" : "没有找到匹配的提示词"} className="py-20" /> : null}
                    </section>
                </div>
            </main>

            <PromptDetailDialog
                prompt={selectedPrompt}
                onClose={() => setSelectedPrompt(null)}
                onCopy={(prompt) => copyText(prompt, "提示词已复制")}
                onEdit={(prompt) => openEdit(prompt)}
                onDelete={(prompt) => handleDelete(prompt)}
            />

            <Modal title={editingId ? "编辑提示词" : "新建提示词"} open={editorOpen} onCancel={() => setEditorOpen(false)} onOk={() => void handleSubmit()} okText="保存" cancelText="取消" width={720} destroyOnHidden>
                <Form form={form} layout="vertical" requiredMark={false} className="mt-2">
                    <Form.Item name="title" label="标题" rules={[{ required: true, message: "请输入标题" }]}>
                        <Input placeholder="例如：产品海报风格" maxLength={80} />
                    </Form.Item>
                    <Form.Item name="prompt" label="提示词内容" rules={[{ required: true, message: "请输入提示词内容" }]}>
                        <Input.TextArea rows={8} placeholder="写下你常用的提示词" />
                    </Form.Item>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Form.Item name="category" label="分类">
                            <Select mode="tags" maxCount={1} options={categoryOptions} placeholder="选择或输入分类" tokenSeparators={[",", "，"]} />
                        </Form.Item>
                        <Form.Item name="tags" label="标签">
                            <Select mode="tags" tokenSeparators={[",", "，"]} placeholder="输入标签后回车" />
                        </Form.Item>
                    </div>
                    <Form.Item name="coverUrl" label="封面图 URL（可选）">
                        <Input placeholder="https://..." />
                    </Form.Item>
                    <Form.Item name="note" label="备注（可选）">
                        <Input.TextArea rows={3} placeholder="使用场景、注意事项等" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
