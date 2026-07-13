import { Hono } from "hono";
import { nanoid } from "nanoid";

import { getDb } from "../db";
import type { AppVariables } from "../middleware";
import { requireAuth } from "../middleware";

type AssetRow = {
    id: string;
    user_id: string;
    kind: string;
    title: string;
    meta_json: string;
    created_at: string;
    updated_at: string;
};

function rowToAsset(row: AssetRow) {
    const meta = JSON.parse(row.meta_json) as Record<string, unknown>;
    return {
        id: row.id,
        kind: row.kind,
        title: row.title,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        ...meta,
    };
}

export const assetRoutes = new Hono<{ Variables: AppVariables }>();
assetRoutes.use("*", requireAuth);

assetRoutes.get("/", (c) => {
    const user = c.get("user");
    const rows = getDb().query("SELECT * FROM assets WHERE user_id = ? ORDER BY updated_at DESC").all(user.id) as AssetRow[];
    return c.json({ assets: rows.map(rowToAsset) });
});

assetRoutes.post("/", async (c) => {
    const user = c.get("user");
    const body = await c.req.json().catch(() => ({}));
    const kind = String(body.kind || "text");
    if (!["text", "image", "video"].includes(kind)) return c.json({ error: "无效素材类型" }, 400);
    const id = body.id || nanoid();
    const now = new Date().toISOString();
    const title = String(body.title || "未命名素材").trim() || "未命名素材";
    const meta = { ...body };
    delete meta.id;
    delete meta.kind;
    delete meta.title;
    delete meta.createdAt;
    delete meta.updatedAt;
    getDb()
        .query(
            `INSERT INTO assets (id, user_id, kind, title, meta_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(id, user.id, kind, title, JSON.stringify(meta), now, now);
    return c.json({ asset: { id, kind, title, createdAt: now, updatedAt: now, ...meta } }, 201);
});

assetRoutes.put("/:id", async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const existing = getDb().query("SELECT * FROM assets WHERE id = ? AND user_id = ?").get(id, user.id) as AssetRow | null;
    if (!existing) return c.json({ error: "素材不存在" }, 404);
    const body = await c.req.json().catch(() => ({}));
    const current = rowToAsset(existing);
    const next = { ...current, ...body, id, kind: current.kind, createdAt: current.createdAt, updatedAt: new Date().toISOString() };
    const title = String(next.title || current.title).trim() || current.title;
    const meta = { ...next };
    delete meta.id;
    delete meta.kind;
    delete meta.title;
    delete meta.createdAt;
    delete meta.updatedAt;
    getDb()
        .query("UPDATE assets SET title = ?, meta_json = ?, updated_at = ? WHERE id = ? AND user_id = ?")
        .run(title, JSON.stringify(meta), next.updatedAt, id, user.id);
    return c.json({ asset: { ...next, title } });
});

assetRoutes.delete("/:id", (c) => {
    const user = c.get("user");
    const result = getDb().query("DELETE FROM assets WHERE id = ? AND user_id = ?").run(c.req.param("id"), user.id);
    if (!result.changes) return c.json({ error: "素材不存在" }, 404);
    return c.json({ ok: true });
});

assetRoutes.post("/replace", async (c) => {
    const user = c.get("user");
    const body = await c.req.json().catch(() => ({}));
    const assets = Array.isArray(body.assets) ? body.assets : [];
    const db = getDb();
    const replace = db.transaction(() => {
        db.query("DELETE FROM assets WHERE user_id = ?").run(user.id);
        const now = new Date().toISOString();
        for (const item of assets) {
            const id = String(item.id || nanoid());
            const kind = String(item.kind || "text");
            const title = String(item.title || "未命名素材").trim() || "未命名素材";
            const meta = { ...item };
            delete meta.id;
            delete meta.kind;
            delete meta.title;
            delete meta.createdAt;
            delete meta.updatedAt;
            db.query(
                `INSERT INTO assets (id, user_id, kind, title, meta_json, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
            ).run(id, user.id, kind, title, JSON.stringify(meta), item.createdAt || now, item.updatedAt || now);
        }
    });
    replace();
    const rows = db.query("SELECT * FROM assets WHERE user_id = ? ORDER BY updated_at DESC").all(user.id) as AssetRow[];
    return c.json({ assets: rows.map(rowToAsset) });
});
