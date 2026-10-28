import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    strictPort: false,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true
      },
      "/uploads": {
        target: "http://localhost:4000",
        changeOrigin: true
      },
      // WebSocket proxy cho Socket.io
      "/socket.io": {
        target: "http://localhost:4000",
        changeOrigin: true,
        ws: true
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, "/");
          if (normalized.includes("node_modules")) {
            if (normalized.includes("react") || normalized.includes("react-dom") || normalized.includes("react-router-dom")) {
              return "vendor-react";
            }
            if (normalized.includes("axios")) {
              return "vendor-http";
            }
            if (normalized.includes("socket.io-client")) {
              return "vendor-socket";
            }
            if (normalized.includes("lucide-react")) {
              return "vendor-icons";
            }
            return "vendor";
          }
          if (normalized.includes("/src/pages/admin/")) {
            return "chunk-admin";
          }
          if (normalized.includes("/src/pages/staff/") || normalized.includes("/src/pages/tech/")) {
            return "chunk-internal-portal";
          }
          if (normalized.includes("/src/pages/public/PcBuilderPage") || normalized.includes("/src/components/pc-builder/")) {
            return "chunk-pc-builder";
          }
          if (normalized.includes("/src/pages/public/CheckoutPage")) {
            return "chunk-checkout";
          }
        }
      }
    }
  }
});

