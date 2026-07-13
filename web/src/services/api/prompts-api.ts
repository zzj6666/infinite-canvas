import { apiJson } from "./client";
import type { PersonalPrompt, PersonalPromptInput } from "@/stores/use-prompt-store";

export async function fetchPrompts() {
    return apiJson<{ prompts: PersonalPrompt[] }>("/api/prompts");
}

export async function createPrompt(input: PersonalPromptInput) {
    return apiJson<{ prompt: PersonalPrompt }>("/api/prompts", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

export async function updatePrompt(id: string, patch: Partial<PersonalPromptInput>) {
    return apiJson<{ prompt: PersonalPrompt }>(`/api/prompts/${id}`, {
        method: "PUT",
        body: JSON.stringify(patch),
    });
}

export async function deletePrompt(id: string) {
    return apiJson<{ ok: boolean }>(`/api/prompts/${id}`, { method: "DELETE" });
}
