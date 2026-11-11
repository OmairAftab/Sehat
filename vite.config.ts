import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { liveApi } from "./server/api";
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), liveApi(loadEnv(mode, process.cwd(), ""))],
  server: { host: "127.0.0.1" },
  preview: { host: "127.0.0.1" },
  build: {
    rollupOptions: {
      onwarn(warning, handler) {
        if (
          warning.code === "MODULE_LEVEL_DIRECTIVE" &&
          warning.message.includes("use client")
        )
          return;
        handler(warning);
      },
    },
  },
}));
