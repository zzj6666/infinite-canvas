import { Hono } from "hono";
import { nanoid } from "nanoid";

import { deleteSessionsForUser, hashPassword } from "../auth";
import { findUserById, findUserByUsername, getDb, listUsers, toPublicUser, type UserRole } from "../db";
import type { AppVariables } from "../middleware";
import { requireAdmin, requireAuth } from "../middleware";

export const adminUserRoutes = new Hono<{ Variables: AppVariables }>();

adminUserRoutes.use("*", requireAuth, requireAdmin);

adminUserRoutes.get("/", (c) => {
    return c.json({ users: listUsers().map(toPublicUser) });
});

adminUserRoutes.post("/", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    const displayName = String(body.displayName || username).trim() || username;
    const role = (body.role === "admin" ? "admin" : "user") as UserRole;

    if (!username || username.length < 2) return c.json({ error: "用户名至少 2 个字符" }, 400);
    if (!password || password.length < 6) return c.json({ error: "密码至少 6 个字符" }, 400);
    if (findUserByUsername(username)) return c.json({ error: "用户名已存在" }, 409);

    const id = nanoid();
    const now = new Date().toISOString();
    getDb()
        .query(
            `INSERT INTO users (id, username, password_hash, display_name, role, disabled, created_at)
             VALUES (?, ?, ?, ?, ?, 0, ?)`,
        )
        .run(id, username, hashPassword(password), displayName, role, now);

    const user = findUserById(id);
    return c.json({ user: user ? toPublicUser(user) : null }, 201);
});

adminUserRoutes.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const user = findUserById(id);
    if (!user) return c.json({ error: "用户不存在" }, 404);

    const body = await c.req.json().catch(() => ({}));
    const displayName = body.displayName !== undefined ? String(body.displayName || "").trim() || user.display_name : user.display_name;
    const role = body.role === "admin" || body.role === "user" ? (body.role as UserRole) : user.role;
    const disabled = body.disabled !== undefined ? (body.disabled ? 1 : 0) : user.disabled;
    const password = body.password !== undefined ? String(body.password || "") : "";

    if (user.role === "admin" && role !== "admin") {
        const admins = listUsers().filter((item) => item.role === "admin" && !item.disabled && item.id !== id);
        if (!admins.length) return c.json({ error: "至少保留一个可用管理员" }, 400);
    }
    if (user.role === "admin" && disabled) {
        const admins = listUsers().filter((item) => item.role === "admin" && !item.disabled && item.id !== id);
        if (!admins.length) return c.json({ error: "至少保留一个可用管理员" }, 400);
    }

    if (password) {
        if (password.length < 6) return c.json({ error: "密码至少 6 个字符" }, 400);
        getDb()
            .query("UPDATE users SET display_name = ?, role = ?, disabled = ?, password_hash = ? WHERE id = ?")
            .run(displayName, role, disabled, hashPassword(password), id);
        deleteSessionsForUser(id);
    } else {
        getDb().query("UPDATE users SET display_name = ?, role = ?, disabled = ? WHERE id = ?").run(displayName, role, disabled, id);
        if (disabled) deleteSessionsForUser(id);
    }

    const next = findUserById(id);
    return c.json({ user: next ? toPublicUser(next) : null });
});

adminUserRoutes.delete("/:id", (c) => {
    const id = c.req.param("id");
    const current = c.get("user");
    if (id === current.id) return c.json({ error: "不能删除当前登录账号" }, 400);
    const user = findUserById(id);
    if (!user) return c.json({ error: "用户不存在" }, 404);
    if (user.role === "admin") {
        const admins = listUsers().filter((item) => item.role === "admin" && item.id !== id);
        if (!admins.length) return c.json({ error: "至少保留一个管理员" }, 400);
    }
    getDb().query("DELETE FROM users WHERE id = ?").run(id);
    return c.json({ ok: true });
});
