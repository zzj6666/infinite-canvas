import { existsSync } from "node:fs";
import path from "node:path";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";

import { initDb } from "./db";
import { PORT, STATIC_DIR } from "./env";
import { adminUserRoutes } from "./routes/admin-users";
import { aiRoutes } from "./routes/ai";
import { assetRoutes } from "./routes/assets";
import { authRoutes } from "./routes/auth";
import { canvasRoutes } from "./routes/canvas";
import { mediaRoutes } from "./routes/media";
import { promptRoutes } from "./routes/prompts";
import { systemConfigRoutes } from "./routes/system-config";

initDb();

const app = new Hono();

app.use(
    "/api/*",
    cors({
        origin: (origin) => origin || "*",
        credentials: true,
        allowHeaders: ["Content-Type", "Authorization"],
        allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    }),
);

app.get("/api/health", (c) => c.json({ ok: true }));

app.route("/api/auth", authRoutes);
app.route("/api/admin/users", adminUserRoutes);
app.route("/api/system", systemConfigRoutes);
app.route("/api/canvas", canvasRoutes);
app.route("/api/assets", assetRoutes);
app.route("/api/prompts", promptRoutes);
app.route("/api/media", mediaRoutes);
app.route("/api/ai", aiRoutes);

const staticRoot = STATIC_DIR && existsSync(STATIC_DIR) ? STATIC_DIR : "";
if (staticRoot) {
    app.use("/*", serveStatic({ root: staticRoot }));
    app.get("*", async (c) => {
        const indexPath = path.join(staticRoot, "index.html");
        if (!existsSync(indexPath)) return c.text("index.html missing", 404);
        return new Response(Bun.file(indexPath), {
            headers: { "Content-Type": "text/html; charset=utf-8" },
        });
    });
} else {
    app.get("/", (c) => c.json({ ok: true, service: "infinite-canvas-server" }));
}

console.log(`[server] listening on http://0.0.0.0:${PORT}`);
export default {
    port: PORT,
    hostname: "0.0.0.0",
    fetch: app.fetch,
    idleTimeout: 255,
};
