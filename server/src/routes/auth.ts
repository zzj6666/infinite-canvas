import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import { createSession, deleteSessionByToken, getUserBySessionToken, verifyPassword } from "../auth";
import { findUserByUsername, toPublicUser } from "../db";
import { COOKIE_SECURE, SESSION_COOKIE, SESSION_DAYS } from "../env";
import type { AppVariables } from "../middleware";
import { requireAuth } from "../middleware";

export const authRoutes = new Hono<{ Variables: AppVariables }>();

authRoutes.post("/login", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    if (!username || !password) return c.json({ error: "请输入用户名和密码" }, 400);

    const user = findUserByUsername(username);
    if (!user || !verifyPassword(password, user.password_hash)) {
        return c.json({ error: "用户名或密码错误" }, 401);
    }
    if (user.disabled) return c.json({ error: "账号已禁用" }, 403);

    const session = createSession(user.id);
    setCookie(c, SESSION_COOKIE, session.token, {
        httpOnly: true,
        path: "/",
        sameSite: "Lax",
        secure: COOKIE_SECURE,
        expires: session.expiresAt,
        maxAge: SESSION_DAYS * 24 * 60 * 60,
    });
    return c.json({ user: toPublicUser(user) });
});

authRoutes.post("/logout", async (c) => {
    const token = getCookie(c, SESSION_COOKIE) || "";
    if (token) deleteSessionByToken(token);
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.json({ ok: true });
});

authRoutes.get("/me", async (c) => {
    const token = getCookie(c, SESSION_COOKIE) || "";
    const user = getUserBySessionToken(token);
    if (!user) return c.json({ user: null });
    return c.json({ user: toPublicUser(user) });
});

authRoutes.get("/session", requireAuth, async (c) => {
    return c.json({ user: toPublicUser(c.get("user")) });
});
