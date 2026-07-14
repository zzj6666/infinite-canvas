import { nanoid } from "nanoid";

type PublicMedia = { userId: string; storageKey: string; expiresAt: number };

const publicMedia = new Map<string, PublicMedia>();
const TTL_MS = 30 * 60 * 1000;

export function createPublicMediaToken(userId: string, storageKey: string) {
    const now = Date.now();
    for (const [token, value] of publicMedia) {
        if (value.expiresAt <= now) publicMedia.delete(token);
    }
    const token = nanoid();
    publicMedia.set(token, { userId, storageKey, expiresAt: now + TTL_MS });
    return token;
}

export function getPublicMediaToken(token: string) {
    const value = publicMedia.get(token);
    if (!value || value.expiresAt <= Date.now()) {
        publicMedia.delete(token);
        return null;
    }
    return value;
}
