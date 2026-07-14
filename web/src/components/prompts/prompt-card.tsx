import { Copy, Quote } from "lucide-react";
import type { ReactNode } from "react";
import { Button, Card, Tag } from "antd";

import { formatPromptDate, type Prompt } from "@/services/api/prompts";

export function PromptCard({
    item,
    onOpen,
    onCopy,
    actionLabel = "复制",
    actionIcon = <Copy className="size-3.5" />,
    actionType = "text",
    extraAction,
}: {
    item: Prompt;
    onOpen: () => void;
    onCopy: () => void;
    actionLabel?: string;
    actionIcon?: ReactNode;
    actionType?: "text" | "primary";
    extraAction?: ReactNode;
}) {
    return (
        <Card hoverable className="group h-full overflow-hidden border-stone-200/90 bg-[#fffdf9]/95 shadow-[0_10px_28px_rgba(41,37,36,.05)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(41,37,36,.1)] dark:border-stone-800 dark:bg-stone-900/90 dark:hover:shadow-[0_18px_38px_rgba(0,0,0,.28)]" styles={{ body: { display: "flex", height: "100%", flexDirection: "column", padding: 0 } }}>
            {item.coverUrl ? (
                <button type="button" className="block w-full text-left" onClick={onOpen}>
                    <img src={item.coverUrl} alt={item.title} className="aspect-[16/9] w-full object-cover transition duration-500 group-hover:scale-[1.02]" />
                </button>
            ) : null}
            <button type="button" className="block min-h-0 flex-1 text-left" onClick={onOpen}>
                <div className="flex h-full flex-col p-4">
                    <div className="flex items-start justify-between gap-3">
                        <span className="rounded-md bg-stone-100 px-2 py-1 text-[11px] font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">{item.category || "未分类"}</span>
                        <span className="shrink-0 pt-1 text-[11px] text-stone-400 dark:text-stone-500">{formatPromptDate(item.updatedAt)}</span>
                    </div>
                    <h2 className="mt-4 line-clamp-2 text-base font-semibold leading-6 text-stone-950 dark:text-stone-100">{item.title}</h2>
                    <div className="mt-3 flex gap-2">
                        <Quote className="mt-0.5 size-3.5 shrink-0 text-stone-300 dark:text-stone-600" />
                        <p className="line-clamp-4 font-mono text-xs leading-5 text-stone-600 dark:text-stone-400">{item.prompt}</p>
                    </div>
                    <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
                        {item.tags.map((tag) => (
                            <Tag key={tag} className="m-0 rounded-md border-stone-200 bg-transparent text-[11px] text-stone-500 dark:border-stone-700 dark:text-stone-400">
                                {tag}
                            </Tag>
                        ))}
                    </div>
                </div>
            </button>
            <div className="flex items-center gap-2 border-t border-stone-100 px-4 py-3 dark:border-stone-800">
                <Button block={actionType === "primary"} type={actionType} size="small" icon={actionIcon} onClick={onCopy}>
                    {actionLabel}
                </Button>
                {extraAction}
            </div>
        </Card>
    );
}
