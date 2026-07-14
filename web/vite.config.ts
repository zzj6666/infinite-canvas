import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const webDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    base: process.env.VITE_BASE || "/",
    plugins: [react()],
    resolve: {
        alias: {
            "@": resolve(webDir, "src"),
        },
    },
    server: {
        allowedHosts: ["home.zzjnb.fun"],
        proxy: {
            "/api": {
                target: process.env.VITE_API_PROXY || "http://127.0.0.1:3010",
                changeOrigin: true,
            },
        },
    },
});
