import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// [host patch] sub-path support, injected at build time by vite (see vite.config.ts `define`).
export const BASE_PATH: string = import.meta.env.BASE_URL.replace(/\/+$/, "");

export function getRouter() {
	const router = createTanStackRouter({
		routeTree,
		basepath: BASE_PATH || "/",

		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
	});

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
