import { create } from "zustand";

import { createPrompt, deletePrompt, fetchPrompts, updatePrompt as updatePromptApi } from "@/services/api/prompts-api";

export type PersonalPrompt = {
    id: string;
    title: string;
    prompt: string;
    tags: string[];
    category: string;
    coverUrl: string;
    note?: string;
    createdAt: string;
    updatedAt: string;
};

export type PersonalPromptInput = {
    title: string;
    prompt: string;
    tags?: string[];
    category?: string;
    coverUrl?: string;
    note?: string;
};

type PromptStore = {
    hydrated: boolean;
    prompts: PersonalPrompt[];
    loadPrompts: () => Promise<void>;
    addPrompt: (input: PersonalPromptInput) => string;
    updatePrompt: (id: string, patch: Partial<PersonalPromptInput>) => void;
    removePrompt: (id: string) => void;
    replacePrompts: (prompts: PersonalPrompt[]) => void;
    reset: () => void;
};

const DEFAULT_CATEGORY = "默认";

export const usePromptStore = create<PromptStore>((set, get) => ({
    hydrated: false,
    prompts: [],
    reset: () => set({ prompts: [], hydrated: false }),
    loadPrompts: async () => {
        try {
            const result = await fetchPrompts();
            set({ prompts: result.prompts, hydrated: true });
        } catch (error) {
            console.error(error);
            set({ prompts: [], hydrated: true });
        }
    },
    addPrompt: (input) => {
        const tempId = `tmp_${Date.now()}`;
        const now = new Date().toISOString();
        const optimistic: PersonalPrompt = {
            id: tempId,
            title: input.title.trim() || "未命名提示词",
            prompt: input.prompt.trim(),
            tags: normalizeTags(input.tags),
            category: (input.category || DEFAULT_CATEGORY).trim() || DEFAULT_CATEGORY,
            coverUrl: (input.coverUrl || "").trim(),
            note: input.note?.trim() || undefined,
            createdAt: now,
            updatedAt: now,
        };
        set((state) => ({ prompts: [optimistic, ...state.prompts] }));
        void createPrompt(input)
            .then(({ prompt }) => {
                set((state) => ({ prompts: state.prompts.map((item) => (item.id === tempId ? prompt : item)) }));
            })
            .catch((error) => {
                console.error(error);
                set((state) => ({ prompts: state.prompts.filter((item) => item.id !== tempId) }));
            });
        return tempId;
    },
    updatePrompt: (id, patch) => {
        set((state) => ({
            prompts: state.prompts.map((item) => {
                if (item.id !== id) return item;
                return {
                    ...item,
                    title: patch.title !== undefined ? patch.title.trim() || item.title : item.title,
                    prompt: patch.prompt !== undefined ? patch.prompt.trim() : item.prompt,
                    tags: patch.tags !== undefined ? normalizeTags(patch.tags) : item.tags,
                    category: patch.category !== undefined ? patch.category.trim() || DEFAULT_CATEGORY : item.category,
                    coverUrl: patch.coverUrl !== undefined ? patch.coverUrl.trim() : item.coverUrl,
                    note: patch.note !== undefined ? patch.note.trim() || undefined : item.note,
                    updatedAt: new Date().toISOString(),
                };
            }),
        }));
        void updatePromptApi(id, patch).catch((error) => console.error(error));
    },
    removePrompt: (id) => {
        set((state) => ({ prompts: state.prompts.filter((item) => item.id !== id) }));
        void deletePrompt(id).catch((error) => console.error(error));
    },
    replacePrompts: (prompts) => set({ prompts }),
}));

function normalizeTags(tags?: string[]) {
    return Array.from(new Set((tags || []).map((tag) => tag.trim()).filter(Boolean)));
}

export { DEFAULT_CATEGORY as DEFAULT_PROMPT_CATEGORY };
