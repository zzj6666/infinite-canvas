import { Hono } from "hono";

import { assertProviderReady, buildApiUrl, loadSystemConfig, modelOptionName, resolveModelRequestConfig, type ApiCallFormat } from "../ai/config";
import { PUBLIC_ORIGIN } from "../env";
import type { AppVariables } from "../middleware";
import { requireAdmin, requireAuth } from "../middleware";
import { createPublicMediaToken } from "../storage/public-media";

export const aiRoutes = new Hono<{ Variables: AppVariables }>();
aiRoutes.use("*", requireAuth);

const arkPlanModels = ["doubao-seed-2.0-mini", "doubao-seed-2.0-lite", "deepseek-v4-flash", "doubao-seed-2.0-code", "doubao-seed-2.0-pro", "deepseek-v4-pro", "minimax-m2.7", "minimax-m3", "glm-5.1", "kimi-k2.6", "doubao-embedding-vision", "doubao-seedream-5.0-lite", "doubao-seedance-2.0"];

function openaiHeaders(apiKey: string, contentType?: string) {
    return {
        Authorization: `Bearer ${apiKey}`,
        ...(contentType ? { "Content-Type": contentType } : {}),
    };
}

function geminiHeaders(apiKey: string) {
    return { "x-goog-api-key": apiKey, "Content-Type": "application/json" };
}

function geminiBaseUrl(baseUrl: string) {
    const normalized = baseUrl.trim().replace(/\/+$/, "");
    if (normalized.includes("/v1beta")) return normalized.replace(/\/+$/, "");
    return `${normalized}/v1beta`;
}

async function readUpstreamError(response: Response, fallback: string) {
    try {
        const text = await response.text();
        try {
            const json = JSON.parse(text) as { error?: { message?: string }; msg?: string; message?: string };
            return json.error?.message || json.msg || json.message || text || fallback;
        } catch {
            return text || fallback;
        }
    } catch {
        return fallback;
    }
}

aiRoutes.post("/models", requireAdmin, async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object") return c.json({ error: "无效渠道配置" }, 400);
    const input = body as Record<string, unknown>;
    const apiFormat: ApiCallFormat = input.apiFormat === "gemini" ? "gemini" : input.apiFormat === "ark" ? "ark" : "openai";
    const channel = {
        baseUrl: String(input.baseUrl || ""),
        apiKey: String(input.apiKey || ""),
        apiFormat,
    };
    assertProviderReady({ baseUrl: channel.baseUrl, apiKey: channel.apiKey, model: "x" });

    const normalizedBaseUrl = channel.baseUrl.trim().replace(/\/+$/, "");
    if (channel.apiFormat === "ark" && /\/api\/plan\/v3$/i.test(normalizedBaseUrl)) return c.json({ models: arkPlanModels });

    if (channel.apiFormat === "gemini") {
        const url = `${geminiBaseUrl(channel.baseUrl)}/models`;
        const response = await fetch(url, { headers: geminiHeaders(channel.apiKey) });
        if (!response.ok) return c.json({ error: await readUpstreamError(response, "读取模型失败") }, 502);
        const data = (await response.json()) as { models?: Array<{ name?: string }> };
        const models = (data.models || [])
            .map((model) => model.name?.replace(/^models\//, ""))
            .filter((id): id is string => Boolean(id))
            .sort((a, b) => a.localeCompare(b));
        return c.json({ models });
    }

    const response = await fetch(buildApiUrl(channel.baseUrl, "/models"), {
        headers: { Authorization: `Bearer ${channel.apiKey}` },
    });
    if (!response.ok) return c.json({ error: await readUpstreamError(response, "读取模型失败") }, 502);
    const data = (await response.json()) as { data?: Array<{ id?: string }> };
    const models = (data.data || [])
        .map((model) => model.id)
        .filter((id): id is string => Boolean(id))
        .sort((a, b) => a.localeCompare(b));
    return c.json({ models });
});

aiRoutes.post("/images/generations", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const config = loadSystemConfig();
    const selectedModel = String(body.model || config.imageModel || config.model || "");
    const request = resolveModelRequestConfig(config, selectedModel);
    assertProviderReady(request);
    const prompt = String(body.prompt || "");
    if (!prompt.trim()) return c.json({ error: "请输入提示词" }, 400);
    const isGptImage = isGptImageModel(request.model);
    const n = Math.max(1, Math.min(4, Math.floor(Math.abs(Number(body.count ?? config.count)) || 1)));
    const quality = body.quality || config.quality;
    const size = normalizeOpenAISize(String(body.size || config.size || ""), request.model);
    const sizeError = validateGptImage2Size(request.model, size);
    if (sizeError) return c.json({ error: sizeError }, 400);
    const systemPrompt = config.systemPrompt?.trim();
    const finalPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

    if (request.apiFormat === "gemini") {
        const url = `${geminiBaseUrl(request.baseUrl)}/models/${encodeURIComponent(request.model)}:generateContent`;
        const response = await fetch(url, {
            method: "POST",
            headers: geminiHeaders(request.apiKey),
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: finalPrompt }] }],
                generationConfig: {
                    responseModalities: ["TEXT", "IMAGE"],
                    candidateCount: 1,
                },
            }),
        });
        if (!response.ok) return c.json({ error: await readUpstreamError(response, "生图失败") }, 502);
        const data = (await response.json()) as any;
        const images =
            data.candidates?.[0]?.content?.parts
                ?.map((part: any) => {
                    const inline = part.inlineData || part.inline_data;
                    if (inline?.data) return { id: crypto.randomUUID(), dataUrl: `data:${inline.mimeType || inline.mime_type || "image/png"};base64,${inline.data}` };
                    return null;
                })
                .filter(Boolean) || [];
        if (!images.length) return c.json({ error: "Gemini 接口没有返回图片" }, 502);
        // Gemini often returns 1; expand by repeating requests if n>1 would be heavy — return what we have.
        return c.json({ images });
    }

    const response = await fetch(buildApiUrl(request.baseUrl, "/images/generations"), {
        method: "POST",
        headers: openaiHeaders(request.apiKey, "application/json"),
        body: JSON.stringify({
            model: request.model,
            prompt: finalPrompt,
            n,
            ...(quality && quality !== "auto" ? { quality } : {}),
            ...(size ? { size } : {}),
            ...(isGptImage ? {} : { response_format: "b64_json" }),
            output_format: "png",
        }),
    });
    if (!response.ok) return c.json({ error: await readUpstreamError(response, "生图失败") }, 502);
    const data = (await response.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
    const images = (data.data || []).map((item) => ({
        id: crypto.randomUUID(),
        dataUrl: item.b64_json ? `data:image/png;base64,${item.b64_json}` : item.url || "",
    })).filter((item) => item.dataUrl);
    if (!images.length) return c.json({ error: "接口没有返回图片" }, 502);
    return c.json({ images });
});

aiRoutes.post("/images/edits", async (c) => {
    const form = await c.req.formData();
    const config = loadSystemConfig();
    const selectedModel = String(form.get("model") || config.imageModel || config.model || "");
    const request = resolveModelRequestConfig(config, selectedModel);
    assertProviderReady(request);
    if (request.apiFormat === "gemini") return c.json({ error: "请使用 JSON 接口进行 Gemini 图生图" }, 400);

    const prompt = String(form.get("prompt") || "");
    const systemPrompt = config.systemPrompt?.trim();
    const finalPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
    const upstream = new FormData();
    upstream.set("model", request.model);
    upstream.set("prompt", finalPrompt);
    const isGptImage = isGptImageModel(request.model);
    const inputImageCount = form.getAll("image").filter((value): value is File => value instanceof File).length;
    if (isGptImage && inputImageCount > 16) return c.json({ error: "GPT Image 模型最多支持 16 张参考图" }, 400);
    const n = Math.max(1, Math.min(4, Math.floor(Math.abs(Number(form.get("n") || config.count)) || 1)));
    const size = normalizeOpenAISize(String(form.get("size") || config.size || ""), request.model);
    const sizeError = validateGptImage2Size(request.model, size);
    if (sizeError) return c.json({ error: sizeError }, 400);
    upstream.set("n", String(n));
    if (!isGptImage) upstream.set("response_format", "b64_json");
    upstream.set("output_format", "png");
    const quality = form.get("quality");
    if (quality && quality !== "auto") upstream.set("quality", String(quality));
    if (size) upstream.set("size", size);
    for (const [key, value] of form.entries()) {
        if (key === "image" || key === "mask") {
            if (value instanceof File) upstream.append(isGptImage && key === "image" ? "image[]" : key, value);
        }
    }

    const response = await fetch(buildApiUrl(request.baseUrl, "/images/edits"), {
        method: "POST",
        headers: { Authorization: `Bearer ${request.apiKey}` },
        body: upstream,
    });
    if (!response.ok) return c.json({ error: await readUpstreamError(response, "图生图失败") }, 502);
    const data = (await response.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
    const images = (data.data || []).map((item) => ({
        id: crypto.randomUUID(),
        dataUrl: item.b64_json ? `data:image/png;base64,${item.b64_json}` : item.url || "",
    })).filter((item) => item.dataUrl);
    if (!images.length) return c.json({ error: "接口没有返回图片" }, 502);
    return c.json({ images });
});

aiRoutes.post("/responses", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const config = loadSystemConfig();
    const selectedModel = String(body.model || config.textModel || config.model || "");
    const request = resolveModelRequestConfig(config, selectedModel);
    assertProviderReady(request);
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) return c.json({ error: "messages 不能为空" }, 400);

    if (request.apiFormat === "gemini") {
        const contents = messages
            .filter((item: any) => item.role !== "system")
            .map((item: any) => ({
                role: item.role === "assistant" ? "model" : "user",
                parts: typeof item.content === "string" ? [{ text: item.content }] : [{ text: JSON.stringify(item.content) }],
            }));
        const systemInstruction = messages.find((item: any) => item.role === "system")?.content || config.systemPrompt || "";
        const url = `${geminiBaseUrl(request.baseUrl)}/models/${encodeURIComponent(request.model)}:generateContent`;
        const response = await fetch(url, {
            method: "POST",
            headers: geminiHeaders(request.apiKey),
            body: JSON.stringify({
                contents,
                ...(systemInstruction ? { systemInstruction: { parts: [{ text: String(systemInstruction) }] } } : {}),
            }),
        });
        if (!response.ok) return c.json({ error: await readUpstreamError(response, "文本请求失败") }, 502);
        const data = (await response.json()) as any;
        const content =
            data.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("") ||
            "没有返回内容";
        return c.json({ content });
    }

    const input = [];
    if (config.systemPrompt?.trim()) input.push({ role: "system", content: config.systemPrompt });
    for (const message of messages) input.push(message);
    const response = await fetch(buildApiUrl(request.baseUrl, "/responses"), {
        method: "POST",
        headers: openaiHeaders(request.apiKey, "application/json"),
        body: JSON.stringify({ model: request.model, input }),
    });
    if (!response.ok) return c.json({ error: await readUpstreamError(response, "文本请求失败") }, 502);
    const data = (await response.json()) as any;
    const content =
        data.output_text ||
        data.output?.map((item: any) => item.content?.map((part: any) => part.text || "").join("") || "").join("") ||
        data.choices?.[0]?.message?.content ||
        "没有返回内容";
    return c.json({ content: String(content || "没有返回内容") });
});

aiRoutes.post("/audio/speech", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const config = loadSystemConfig();
    const selectedModel = String(body.model || config.audioModel || config.model || "");
    const request = resolveModelRequestConfig(config, selectedModel);
    assertProviderReady(request);
    if (request.apiFormat === "gemini") return c.json({ error: "Gemini 调用格式暂不支持音频生成" }, 400);
    const prompt = String(body.prompt || body.input || "");
    if (!prompt.trim()) return c.json({ error: "请输入文本" }, 400);

    const response = await fetch(buildApiUrl(request.baseUrl, "/audio/speech"), {
        method: "POST",
        headers: openaiHeaders(request.apiKey, "application/json"),
        body: JSON.stringify({
            model: request.model,
            input: prompt,
            voice: body.voice || config.audioVoice || "alloy",
            response_format: body.format || config.audioFormat || "mp3",
            speed: Number(body.speed || config.audioSpeed || 1),
            ...(body.instructions || config.audioInstructions ? { instructions: body.instructions || config.audioInstructions } : {}),
        }),
    });
    if (!response.ok) return c.json({ error: await readUpstreamError(response, "音频生成失败") }, 502);
    return new Response(response.body, {
        headers: {
            "Content-Type": response.headers.get("Content-Type") || "audio/mpeg",
        },
    });
});

aiRoutes.post("/videos", async (c) => {
    const contentType = c.req.header("content-type") || "";
    const config = loadSystemConfig();
    if (contentType.includes("multipart/form-data")) {
        const form = await c.req.formData();
        const selectedModel = String(form.get("model") || config.videoModel || config.model || "");
        const request = resolveModelRequestConfig(config, selectedModel);
        assertProviderReady(request);
        if (request.apiFormat === "gemini") return c.json({ error: "Gemini 调用格式暂不支持视频生成" }, 400);
        const upstream = new FormData();
        upstream.append("model", modelOptionName(selectedModel) || request.model);
        for (const [key, value] of form.entries()) {
            if (key === "model") continue;
            upstream.append(key, value);
        }
        const response = await fetch(buildApiUrl(request.baseUrl, "/videos"), {
            method: "POST",
            headers: { Authorization: `Bearer ${request.apiKey}` },
            body: upstream,
        });
        if (!response.ok) return c.json({ error: await readUpstreamError(response, "视频任务创建失败") }, 502);
        return c.json(await response.json());
    }

    const body = await c.req.json().catch(() => ({}));
    const selectedModel = String(body.model || config.videoModel || config.model || "");
    const request = resolveModelRequestConfig(config, selectedModel);
    assertProviderReady(request);
    const user = c.get("user");
    // Seedance / plan style JSON
    const base = request.baseUrl.trim().replace(/\/+$/, "");
    const url = /\/api\/plan\/v3$/i.test(base) || base.includes("/contents/generations/tasks")
        ? `${base.replace(/\/contents\/generations\/tasks.*/, "")}/contents/generations/tasks`
        : `${base}/contents/generations/tasks`;
    const response = await fetch(url, {
        method: "POST",
        headers: openaiHeaders(request.apiKey, "application/json"),
        body: JSON.stringify({ ...body, model: modelOptionName(selectedModel) || request.model, content: publicArkContent(body.content, c.req.url, user.id) }),
    });
    if (!response.ok) return c.json({ error: await readUpstreamError(response, "视频任务创建失败") }, 502);
    return c.json(await response.json());
});

aiRoutes.get("/videos/:id", async (c) => {
    const config = loadSystemConfig();
    const selectedModel = String(c.req.query("model") || config.videoModel || config.model || "");
    const request = resolveModelRequestConfig(config, selectedModel);
    assertProviderReady(request);
    const provider = c.req.query("provider") || "openai";
    const id = c.req.param("id");
    const url =
        provider === "seedance"
            ? seedanceTaskUrl(request.baseUrl, id)
            : buildApiUrl(request.baseUrl, `/videos/${encodeURIComponent(id)}`);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${request.apiKey}` } });
    if (!response.ok) return c.json({ error: await readUpstreamError(response, "视频任务查询失败") }, 502);
    return c.json(await response.json());
});

aiRoutes.get("/videos/:id/content", async (c) => {
    const config = loadSystemConfig();
    const selectedModel = String(c.req.query("model") || config.videoModel || config.model || "");
    const request = resolveModelRequestConfig(config, selectedModel);
    assertProviderReady(request);
    const id = c.req.param("id");
    const response = await fetch(buildApiUrl(request.baseUrl, `/videos/${encodeURIComponent(id)}/content`), {
        headers: { Authorization: `Bearer ${request.apiKey}` },
    });
    if (!response.ok) return c.json({ error: await readUpstreamError(response, "下载视频失败") }, 502);
    return new Response(response.body, {
        headers: {
            "Content-Type": response.headers.get("Content-Type") || "video/mp4",
        },
    });
});

function seedanceTaskUrl(baseUrl: string, taskId?: string) {
    const base = baseUrl.trim().replace(/\/+$/, "");
    if (base.includes("/contents/generations/tasks")) {
        return taskId ? `${base.replace(/\/$/, "")}/${encodeURIComponent(taskId)}` : base;
    }
    if (/\/api\/plan\/v3$/i.test(base)) return `${base}/contents/generations/tasks${taskId ? `/${encodeURIComponent(taskId)}` : ""}`;
    return `${base}/contents/generations/tasks${taskId ? `/${encodeURIComponent(taskId)}` : ""}`;
}

function publicArkContent(value: unknown, requestUrl: string, userId: string) {
    if (!Array.isArray(value)) return value;
    const origin = PUBLIC_ORIGIN || new URL(requestUrl).origin;
    return value.map((item) => {
        if (!item || typeof item !== "object") return item;
        const content = { ...(item as Record<string, unknown>) };
        for (const key of ["image_url", "video_url", "audio_url"] as const) {
            const media = content[key];
            if (!media || typeof media !== "object") continue;
            const url = String((media as Record<string, unknown>).url || "");
            if (!url.startsWith("media://")) continue;
            const storageKey = decodeURIComponent(url.slice("media://".length));
            content[key] = { ...(media as Record<string, unknown>), url: `${origin}/api/media/shared/${createPublicMediaToken(userId, storageKey)}` };
        }
        return content;
    });
}

function isGptImageModel(model: string) {
    return model.toLowerCase().startsWith("gpt-image-");
}

function normalizeOpenAISize(size: string, model: string) {
    const value = size.trim();
    if (!value) return "";
    if (model.toLowerCase() === "gpt-image-2") {
        return (
            {
                "1:1": "1024x1024",
                "3:2": "1536x1024",
                "2:3": "1024x1536",
                "4:3": "1360x1024",
                "3:4": "1024x1360",
                "16:9": "1824x1024",
                "9:16": "1024x1824",
            }[value] || value
        );
    }
    if (/^\d+x\d+$/i.test(value)) return value;
    // keep ratio strings as-is; many gateways accept them
    return value;
}

function validateGptImage2Size(model: string, size: string) {
    if (model.toLowerCase() !== "gpt-image-2" || !size || size === "auto") return "";
    const match = size.match(/^(\d+)x(\d+)$/i);
    if (!match) return "gpt-image-2 的尺寸必须使用宽x高格式，例如 1024x1024";

    const width = Number(match[1]);
    const height = Number(match[2]);
    const longEdge = Math.max(width, height);
    const shortEdge = Math.min(width, height);
    const pixels = width * height;
    if (width % 16 || height % 16) return "gpt-image-2 的宽高必须是 16 的倍数";
    if (longEdge > 3840) return "gpt-image-2 的最长边不能超过 3840px";
    if (longEdge / shortEdge > 3) return "gpt-image-2 的最长边与最短边比例不能超过 3:1";
    if (pixels < 655_360 || pixels > 8_294_400) return "gpt-image-2 的总像素必须在 655,360 至 8,294,400 之间";
    return "";
}
