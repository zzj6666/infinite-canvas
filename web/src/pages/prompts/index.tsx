import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { App, Button, Empty, Form, Input, Modal, Select, Space, Tag } from "antd";

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
    const { items: promptItems, tags: promptTags, categories: promptCategoryOptions, total: totalPrompts } = usePromptList({
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
            <main className="app-page min-h-0 flex-1 overflow-y-auto px-6 py-8">
                <div className="pb-8">
                    <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center">
                        <div>
                            <h1 className="text-4xl font-semibold tracking-tight text-stone-950 dark:text-stone-100">我的提示词</h1>
                            <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">仅保存在本机浏览器，共 {totalPrompts} 条。可按标题、标签与分类查找，并在画布中直接选用。</p>
                        </div>
                        <Button type="primary" icon={<Plus className="size-4" />} onClick={openCreate}>
                            新建提示词
                        </Button>
                    </div>
                    <div className="mx-auto mt-8 w-full max-w-2xl">
                        <Input size="large" className="w-full" prefix={<Search className="size-4 text-stone-400" />} value={titleKeyword} placeholder="搜索标题、内容、标签" onChange={(event) => setTitleKeyword(event.target.value)} />
                    </div>
                    <div className="mx-auto mt-6 grid max-w-6xl gap-3 text-left">
                        <div className="grid gap-2 sm:grid-cols-[56px_minmax(0,1fr)] sm:items-start">
                            <div className="pt-2 text-xs font-medium text-stone-500 dark:text-stone-400">分类</div>
                            <div className="flex flex-wrap gap-2">
                                {promptCategoryOptions.map((category) => (
                                    <Tag.CheckableTag key={category} checked={selectedCategory === category} className={cn("prompt-filter-tag", selectedCategory === category && "is-active")} onChange={() => setSelectedCategory(category)}>
                                        {category}
                                    </Tag.CheckableTag>
                                ))}
                            </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-[56px_minmax(0,1fr)] sm:items-start">
                            <div className="pt-2 text-xs font-medium text-stone-500 dark:text-stone-400">标签</div>
                            <div className="flex flex-wrap gap-2">
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
                </div>

                <div>
                    <div className="mx-auto grid max-w-7xl gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {promptItems.map((item) => (
                            <PromptCard
                                key={item.id}
                                item={item}
                                onOpen={() => setSelectedPrompt(item)}
                                onCopy={() => copyText(item.prompt, "提示词已复制")}
                                extraAction={
                                    <Space size={4}>
                                        <Button size="small" icon={<Pencil className="size-3.5" />} onClick={() => openEdit(item)}>
                                            编辑
                                        </Button>
                                        <Button size="small" danger icon={<Trash2 className="size-3.5" />} onClick={() => handleDelete(item)}>
                                            删除
                                        </Button>
                                    </Space>
                                }
                            />
                        ))}
                    </div>
                    {promptItems.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={allPrompts.length === 0 ? "还没有提示词，点击上方新建" : "没有找到匹配的提示词"} className="py-16" /> : null}
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
