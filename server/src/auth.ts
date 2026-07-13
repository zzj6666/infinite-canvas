import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { nanoid } from "nanoid";

import { findUserById, getDb, type SessionRow, type UserRow } from "./db";
import { SESSION_DAYS } from "./env";

const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
    return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return false;
    const actual = scryptSync(password, salt, SCRYPT_KEYLEN);
    const expected = Buffer.from(hash, "hex");
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
}

export function hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
}

export function createSession(userId: string) {
    const token = randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const now = new Date();
    const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    const id = nanoid();
    getDb()
        .query(
            `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
             VALUES (?, ?, ?, ?, ?)`,
        )
        .run(id, userId, tokenHash, expires.toISOString(), now.toISOString());
    return { token, expiresAt: expires };
}

export function deleteSessionByToken(token: string) {
    getDb().query("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}

export function deleteSessionsForUser(userId: string) {
    getDb().query("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

export function getUserBySessionToken(token: string): UserRow | null {
    if (!token) return null;
    const row = getDb().query("SELECT * FROM sessions WHERE token_hash = ?").get(hashToken(token)) as SessionRow | null;
    if (!row) return null;
    if (new Date(row.expires_at).getTime() < Date.now()) {
        getDb().query("DELETE FROM sessions WHERE id = ?").run(row.id);
        return null;
    }
    const user = findUserById(row.user_id);
    if (!user || user.disabled) return null;
    return user;
}
