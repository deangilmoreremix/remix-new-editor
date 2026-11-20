import { Button } from "@vidbee/ui/components/ui/button";
import type { WebTranslation } from "@vidbee/transcription/web-contract";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiUrl, translateClient } from "../../lib/orpc-client";
import { isCancel, pickSaveTarget, saveResponse } from "../../lib/save-file";

const MP4_FRIENDLY = new Set([".mp4", ".m4v", ".mov"]);

/** Export the downloaded video with the transcript or a translation as subtitles (server ffmpeg). */
export const VideoExport = ({
	downloadId,
	title,
	sourceFilePath,
}: {
	downloadId: string;
	title: string;
	sourceFilePath: string;
}) => {
	const { t } = useTranslation();
	const [translations, setTranslations] = useState<WebTranslation[]>([]);
	const [language, setLanguage] = useState("");
	const [mode, setMode] = useState<"soft" | "burn">("soft");
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		void translateClient
			.list({ downloadId })
			.then((list) => setTranslations(list.filter((item) => item.status === "completed")))
			.catch(() => setTranslations([]));
	}, [downloadId]);

	const run = async () => {
		const dot = sourceFilePath.lastIndexOf(".");
		const sourceExt = dot >= 0 ? sourceFilePath.slice(dot).toLowerCase() : ".mp4";
		const extension = mode === "burn" || MP4_FRIENDLY.has(sourceExt) ? "mp4" : "mkv";
		const mime = extension === "mp4" ? "video/mp4" : "video/x-matroska";
		const base = title.replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 100) || "video";
		const name = `${base}${language ? `.${language}` : ""}.${mode === "burn" ? "subtitled" : "subs"}.${extension}`;
		setBusy(true);
		try {
			// Open the save dialog first: browsers only allow it right after the click.
			const target = await pickSaveTarget(name, mime, extension);
			toast.info(
				mode === "burn"
					? t("webTranscripts.export.preparingBurn", {
							defaultValue: "Rendering the video with subtitles. This can take a while.",
						})
					: t("webTranscripts.export.preparing", { defaultValue: "Preparing the video…" }),
			);
			const query = new URLSearchParams({ downloadId, mode, language });
			const response = await fetch(`${apiUrl}/export/video?${query.toString()}`);
			if (!response.ok) {
				const body = (await response.json().catch(() => null)) as { message?: string } | null;
				throw new Error(body?.message ?? `Export failed (${response.status}).`);
			}
			await saveResponse(response, name, target);
			toast.success(t("webTranscripts.export.done", { defaultValue: "Video saved" }));
		} catch (error) {
			if (!isCancel(error)) {
				toast.error(error instanceof Error ? error.message : "Export failed");
			}
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="flex flex-wrap items-center gap-2 text-xs">
			<span className="text-muted-foreground">
				{t("webTranscripts.export.video", { defaultValue: "Video with subtitles" })}
			</span>
			<select
				aria-label="Subtitle language"
				className="rounded border bg-background px-2 py-1"
				onChange={(event) => setLanguage(event.target.value)}
				value={language}
			>
				<option value="">{t("webTranscripts.player.original", { defaultValue: "Transcript" })}</option>
				{translations.map((item) => (
					<option key={item.language} value={item.language}>
						{item.language}
					</option>
				))}
			</select>
			<select
				aria-label="Subtitle mode"
				className="rounded border bg-background px-2 py-1"
				onChange={(event) => setMode(event.target.value as "soft" | "burn")}
				value={mode}
			>
				<option value="soft">{t("webTranscripts.export.soft", { defaultValue: "Soft (selectable track)" })}</option>
				<option value="burn">{t("webTranscripts.export.burn", { defaultValue: "Burned in (re-encodes)" })}</option>
			</select>
			<Button disabled={busy} onClick={() => void run()} size="sm" variant="outline">
				{busy
					? t("webTranscripts.export.working", { defaultValue: "Working…" })
					: t("webTranscripts.export.run", { defaultValue: "Export video" })}
			</Button>
		</div>
	);
};
