import { create } from "zustand";

import { fetchMe, login as loginRequest, logout as logoutRequest, type AuthUser } from "@/services/api/auth";

type UserStatus = "idle" | "loading" | "authenticated" | "anonymous";

type UserStore = {
    status: UserStatus;
    user: AuthUser | null;
    error: string;
    bootstrap: () => Promise<void>;
    login: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    setUser: (user: AuthUser | null) => void;
};

export const useUserStore = create<UserStore>((set) => ({
    status: "idle",
    user: null,
    error: "",
    setUser: (user) => set({ user, status: user ? "authenticated" : "anonymous", error: "" }),
    bootstrap: async () => {
        set({ status: "loading", error: "" });
        try {
            const result = await fetchMe();
            set({ user: result.user, status: result.user ? "authenticated" : "anonymous", error: "" });
        } catch (error) {
            set({ user: null, status: "anonymous", error: error instanceof Error ? error.message : "获取登录状态失败" });
        }
    },
    login: async (username, password) => {
        set({ error: "" });
        const result = await loginRequest(username, password);
        set({ user: result.user, status: "authenticated", error: "" });
    },
    logout: async () => {
        try {
            await logoutRequest();
        } finally {
            set({ user: null, status: "anonymous", error: "" });
        }
    },
}));
