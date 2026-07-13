import { apiJson } from "./client";

export type AuthUser = {
    id: string;
    username: string;
    displayName: string;
    role: "admin" | "user";
    disabled: boolean;
    createdAt: string;
};

export async function login(username: string, password: string) {
    return apiJson<{ user: AuthUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
    });
}

export async function logout() {
    return apiJson<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
}

export async function fetchMe() {
    return apiJson<{ user: AuthUser | null }>("/api/auth/me");
}

export async function listUsers() {
    return apiJson<{ users: AuthUser[] }>("/api/admin/users");
}

export async function createUser(input: { username: string; password: string; displayName?: string; role?: "admin" | "user" }) {
    return apiJson<{ user: AuthUser }>("/api/admin/users", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

export async function updateUser(id: string, patch: { displayName?: string; password?: string; role?: "admin" | "user"; disabled?: boolean }) {
    return apiJson<{ user: AuthUser }>(`/api/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
    });
}

export async function deleteUser(id: string) {
    return apiJson<{ ok: boolean }>(`/api/admin/users/${id}`, { method: "DELETE" });
}
