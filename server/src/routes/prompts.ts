import { Hono } from "hono";
import { nanoid } from "nanoid";

import { getDb } from "../db";
import type { AppVariables } from "../middleware";
import { requireAuth } from "../middleware";

type PromptRow = {
    id: string;
    user_id: string;
    title: string;
    prompt: string;
    tags_json: string;
    category: string;
    note: string;
    cover_url: string;
    created_at: string;
    updated_at: string;
};

function rowToPrompt(row: PromptRow) {
    return {
        id: row.id,
        title: row.title,
        prompt: row.prompt,
        tags: JSON.parse(row.tags_json || "[]") as string[],
        category: row.category,
        note: row.note || "",
        coverUrl: row.cover_url || "",
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export const promptRoutes = new Hono<{ Variables: AppVariables }>();
promptRoutes.use("*", requireAuth);

promptRoutes.get("/", (c) => {
    const user = c.get("user");
    const rows = getDb().query("SELECT * FROM prompts WHERE user_id = ? ORDER BY updated_at DESC").all(user.id) as PromptRow[];
    return c.json({ prompts: rows.map(rowToPrompt) });
});

promptRoutes.post("/", async (c) => {
    const user = c.get("user");
    const body = await c.req.json().catch(() => ({}));
    const title = String(body.title || "").trim();
    const prompt = String(body.prompt || "").trim();
    if (!title) return c.json({ error: "请填写标题" }, 400);
    if (!prompt) return c.json({ error: "请填写提示词内容" }, 400);
    const id = nanoid();
    const now = new Date().toISOString();
    const tags = Array.isArray(body.tags) ? body.tags.map(String) : [];
    const category = String(body.category || "默认").trim() || "默认";
    const note = String(body.note || "");
    const coverUrl = String(body.coverUrl || "");
    getDb()
        .query(
            `INSERT INTO prompts (id, user_id, title, prompt, tags_json, category, note, cover_url, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(id, user.id, title, prompt, JSON.stringify(tags), category, note, coverUrl, now, now);
    return c.json({
        prompt: { id, title, prompt, tags, category, note, coverUrl, createdAt: now, updatedAt: now },
    }, 201);
});

promptRoutes.put("/:id", async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const existing = getDb().query("SELECT * FROM prompts WHERE id = ? AND user_id = ?").get(id, user.id) as PromptRow | null;
    if (!existing) return c.json({ error: "提示词不存在" }, 404);
    const body = await c.req.json().catch(() => ({}));
    const current = rowToPrompt(existing);
    const next = {
        ...current,
        title: body.title !== undefined ? String(body.title || "").trim() || current.title : current.title,
        prompt: body.prompt !== undefined ? String(body.prompt || "").trim() || current.prompt : current.prompt,
        tags: body.tags !== undefined ? (Array.isArray(body.tags) ? body.tags.map(String) : current.tags) : current.tags,
        category: body.category !== undefined ? String(body.category || "").trim() || current.category : current.category,
        note: body.note !== undefined ? String(body.note || "") : current.note,
        coverUrl: body.coverUrl !== undefined ? String(body.coverUrl || "") : current.coverUrl,
        updatedAt: new Date().toISOString(),
    };
    getDb()
        .query(
            `UPDATE prompts SET title = ?, prompt = ?, tags_json = ?, category = ?, note = ?, cover_url = ?, updated_at = ?
             WHERE id = ? AND user_id = ?`,
        )
        .run(next.title, next.prompt, JSON.stringify(next.tags), next.category, next.note, next.coverUrl, next.updatedAt, id, user.id);
    return c.json({ prompt: next });
});

promptRoutes.delete("/:id", (c) => {
    const user = c.get("user");
    const result = getDb().query("DELETE FROM prompts WHERE id = ? AND user_id = ?").run(c.req.param("id"), user.id);
    if (!result.changes) return c.json({ error: "提示词不存在" }, 404);
    return c.json({ ok: true });
});
