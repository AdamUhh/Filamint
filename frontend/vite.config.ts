import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import wails from "@wailsio/runtime/plugins/vite";
import path from "path";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), wails("./bindings"), tailwindcss()],

    resolve: {
        alias: {
            "@/shadcn": path.resolve(__dirname, "src/components/ui"),
            "@/components": path.resolve(__dirname, "src/components"),
            "@/db": path.resolve(__dirname, "src/lib/db"),
            "@/lib": path.resolve(__dirname, "src/lib"),
            "@/data-access": path.resolve(__dirname, "src/data-access"),
            "@/use-cases": path.resolve(__dirname, "src/use-cases"),
            "@/constants": path.resolve(__dirname, "src/constants"),
            "@/hooks": path.resolve(__dirname, "src/hooks"),
            "@": path.resolve(__dirname, "src"),
            "@bindings/updater": path.resolve(
                __dirname,
                "bindings/changeme/internal/updater"
            ),
            "@bindings": path.resolve(
                __dirname,
                "bindings/changeme/internal/services"
            ),
        },
    },

    build: {
        minify: "terser",
        terserOptions: {
            compress: {
                drop_console: true, // Remove console.log
                drop_debugger: true,
            },
        },
        rollupOptions: {
            output: {
                manualChunks(id: string) {
                    if (!id.includes("node_modules")) return;

                    // Three.js ecosystem (heaviest, isolated)
                    if (id.includes("three") || id.includes("@react-three"))
                        return "three";

                    // Tanstack
                    if (id.includes("@tanstack")) return "tanstack";

                    // React core (changes least, most valuable to cache)
                    if (id.includes("react-dom") || id.includes("react-router"))
                        return "react";

                    // UI component libs (change together, chunked separately from react core)
                    if (
                        id.includes("radix-ui") ||
                        id.includes("@base-ui") ||
                        id.includes("cmdk") ||
                        id.includes("react-day-picker") ||
                        id.includes("react-colorful") ||
                        id.includes("react-dropzone") ||
                        id.includes("sonner")
                    )
                        return "ui";

                    // Icons (lucide can be large depending on usage)
                    if (id.includes("lucide-react")) return "icons";

                    // Tiny utilities (all stable, rarely change)
                    if (
                        id.includes("date-fns") ||
                        id.includes("clsx") ||
                        id.includes("zod") ||
                        id.includes("tailwind-merge") ||
                        id.includes("class-variance-authority") ||
                        id.includes("tw-animate-css")
                    )
                        return "utils";

                    return "vendor";
                },

                // manualChunks: {
                //     vendor: ["react", "react-dom"], // Separate vendor bundle
                // },
            },
        },
    },
    // Memory Leak Issue hotfix: https://github.com/wailsapp/wails/issues/3903
    // server: {
    //     watch: {
    //         ignored: ["**/wailsjs/**"],
    //     },
    // },
});
