import { Hono } from "hono";

import type { AppVariables } from "../middleware";
import { requireAuth } from "../middleware";
import { deleteUserMedia, getUserMedia, saveUserMedia } from "../storage/media";
import { getPublicMediaToken } from "../storage/public-media";

export const mediaRoutes = new Hono<{ Variables: AppVariables }>();

mediaRoutes.get("/shared/:token", async (c) => {
    const shared = getPublicMediaToken(c.req.param("token"));
    if (!shared) return c.json({ error: "素材链接已失效" }, 404);
    const row = getUserMedia(shared.userId, shared.storageKey);
    if (!row) return c.json({ error: "文件不存在" }, 404);
    const file = Bun.file(row.path);
    if (!(await file.exists())) return c.json({ error: "文件不存在" }, 404);
    return new Response(file, {
        headers: {
            "Content-Type": row.mime || "application/octet-stream",
            "Cache-Control": "public, max-age=1800",
        },
    });
});

mediaRoutes.use("*", requireAuth);

mediaRoutes.post("/", async (c) => {
    const user = c.get("user");
    const form = await c.req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return c.json({ error: "请上传 file" }, 400);
    const prefix = String(form.get("prefix") || "file");
    const storageKey = form.get("storageKey") ? String(form.get("storageKey")) : undefined;
    const saved = await saveUserMedia(user.id, file, prefix, storageKey);
    return c.json(saved, 201);
});

mediaRoutes.get("/:key", async (c) => {
    const user = c.get("user");
    const storageKey = decodeURIComponent(c.req.param("key"));
    const row = getUserMedia(user.id, storageKey);
    if (!row) return c.json({ error: "文件不存在" }, 404);
    const file = Bun.file(row.path);
    if (!(await file.exists())) return c.json({ error: "文件不存在" }, 404);
    return new Response(file, {
        headers: {
            "Content-Type": row.mime || "application/octet-stream",
            "Cache-Control": "private, max-age=3600",
        },
    });
});

mediaRoutes.delete("/:key", (c) => {
    const user = c.get("user");
    const storageKey = decodeURIComponent(c.req.param("key"));
    if (!deleteUserMedia(user.id, storageKey)) return c.json({ error: "文件不存在" }, 404);
    return c.json({ ok: true });
});
