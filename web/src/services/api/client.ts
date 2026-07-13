export class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

async function parseError(response: Response) {
    try {
        const data = (await response.json()) as { error?: string; message?: string };
        return data.error || data.message || response.statusText || "请求失败";
    } catch {
        return response.statusText || "请求失败";
    }
}

export async function apiFetch(input: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers || {});
    if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }
    const response = await fetch(input, {
        ...init,
        headers,
        credentials: "include",
    });
    if (!response.ok) {
        throw new ApiError(await parseError(response), response.status);
    }
    return response;
}

export async function apiJson<T>(input: string, init: RequestInit = {}) {
    const response = await apiFetch(input, init);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
}
