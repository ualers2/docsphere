import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0", 
    port: 4343,
    allowedHosts: ["localhost", "accepted-poorly-maggot.ngrok-free.app", "www.support.mediacutsstudio.com"],
    hmr: {
      protocol: 'wss',
      host: 'support.mediacutsstudio.com', 
    },
    watch: {
      ignored: ['**/node_modules/**'],
      usePolling: true,
      interval: 100,
    },
  },

  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
