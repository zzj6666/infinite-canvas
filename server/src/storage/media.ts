import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";

import { getDb } from "../db";
import { MEDIA_DIR } from "../env";

export function ensureUserMediaDir(userId: string) {
    const dir = path.join(MEDIA_DIR, userId);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

export async function saveUserMedia(userId: string, file: File, prefix = "file", preferredKey?: string) {
    const storageKey = preferredKey?.trim() || `${prefix}:${nanoid()}`;
    const safeName = storageKey.replace(/[^a-zA-Z0-9:_-]/g, "_");
    const dir = ensureUserMediaDir(userId);
    const filePath = path.join(dir, safeName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await Bun.write(filePath, buffer);
    const now = new Date().toISOString();
    const existing = getUserMedia(userId, storageKey);
    if (existing) {
        try {
            if (existing.path !== filePath && fs.existsSync(existing.path)) fs.unlinkSync(existing.path);
        } catch {
            // ignore
        }
        getDb()
            .query("UPDATE media_files SET mime = ?, bytes = ?, path = ? WHERE id = ?")
            .run(file.type || "application/octet-stream", buffer.byteLength, filePath, existing.id);
    } else {
        getDb()
            .query(
                `INSERT INTO media_files (id, user_id, storage_key, mime, bytes, path, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(nanoid(), userId, storageKey, file.type || "application/octet-stream", buffer.byteLength, filePath, now);
    }
    return {
        storageKey,
        url: `/api/media/${encodeURIComponent(storageKey)}`,
        bytes: buffer.byteLength,
        mimeType: file.type || "application/octet-stream",
    };
}

export function getUserMedia(userId: string, storageKey: string) {
    return getDb()
        .query("SELECT * FROM media_files WHERE user_id = ? AND storage_key = ?")
        .get(userId, storageKey) as
        | { id: string; user_id: string; storage_key: string; mime: string; bytes: number; path: string; created_at: string }
        | null;
}

export function deleteUserMedia(userId: string, storageKey: string) {
    const row = getUserMedia(userId, storageKey);
    if (!row) return false;
    try {
        if (fs.existsSync(row.path)) fs.unlinkSync(row.path);
    } catch {
        // ignore
    }
    getDb().query("DELETE FROM media_files WHERE id = ?").run(row.id);
    return true;
}
