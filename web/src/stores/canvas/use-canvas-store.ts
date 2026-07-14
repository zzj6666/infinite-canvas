import { create } from "zustand";

import type { CanvasBackgroundMode } from "@/lib/canvas-theme";
import {
    createCanvasProject,
    deleteCanvasProjects,
    fetchCanvasProjects,
    updateCanvasProject,
} from "@/services/api/canvas-api";
import type { CanvasAssistantSession, CanvasConnection, CanvasNodeData, ViewportTransform } from "@/types/canvas";

export type CanvasProject = {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    nodes: CanvasNodeData[];
    connections: CanvasConnection[];
    chatSessions: CanvasAssistantSession[];
    activeChatId: string | null;
    backgroundMode: CanvasBackgroundMode;
    showImageInfo: boolean;
    viewport: ViewportTransform;
};

type CanvasStore = {
    hydrated: boolean;
    projects: CanvasProject[];
    loadProjects: () => Promise<void>;
    createProject: (title?: string) => Promise<string>;
    openProject: (id: string) => CanvasProject | null;
    renameProject: (id: string, title: string) => void;
    deleteProjects: (ids: string[]) => void;
    updateProject: (id: string, patch: Partial<Pick<CanvasProject, "nodes" | "connections" | "chatSessions" | "activeChatId" | "backgroundMode" | "showImageInfo" | "viewport" | "title">>) => void;
    reset: () => void;
};

const initialViewport: ViewportTransform = { x: 0, y: 0, k: 1 };
const updateTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleProjectSave(id: string, getProject: () => CanvasProject | undefined) {
    const prev = updateTimers.get(id);
    if (prev) clearTimeout(prev);
    updateTimers.set(
        id,
        setTimeout(() => {
            updateTimers.delete(id);
            const project = getProject();
            if (!project) return;
            void updateCanvasProject(id, project).catch((error) => console.error("save canvas failed", error));
        }, 400),
    );
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
    hydrated: false,
    projects: [],
    reset: () => {
        updateTimers.forEach((timer) => clearTimeout(timer));
        updateTimers.clear();
        set({ projects: [], hydrated: false });
    },
    loadProjects: async () => {
        try {
            const result = await fetchCanvasProjects();
            set({ projects: result.projects, hydrated: true });
        } catch (error) {
            console.error(error);
            set({ projects: [], hydrated: true });
        }
    },
    createProject: async (title = "未命名画布") => {
        const { project } = await createCanvasProject(title);
        set((state) => ({ projects: [project, ...state.projects.filter((item) => item.id !== project.id)] }));
        return project.id;
    },
    openProject: (id) => get().projects.find((item) => item.id === id) || null,
    renameProject: (id, title) => {
        const nextTitle = title.trim();
        set((state) => ({
            projects: state.projects.map((project) => (project.id === id ? { ...project, title: nextTitle || project.title, updatedAt: new Date().toISOString() } : project)),
        }));
        scheduleProjectSave(id, () => get().projects.find((item) => item.id === id));
    },
    deleteProjects: (ids) => {
        set((state) => ({ projects: state.projects.filter((project) => !ids.includes(project.id)) }));
        void deleteCanvasProjects(ids).catch((error) => console.error(error));
    },
    updateProject: (id, patch) => {
        set((state) => ({
            projects: state.projects.map((project) => (project.id === id ? { ...project, ...patch, updatedAt: new Date().toISOString() } : project)),
        }));
        scheduleProjectSave(id, () => get().projects.find((item) => item.id === id));
    },
}));
