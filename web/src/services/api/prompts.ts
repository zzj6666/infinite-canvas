import { usePromptStore, type PersonalPrompt } from "@/stores/use-prompt-store";

export type Prompt = {
    id: string;
    title: string;
    coverUrl: string;
    prompt: string;
    tags: string[];
    category: string;
    githubUrl: string;
    preview: string;
    createdAt: string;
    updatedAt: string;
    note?: string;
};

export const ALL_PROMPTS_OPTION = "全部";

export type PromptListResponse = {
    items: Prompt[];
    tags: string[];
    categories: string[];
    total: number;
};

export async function fetchPrompts({
    keyword = "",
    tag = [],
    category = ALL_PROMPTS_OPTION,
    page = 1,
    pageSize = 20,
}: {
    keyword?: string;
    tag?: string[];
    category?: string;
    page?: number;
    pageSize?: number;
} = {}): Promise<PromptListResponse> {
    await waitForPromptStore();
    const items = usePromptStore.getState().prompts.map(toPrompt);
    const normalizedKeyword = keyword.trim().toLowerCase();
    const normalizedPage = Math.max(1, page);
    const normalizedPageSize = Math.max(1, Math.min(100, pageSize));
    const withoutTagFilter = filterPrompts(items, { keyword: normalizedKeyword, category, tags: [] });
    const filtered = filterPrompts(items, { keyword: normalizedKeyword, category, tags: tag });

    return {
        items: filtered.slice((normalizedPage - 1) * normalizedPageSize, normalizedPage * normalizedPageSize),
        tags: collectTags(withoutTagFilter),
        categories: collectCategories(items),
        total: filtered.length,
    };
}

export function formatPromptDate(value: string) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
}

function toPrompt(item: PersonalPrompt): Prompt {
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

function filterPrompts(items: Prompt[], options: { keyword: string; category: string; tags: string[] }) {
    return items.filter((item) => {
        if (isActiveOption(options.category) && item.category !== options.category) return false;
        if (options.tags.length && !options.tags.some((tag) => item.tags.includes(tag))) return false;
        if (!options.keyword) return true;
        return [item.title, item.prompt, item.category, item.note || "", ...item.tags].join(" ").toLowerCase().includes(options.keyword);
    });
}

function collectTags(items: Prompt[]) {
    const counts = new Map<string, number>();
    for (const item of items) {
        for (const tag of item.tags) counts.set(tag, (counts.get(tag) || 0) + 1);
    }
    return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
        .map(([tag]) => tag);
}

function collectCategories(items: Prompt[]) {
    return Array.from(new Set(items.map((item) => item.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function isActiveOption(value: string) {
    return Boolean(value) && value !== ALL_PROMPTS_OPTION;
}

async function waitForPromptStore() {
    if (usePromptStore.getState().hydrated) return;
    await new Promise<void>((resolve) => {
        const unsub = usePromptStore.subscribe((state) => {
            if (!state.hydrated) return;
            unsub();
            resolve();
        });
        if (usePromptStore.getState().hydrated) {
            unsub();
            resolve();
        }
    });
}
