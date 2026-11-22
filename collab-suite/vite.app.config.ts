import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Shared by every app so each runs standalone: `npm run dev` inside apps/<name>.
export default defineConfig({ plugins: [react()] });
