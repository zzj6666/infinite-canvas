import { Hono } from "hono";
import { nanoid } from "nanoid";

import { getDb } from "../db";
import type { AppVariables } from "../middleware";
import { requireAuth } from "../middleware";

type ProjectRow = {
    id: string;
    user_id: string;
    title: string;
    data_json: string;
    created_at: string;
    updated_at: string;
};

const initialViewport = { x: 0, y: 0, k: 1 };

function rowToProject(row: ProjectRow) {
    const data = JSON.parse(row.data_json) as Record<string, unknown>;
    return {
        id: row.id,
        title: row.title,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        nodes: data.nodes || [],
        connections: data.connections || [],
        chatSessions: data.chatSessions || [],
        activeChatId: data.activeChatId ?? null,
        backgroundMode: data.backgroundMode || "lines",
        showImageInfo: Boolean(data.showImageInfo),
        viewport: data.viewport || initialViewport,
    };
}

function projectDataJson(project: Record<string, unknown>) {
    return JSON.stringify({
        nodes: project.nodes || [],
        connections: project.connections || [],
        chatSessions: project.chatSessions || [],
        activeChatId: project.activeChatId ?? null,
        backgroundMode: project.backgroundMode || "lines",
        showImageInfo: Boolean(project.showImageInfo),
        viewport: project.viewport || initialViewport,
    });
}

export const canvasRoutes = new Hono<{ Variables: AppVariables }>();
canvasRoutes.use("*", requireAuth);

canvasRoutes.get("/projects", (c) => {
    const user = c.get("user");
    const rows = getDb()
        .query("SELECT * FROM canvas_projects WHERE user_id = ? ORDER BY updated_at DESC")
        .all(user.id) as ProjectRow[];
    return c.json({ projects: rows.map(rowToProject) });
});

canvasRoutes.post("/projects", async (c) => {
    const user = c.get("user");
    const body = await c.req.json().catch(() => ({}));
    const id = nanoid();
    const now = new Date().toISOString();
    const title = String(body.title || "未命名画布").trim() || "未命名画布";
    const project = {
        id,
        title,
        createdAt: now,
        updatedAt: now,
        nodes: body.nodes || [],
        connections: body.connections || [],
        chatSessions: body.chatSessions || [],
        activeChatId: body.activeChatId ?? null,
        backgroundMode: body.backgroundMode || "lines",
        showImageInfo: Boolean(body.showImageInfo),
        viewport: body.viewport || initialViewport,
    };
    getDb()
        .query(
            `INSERT INTO canvas_projects (id, user_id, title, data_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(id, user.id, title, projectDataJson(project), now, now);
    return c.json({ project }, 201);
});

canvasRoutes.get("/projects/:id", (c) => {
    const user = c.get("user");
    const row = getDb().query("SELECT * FROM canvas_projects WHERE id = ? AND user_id = ?").get(c.req.param("id"), user.id) as ProjectRow | null;
    if (!row) return c.json({ error: "画布不存在" }, 404);
    return c.json({ project: rowToProject(row) });
});

canvasRoutes.put("/projects/:id", async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const existing = getDb().query("SELECT * FROM canvas_projects WHERE id = ? AND user_id = ?").get(id, user.id) as ProjectRow | null;
    if (!existing) return c.json({ error: "画布不存在" }, 404);

    const body = await c.req.json().catch(() => ({}));
    const current = rowToProject(existing);
    const next = {
        ...current,
        ...body,
        id,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
        title: body.title !== undefined ? String(body.title || "").trim() || current.title : current.title,
    };
    getDb()
        .query("UPDATE canvas_projects SET title = ?, data_json = ?, updated_at = ? WHERE id = ? AND user_id = ?")
        .run(next.title, projectDataJson(next), next.updatedAt, id, user.id);
    return c.json({ project: next });
});

canvasRoutes.delete("/projects/:id", (c) => {
    const user = c.get("user");
    const result = getDb().query("DELETE FROM canvas_projects WHERE id = ? AND user_id = ?").run(c.req.param("id"), user.id);
    if (!result.changes) return c.json({ error: "画布不存在" }, 404);
    return c.json({ ok: true });
});

canvasRoutes.post("/projects/delete", async (c) => {
    const user = c.get("user");
    const body = await c.req.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
    if (!ids.length) return c.json({ error: "请提供 ids" }, 400);
    const placeholders = ids.map(() => "?").join(",");
    getDb()
        .query(`DELETE FROM canvas_projects WHERE user_id = ? AND id IN (${placeholders})`)
        .run(user.id, ...ids);
    return c.json({ ok: true });
});
