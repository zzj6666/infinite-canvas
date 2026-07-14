import { apiJson } from "./client";
import type { CanvasProject } from "@/stores/canvas/use-canvas-store";

export async function fetchCanvasProjects() {
    return apiJson<{ projects: CanvasProject[] }>("/api/canvas/projects");
}

export async function createCanvasProject(title?: string) {
    return apiJson<{ project: CanvasProject }>("/api/canvas/projects", {
        method: "POST",
        body: JSON.stringify({ title }),
    });
}

export async function fetchCanvasProject(id: string) {
    return apiJson<{ project: CanvasProject }>(`/api/canvas/projects/${id}`);
}

export async function updateCanvasProject(id: string, patch: Partial<CanvasProject>) {
    return apiJson<{ project: CanvasProject }>(`/api/canvas/projects/${id}`, {
        method: "PUT",
        body: JSON.stringify(patch),
    });
}

export async function deleteCanvasProjects(ids: string[]) {
    return apiJson<{ ok: boolean }>("/api/canvas/projects/delete", {
        method: "POST",
        body: JSON.stringify({ ids }),
    });
}
