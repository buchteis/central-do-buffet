// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

const serverEnv = loadEnv("development", process.cwd(), ["EVOLUTION_API_URL", "EVOLUTION_API_KEY"]);
for (const key of ["EVOLUTION_API_URL", "EVOLUTION_API_KEY"] as const) {
  // Keep credentials available to server functions without exposing them as VITE_* client variables.
  if (process.env[key] === undefined && serverEnv[key]) process.env[key] = serverEnv[key];
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
