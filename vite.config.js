import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const rawTarget = env.VITE_API_URL || "https://530a-2401-4900-aac3-b046-5417-c348-6428-4fed.ngrok-free.app";
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
      allowedHosts: ['stump-vitamins-talisman.ngrok-free.dev'],
      proxy: {
        "/api": proxyConfig,
      },
    },
    preview: {
      allowedHosts: ['stump-vitamins-talisman.ngrok-free.dev'],
      proxy: {
        "/api": proxyConfig,
      },
    },
  };
});

