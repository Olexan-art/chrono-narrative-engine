import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import fs from "fs";

import { staticPagesPlugin } from "./vite-plugin-static-pages";

// Plugin to copy _worker.js to dist/ for Cloudflare Pages
function copyWorkerPlugin() {
  return {
    name: 'copy-worker',
    closeBundle() {
      const workerSrc = path.resolve(__dirname, '_worker.js');
      const workerDest = path.resolve(__dirname, 'dist/_worker.js');
      if (fs.existsSync(workerSrc)) {
        fs.copyFileSync(workerSrc, workerDest);
        console.log('✓ Copied _worker.js to dist/');
      }
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    copyWorkerPlugin(),
    // VitePWA({
    //   registerType: "autoUpdate",
    //   injectRegister: "inline",
    //   includeAssets: ["favicon.png", "favicon.ico"],
    //   manifest: {
    //     name: "Synchronization Point",
    //     short_name: "SP",
    //     description: "AI Archive of Human History - A book that writes itself",
    //     theme_color: "#0c1222",
    //     background_color: "#0c1222",
    //     display: "standalone",
    //     orientation: "portrait-primary",
    //     scope: "/",
    //     start_url: "/",
    //     icons: [
    //       {
    //         src: "/favicon.png",
    //         sizes: "192x192",
    //         type: "image/png",
    //         purpose: "any maskable"
    //       },
    //       {
    //         src: "/favicon.png",
    //         sizes: "512x512",
    //         type: "image/png",
    //         purpose: "any maskable"
    //       }
    //     ]
    //   },
    //   workbox: {
    //     globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
    //     // Don't treat technical text files as SPA navigations.
    //     // Without this, the service worker may serve index.html for /robots.txt when opened in the browser.
    //     navigateFallbackDenylist: [/^\/robots\.txt$/, /^\/sitemap\.xml$/, /^\/llms\.txt$/, /^\/llms-full\.txt$/],
    //     runtimeCaching: [
    //       {
    //         urlPattern: /^https:\/\/tuledxqigzufkecztnlo\.supabase\.co\/.*/i,
    //         handler: "NetworkFirst",
    //         options: {
    //           cacheName: "supabase-cache",
    //           expiration: {
    //             maxEntries: 100,
    //             maxAgeSeconds: 60 * 60 * 24 // 24 hours
    //           }
    //         }
    //       }
    //     ]
    //   }
    // }),
    // staticPagesPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-date': ['date-fns'],
        },
      },
    },
  },
}));
