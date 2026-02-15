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
            "@": path.resolve(__dirname, "src"),
            "@bindings": path.resolve(__dirname, "bindings/changeme"),
        },
    },
    // Memory Leak Issue hotfix: https://github.com/wailsapp/wails/issues/3903
    server: {
        watch: {
            ignored: ["**/wailsjs/**"],
        },
    },
});
