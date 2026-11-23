import { createFileRoute } from "@tanstack/react-router";
import { ToolsPage } from "../components/pages/tools-page";

export const Route = createFileRoute("/tools")({
	component: ToolsPage,
});
