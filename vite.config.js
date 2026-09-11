import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const rawTarget = env.VITE_API_URL || "https://b458-2401-4900-ae20-7632-b04c-4160-1db0-d43d.ngrok-free.app";
  const target = rawTarget.replace(/\/+$/, "");

  return {
    plugins: [react(), tailwindcss()],
    server: {
      allowedHosts: ['stump-vitamins-talisman.ngrok-free.dev'],
      proxy: {
        "/api": {
          target,
          changeOrigin: true,
          secure: false,
          headers: {
            "ngrok-skip-browser-warning": "true",
          },
          configure: (proxy) => {
            proxy.on("error", (err, req, res) => {
              console.error("[Vite Proxy Error]:", err.message);
            });
          },
        },
      },
    },
  };
});

