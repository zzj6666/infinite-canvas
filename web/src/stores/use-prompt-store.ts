import { create } from "zustand";
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware";
import { nanoid } from "nanoid";

import { localForageStorage } from "@/lib/localforage-storage";

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
    addPrompt: (input: PersonalPromptInput) => string;
    updatePrompt: (id: string, patch: Partial<PersonalPromptInput>) => void;
    removePrompt: (id: string) => void;
    replacePrompts: (prompts: PersonalPrompt[]) => void;
};

const PROMPT_STORE_KEY = "infinite-canvas:prompt_store";
const DEFAULT_CATEGORY = "默认";

const promptStorage: PersistStorage<PromptStore> = {
    getItem: async (name) => {
        const value = await localForageStorage.getItem(name);
        if (!value) return null;
        return JSON.parse(value) as StorageValue<PromptStore>;
    },
    setItem: (name, value) => localForageStorage.setItem(name, JSON.stringify(value)),
    removeItem: (name) => localForageStorage.removeItem(name),
};

export const usePromptStore = create<PromptStore>()(
    persist(
        (set) => ({
            hydrated: false,
            prompts: [],
            addPrompt: (input) => {
                const now = new Date().toISOString();
                const id = nanoid();
                const prompt: PersonalPrompt = {
                    id,
                    title: input.title.trim() || "未命名提示词",
                    prompt: input.prompt.trim(),
                    tags: normalizeTags(input.tags),
                    category: (input.category || DEFAULT_CATEGORY).trim() || DEFAULT_CATEGORY,
                    coverUrl: (input.coverUrl || "").trim(),
                    note: input.note?.trim() || undefined,
                    createdAt: now,
                    updatedAt: now,
                };
                set((state) => ({ prompts: [prompt, ...state.prompts] }));
                return id;
            },
            updatePrompt: (id, patch) =>
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
                })),
            removePrompt: (id) => set((state) => ({ prompts: state.prompts.filter((item) => item.id !== id) })),
            replacePrompts: (prompts) => set({ prompts }),
        }),
        {
            name: PROMPT_STORE_KEY,
            storage: promptStorage,
            partialize: (state) => ({ prompts: state.prompts }) as StorageValue<PromptStore>["state"],
            onRehydrateStorage: () => () => {
                usePromptStore.setState({ hydrated: true });
            },
        },
    ),
);

function normalizeTags(tags?: string[]) {
    return Array.from(new Set((tags || []).map((tag) => tag.trim()).filter(Boolean)));
}

export { DEFAULT_CATEGORY as DEFAULT_PROMPT_CATEGORY };
