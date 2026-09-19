import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Development only. Production requests stay relative and are proxied by
  // Vercel through vercel.json, so no ngrok or EC2 URL is baked into the UI.
  const rawTarget = env.VITE_API_URL || "http://localhost:8080";
  const target = rawTarget.replace(/\/+$/, "");

  const proxyConfig = {
    target,
    changeOrigin: true,
    secure: false,
    headers: {
      "User-Agent": "PolarOps/1.0",
    },
    configure: (proxy) => {
      proxy.on("error", (err, req, res) => {
        console.error("[Vite Proxy Error]:", err.message);
      });
    },
  };

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        "/api": proxyConfig,
      },
    },
    preview: {
      proxy: {
        "/api": proxyConfig,
      },
    },
  };
});

