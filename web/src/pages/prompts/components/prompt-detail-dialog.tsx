import { Copy, Pencil, Trash2 } from "lucide-react";
import { Button, Modal, Space, Tag } from "antd";

import { formatPromptDate, type Prompt } from "@/services/api/prompts";

export function PromptDetailDialog({
    prompt,
    onClose,
    onCopy,
    onEdit,
    onDelete,
}: {
    prompt: Prompt | null;
    onClose: () => void;
    onCopy: (prompt: string) => void;
    onEdit?: (prompt: Prompt) => void;
    onDelete?: (prompt: Prompt) => void;
}) {
    return (
        <Modal title={prompt?.title} open={Boolean(prompt)} onCancel={onClose} footer={null} width={860}>
            {prompt ? (
                <div className="grid gap-5 md:grid-cols-[300px_minmax(0,1fr)]">
                    <div className="space-y-3">
                        {prompt.coverUrl ? <img src={prompt.coverUrl} alt={prompt.title} className="aspect-[4/3] w-full rounded-lg object-cover" /> : <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg bg-stone-100 text-sm text-stone-400 dark:bg-stone-900">无封面</div>}
                        {prompt.preview ? <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-stone-100 p-3 text-xs leading-5 text-stone-600 dark:bg-stone-900 dark:text-stone-300">{prompt.preview}</pre> : null}
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap gap-1.5">
                            {prompt.category ? (
                                <Tag className="m-0" color="blue">
                                    {prompt.category}
                                </Tag>
                            ) : null}
                            {prompt.tags.map((tag) => (
                                <Tag key={tag} className="m-0">
                                    {tag}
                                </Tag>
                            ))}
                        </div>
                        <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-stone-800 dark:text-stone-300">{prompt.prompt}</p>
                        <div className="mt-4 text-xs text-stone-500 dark:text-stone-400">
                            创建：{formatPromptDate(prompt.createdAt)} · 更新：{formatPromptDate(prompt.updatedAt)}
                        </div>
                        <Space wrap className="mt-5">
                            <Button type="primary" icon={<Copy className="size-4" />} onClick={() => onCopy(prompt.prompt)}>
                                复制提示词
                            </Button>
                            {onEdit ? (
                                <Button icon={<Pencil className="size-4" />} onClick={() => onEdit(prompt)}>
                                    编辑
                                </Button>
                            ) : null}
                            {onDelete ? (
                                <Button danger icon={<Trash2 className="size-4" />} onClick={() => onDelete(prompt)}>
                                    删除
                                </Button>
                            ) : null}
                        </Space>
                    </div>
                </div>
            ) : null}
        </Modal>
    );
}
