import { Database } from "bun:sqlite";
import fs from "node:fs";
import { nanoid } from "nanoid";

import { ADMIN_PASSWORD, ADMIN_USERNAME, DATA_DIR, DB_PATH, MEDIA_DIR } from "./env";
import { hashPassword } from "./auth";

export type UserRole = "admin" | "user";

export type UserRow = {
    id: string;
    username: string;
    password_hash: string;
    display_name: string;
    role: UserRole;
    disabled: number;
    created_at: string;
};

export type PublicUser = {
    id: string;
    username: string;
    displayName: string;
    role: UserRole;
    disabled: boolean;
    createdAt: string;
};

export type SessionRow = {
    id: string;
    user_id: string;
    token_hash: string;
    expires_at: string;
    created_at: string;
};

let db: Database;

export function getDb() {
    if (!db) throw new Error("database not initialized");
    return db;
}

export function initDb() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            display_name TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
            disabled INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash TEXT NOT NULL UNIQUE,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS system_ai_config (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            config_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS canvas_projects (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            data_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_canvas_user ON canvas_projects(user_id);

        CREATE TABLE IF NOT EXISTS assets (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            kind TEXT NOT NULL,
            title TEXT NOT NULL,
            meta_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_assets_user ON assets(user_id);

        CREATE TABLE IF NOT EXISTS prompts (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            prompt TEXT NOT NULL,
            tags_json TEXT NOT NULL,
            category TEXT NOT NULL,
            note TEXT NOT NULL DEFAULT '',
            cover_url TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_prompts_user ON prompts(user_id);

        CREATE TABLE IF NOT EXISTS media_files (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            storage_key TEXT NOT NULL,
            mime TEXT NOT NULL,
            bytes INTEGER NOT NULL,
            path TEXT NOT NULL,
            created_at TEXT NOT NULL,
            UNIQUE(user_id, storage_key)
        );
        CREATE INDEX IF NOT EXISTS idx_media_user_key ON media_files(user_id, storage_key);
    `);

    ensureAdmin();
    ensureSystemConfig();
    return db;
}

function ensureAdmin() {
    const count = db.query("SELECT COUNT(*) AS c FROM users").get() as { c: number };
    if (count.c > 0) return;
    const now = new Date().toISOString();
    db.query(
        `INSERT INTO users (id, username, password_hash, display_name, role, disabled, created_at)
         VALUES (?, ?, ?, ?, 'admin', 0, ?)`,
    ).run(nanoid(), ADMIN_USERNAME, hashPassword(ADMIN_PASSWORD), "管理员", now);
    console.log(`[bootstrap] admin user created: ${ADMIN_USERNAME}`);
}

function ensureSystemConfig() {
    const row = db.query("SELECT id FROM system_ai_config WHERE id = 1").get();
    if (row) return;
    const now = new Date().toISOString();
    const defaultConfig = {
        channels: [
            {
                id: "default",
                name: "默认渠道",
                baseUrl: "https://api.openai.com",
                apiKey: "",
                apiFormat: "openai",
                models: ["gpt-image-2", "grok-imagine-video", "gpt-5.5", "gpt-4o-mini-tts"],
            },
        ],
        model: "default::gpt-image-2",
        imageModel: "default::gpt-image-2",
        videoModel: "default::grok-imagine-video",
        textModel: "default::gpt-5.5",
        audioModel: "default::gpt-4o-mini-tts",
        audioVoice: "alloy",
        audioFormat: "mp3",
        audioSpeed: "1",
        audioInstructions: "",
        videoSeconds: "6",
        vquality: "720",
        videoGenerateAudio: "true",
        videoWatermark: "false",
        systemPrompt: "",
        models: ["default::gpt-image-2", "default::grok-imagine-video", "default::gpt-5.5", "default::gpt-4o-mini-tts"],
        imageModels: ["default::gpt-image-2"],
        videoModels: ["default::grok-imagine-video"],
        textModels: ["default::gpt-5.5"],
        audioModels: ["default::gpt-4o-mini-tts"],
        quality: "auto",
        size: "1024x1024",
        count: "1",
        canvasImageCount: "3",
    };
    db.query("INSERT INTO system_ai_config (id, config_json, updated_at) VALUES (1, ?, ?)").run(JSON.stringify(defaultConfig), now);
}

export function toPublicUser(row: UserRow): PublicUser {
    return {
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        role: row.role,
        disabled: Boolean(row.disabled),
        createdAt: row.created_at,
    };
}

export function findUserByUsername(username: string) {
    return db.query("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(username) as UserRow | null;
}

export function findUserById(id: string) {
    return db.query("SELECT * FROM users WHERE id = ?").get(id) as UserRow | null;
}

export function listUsers() {
    return db.query("SELECT * FROM users ORDER BY created_at ASC").all() as UserRow[];
}
