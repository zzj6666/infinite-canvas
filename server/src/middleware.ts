import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";

import { getUserBySessionToken } from "./auth";
import { toPublicUser, type UserRow } from "./db";
import { SESSION_COOKIE } from "./env";

export type AppVariables = {
    user: UserRow;
};

export async function requireAuth(c: Context<{ Variables: AppVariables }>, next: Next) {
    const token = getCookie(c, SESSION_COOKIE) || "";
    const user = getUserBySessionToken(token);
    if (!user) return c.json({ error: "未登录" }, 401);
    c.set("user", user);
    await next();
}

export async function requireAdmin(c: Context<{ Variables: AppVariables }>, next: Next) {
    const user = c.get("user");
    if (!user || user.role !== "admin") return c.json({ error: "需要管理员权限" }, 403);
    await next();
}

export function publicUserFromContext(c: Context<{ Variables: AppVariables }>) {
    return toPublicUser(c.get("user"));
}
