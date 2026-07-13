import { useMemo } from "react";

import { ALL_PROMPTS_OPTION, type Prompt } from "@/services/api/prompts";
import { usePromptStore } from "@/stores/use-prompt-store";

export function usePromptList({ keyword, tags, category }: { keyword: string; tags: string[]; category: string }) {
    const hydrated = usePromptStore((state) => state.hydrated);
    const prompts = usePromptStore((state) => state.prompts);

    const items = useMemo(() => {
        const normalizedKeyword = keyword.trim().toLowerCase();
        return prompts
            .filter((item) => {
                if (category && category !== ALL_PROMPTS_OPTION && item.category !== category) return false;
                if (tags.length && !tags.some((tag) => item.tags.includes(tag))) return false;
                if (!normalizedKeyword) return true;
                return [item.title, item.prompt, item.category, item.note || "", ...item.tags].join(" ").toLowerCase().includes(normalizedKeyword);
            })
            .map(toPrompt);
    }, [category, keyword, prompts, tags]);

    const availableTags = useMemo(() => {
        const source = category && category !== ALL_PROMPTS_OPTION ? prompts.filter((item) => item.category === category) : prompts;
        const counts = new Map<string, number>();
        for (const item of source) {
            for (const tag of item.tags) counts.set(tag, (counts.get(tag) || 0) + 1);
        }
        return [ALL_PROMPTS_OPTION, ...Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN")).map(([tag]) => tag)];
    }, [category, prompts]);

    const categories = useMemo(() => {
        const values = Array.from(new Set(prompts.map((item) => item.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-CN"));
        return [ALL_PROMPTS_OPTION, ...values];
    }, [prompts]);

    return {
        hydrated,
        items,
        tags: availableTags,
        categories,
        total: items.length,
    };
}

function toPrompt(item: {
    id: string;
    title: string;
    coverUrl: string;
    prompt: string;
    tags: string[];
    category: string;
    note?: string;
    createdAt: string;
    updatedAt: string;
}): Prompt {
    return {
        id: item.id,
        title: item.title,
        coverUrl: item.coverUrl,
        prompt: item.prompt,
        tags: item.tags,
        category: item.category,
        githubUrl: "",
        preview: item.note || "",
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        note: item.note,
    };
}
