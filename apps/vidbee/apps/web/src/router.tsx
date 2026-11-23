import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	const router = createTanStackRouter({
		routeTree,
		// Served from a sub-path (for example /vidbee) when built with VIDBEE_BASE_PATH.
		basepath:
			import.meta.env.BASE_URL === "/"
				? undefined
				: import.meta.env.BASE_URL.replace(/\/$/, ""),

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
