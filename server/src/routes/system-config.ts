import { Hono } from "hono";

import { getDb } from "../db";
import type { AppVariables } from "../middleware";
import { requireAdmin, requireAuth } from "../middleware";

export const systemConfigRoutes = new Hono<{ Variables: AppVariables }>();

function readConfig() {
    const row = getDb().query("SELECT config_json, updated_at FROM system_ai_config WHERE id = 1").get() as
        | { config_json: string; updated_at: string }
        | null;
    if (!row) return { config: {}, updatedAt: new Date().toISOString() };
    return { config: JSON.parse(row.config_json) as Record<string, unknown>, updatedAt: row.updated_at };
}

function maskConfig(config: Record<string, unknown>) {
    const channels = Array.isArray(config.channels)
        ? config.channels.map((channel) => {
              const item = (channel || {}) as Record<string, unknown>;
              return {
                  ...item,
                  apiKey: item.apiKey ? "********" : "",
                  hasApiKey: Boolean(String(item.apiKey || "").trim()),
              };
          })
        : [];
    return {
        ...config,
        apiKey: config.apiKey ? "********" : "",
        hasApiKey: Boolean(String(config.apiKey || "").trim()) || channels.some((channel) => channel.hasApiKey),
        channels,
    };
}

systemConfigRoutes.get("/ai-config", requireAuth, (c) => {
    const user = c.get("user");
    const { config, updatedAt } = readConfig();
    if (user.role === "admin") return c.json({ config, updatedAt });
    return c.json({ config: maskConfig(config), updatedAt });
});

systemConfigRoutes.put("/ai-config", requireAuth, requireAdmin, async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object") return c.json({ error: "无效配置" }, 400);
    const incoming = body as Record<string, unknown>;
    const current = readConfig().config;

    // Preserve existing api keys when client sends masked placeholders.
    const currentChannels = Array.isArray(current.channels) ? (current.channels as Array<Record<string, unknown>>) : [];
    const nextChannels = Array.isArray(incoming.channels)
        ? (incoming.channels as Array<Record<string, unknown>>).map((channel) => {
              const prev = currentChannels.find((item) => item.id === channel.id);
              const apiKey = String(channel.apiKey || "");
              return {
                  ...channel,
                  apiKey: !apiKey || apiKey === "********" ? String(prev?.apiKey || "") : apiKey,
              };
          })
        : currentChannels;

    const nextApiKey = String(incoming.apiKey || "");
    const config = {
        ...current,
        ...incoming,
        apiKey: !nextApiKey || nextApiKey === "********" ? String(current.apiKey || "") : nextApiKey,
        channels: nextChannels,
    };

    const now = new Date().toISOString();
    getDb().query("UPDATE system_ai_config SET config_json = ?, updated_at = ? WHERE id = 1").run(JSON.stringify(config), now);
    return c.json({ config, updatedAt: now });
});

export function getSystemAiConfig() {
    return readConfig().config as Record<string, any>;
}
