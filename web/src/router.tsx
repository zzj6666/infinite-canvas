import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { useEffect, type ReactNode } from "react";

import UserLayout from "@/layouts/user-layout";
import AdminUsersPage from "@/pages/admin/users";
import AssetsPage from "@/pages/assets";
import CanvasPage from "@/pages/canvas";
import CanvasProjectPage from "@/pages/canvas/project";
import ConfigPage from "@/pages/config";
import HomePage from "@/pages/home";
import LoginPage from "@/pages/login";
import NotFound from "@/pages/not-found";
import PromptsPage from "@/pages/prompts";
import { useAssetStore } from "@/stores/use-asset-store";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";
import { useConfigStore } from "@/stores/use-config-store";
import { usePromptStore } from "@/stores/use-prompt-store";
import { useUserStore } from "@/stores/use-user-store";

function AuthBootstrap({ children }: { children: ReactNode }) {
    const status = useUserStore((state) => state.status);
    const bootstrap = useUserStore((state) => state.bootstrap);
    const user = useUserStore((state) => state.user);
    const loadProjects = useCanvasStore((state) => state.loadProjects);
    const loadAssets = useAssetStore((state) => state.loadAssets);
    const loadPrompts = usePromptStore((state) => state.loadPrompts);
    const loadSystemConfig = useConfigStore((state) => state.loadSystemConfig);
    const resetCanvas = useCanvasStore((state) => state.reset);
    const resetAssets = useAssetStore((state) => state.reset);
    const resetPrompts = usePromptStore((state) => state.reset);

    useEffect(() => {
        if (status === "idle") void bootstrap();
    }, [bootstrap, status]);

    useEffect(() => {
        if (status !== "authenticated" || !user) {
            resetCanvas();
            resetAssets();
            resetPrompts();
            return;
        }
        void Promise.all([loadProjects(), loadAssets(), loadPrompts(), loadSystemConfig()]);
    }, [loadAssets, loadProjects, loadPrompts, loadSystemConfig, resetAssets, resetCanvas, resetPrompts, status, user]);

    if (status === "idle" || status === "loading") {
        return <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-stone-500">正在加载...</div>;
    }

    return <>{children}</>;
}

function RequireAuth() {
    const status = useUserStore((state) => state.status);
    if (status !== "authenticated") return <Navigate to="/login" replace />;
    return (
        <UserLayout>
            <Outlet />
        </UserLayout>
    );
}

export const router = createBrowserRouter([
    {
        element: (
            <AuthBootstrap>
                <Outlet />
            </AuthBootstrap>
        ),
        children: [
            { path: "/login", element: <LoginPage /> },
            {
                element: <RequireAuth />,
                children: [
                    { path: "/", element: <HomePage /> },
                    { path: "/assets", element: <AssetsPage /> },
                    { path: "/canvas", element: <CanvasPage /> },
                    { path: "/canvas/:id", element: <CanvasProjectPage /> },
                    { path: "/config", element: <ConfigPage /> },
                    { path: "/prompts", element: <PromptsPage /> },
                    { path: "/admin/users", element: <AdminUsersPage /> },
                ],
            },
            { path: "*", element: <NotFound /> },
        ],
    },
]);
