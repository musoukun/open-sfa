import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 親フォルダ（D:\develop）の postcss.config.js を拾わないよう、空の設定を明示する
  css: { postcss: {} },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // 業務ルール（状態遷移・税計算）はサーバーと同じファイルを使う
      "@server": path.resolve(import.meta.dirname, "../src"),
    },
  },
  server: {
    // 画面だけ手元で動かすときは、API を Docker 上のサーバーへ回す
    proxy: { "/api": "http://localhost:3099" },
  },
});
