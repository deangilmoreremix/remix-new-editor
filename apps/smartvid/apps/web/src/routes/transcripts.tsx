import { createFileRoute } from "@tanstack/react-router";
import { TranscriptsPage } from "../components/pages/transcripts-page";

export const Route = createFileRoute("/transcripts")({
	component: TranscriptsPage,
});
