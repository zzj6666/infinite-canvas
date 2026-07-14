import path from "node:path";

export const PORT = Number(process.env.PORT) || 3000;
export const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"));
export const DB_PATH = path.join(DATA_DIR, "app.db");
export const MEDIA_DIR = path.join(DATA_DIR, "media");
export const STATIC_DIR = process.env.STATIC_DIR ? path.resolve(process.env.STATIC_DIR) : "";
export const PUBLIC_ORIGIN = (process.env.PUBLIC_ORIGIN || "").trim().replace(/\/+$/, "");
export const SESSION_COOKIE = "ic_session";
export const SESSION_DAYS = Number(process.env.SESSION_DAYS) || 30;
export const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || "admin").trim() || "admin";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
export const COOKIE_SECURE = process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";
