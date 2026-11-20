import { Badge } from "@vidbee/ui/components/ui/badge";
import { Button } from "@vidbee/ui/components/ui/button";
import { Input } from "@vidbee/ui/components/ui/input";
import type {
	WebTranscriptDetail,
	WebTranscriptExportFormat,
	WebTranscriptStatus,
} from "@vidbee/transcription/web-contract";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { transcriptsClient } from "../../lib/orpc-client";
import { AppShell } from "../layout/app-shell";
import { AiSummaryPanel } from "./ai-summary-panel";
import { ChatPanel } from "./chat-panel";
import { TranslatePanel } from "./translate-panel";

const ACTIVE_STATES = new Set(["queued", "running", "retry-scheduled"]);
const EXPORT_FORMATS: WebTranscriptExportFormat[] = ["txt", "md", "srt", "vtt"];
const SPEAKER_COLORS = [
	"text-sky-500",
	"text-emerald-500",
	"text-amber-500",
	"text-fuchsia-500",
	"text-rose-500",
	"text-cyan-500",
];

const formatClock = (ms: number): string => {
	const total = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const mm = String(m).padStart(2, "0");
	const ss = String(s).padStart(2, "0");
	return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

const messageOf = (error: unknown): string =>
	error instanceof Error && error.message ? error.message : "Request failed";

const saveFile = (filename: string, mimeType: string, content: string) => {
	const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
};

export const TranscriptsPage = () => {
	const { t } = useTranslation();
	const [items, setItems] = useState<WebTranscriptStatus[]>([]);
	const [loaded, setLoaded] = useState(false);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [detail, setDetail] = useState<WebTranscriptDetail | null>(null);
	const [query, setQuery] = useState("");
	const [busy, setBusy] = useState(false);
	const [tab, setTab] = useState<"transcript" | "ai" | "chat" | "translate">("transcript");

	const refreshList = useCallback(async () => {
		try {
			const map = await transcriptsClient.statusMap();
			setItems(
				Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt),
			);
		} catch (error) {
			toast.error(messageOf(error));
		} finally {
			setLoaded(true);
		}
	}, []);

	const refreshDetail = useCallback(async (downloadId: string) => {
		try {
			setDetail(await transcriptsClient.get({ downloadId }));
		} catch (error) {
			toast.error(messageOf(error));
		}
	}, []);

	useEffect(() => {
		void refreshList();
	}, [refreshList]);

	useEffect(() => {
		if (selectedId) {
			void refreshDetail(selectedId);
		} else {
			setDetail(null);
		}
	}, [selectedId, refreshDetail]);

	const polling =
		items.some((item) => ACTIVE_STATES.has(item.state)) ||
		(detail ? ACTIVE_STATES.has(detail.state) : false);
	useEffect(() => {
		if (!polling) {
			return;
		}
		const timer = window.setInterval(() => {
			void refreshList();
			if (selectedId) {
				void refreshDetail(selectedId);
			}
		}, 2500);
		return () => window.clearInterval(timer);
	}, [polling, selectedId, refreshList, refreshDetail]);

	const act = async (
		run: (downloadId: string) => Promise<WebTranscriptDetail>,
	) => {
		if (!selectedId) {
			return;
		}
		setBusy(true);
		try {
			setDetail(await run(selectedId));
			void refreshList();
		} catch (error) {
			toast.error(messageOf(error));
		} finally {
			setBusy(false);
		}
	};

	const exportAs = async (format: WebTranscriptExportFormat) => {
		if (!selectedId) {
			return;
		}
		try {
			const file = await transcriptsClient.export({
				downloadId: selectedId,
				format,
			});
			saveFile(file.filename, file.mimeType, file.content);
		} catch (error) {
			toast.error(messageOf(error));
		}
	};

	const speakerNames = useMemo(
		() =>
			new Map(
				(detail?.record?.speakers ?? []).map((speaker, index) => [
					speaker.id,
					{ name: speaker.displayName, color: SPEAKER_COLORS[index % SPEAKER_COLORS.length] },
				]),
			),
		[detail],
	);

	const segments = useMemo(() => {
		const all = [...(detail?.record?.segments ?? [])].sort(
			(a, b) => a.sortIndex - b.sortIndex,
		);
		const needle = query.trim().toLowerCase();
		return needle
			? all.filter((segment) => segment.text.toLowerCase().includes(needle))
			: all;
	}, [detail, query]);

	const stateLabel = (state: string) =>
		t(`transcript.state.${state}`, { defaultValue: state });

	return (
		<AppShell page="transcripts">
			<div className="flex h-full min-h-0">
				<aside className="w-72 shrink-0 overflow-y-auto border-r">
					<div className="p-3 font-medium text-sm">
						{t("menu.transcripts")}
					</div>
					{loaded && items.length === 0 && (
						<p className="px-3 text-muted-foreground text-sm">
							{t("transcript.empty", {
								defaultValue:
									"No transcripts yet. Finish a download on Home, then open it here to transcribe.",
							})}
						</p>
					)}
					<ul>
						{items.map((item) => (
							<li key={item.downloadId}>
								<button
									className={`w-full px-3 py-2 text-left hover:bg-muted ${
										item.downloadId === selectedId ? "bg-muted" : ""
									}`}
									onClick={() => setSelectedId(item.downloadId)}
									type="button"
								>
									<div className="truncate text-sm">
										{item.title ?? item.downloadId}
									</div>
									<div className="mt-1 flex items-center gap-2">
										<Badge variant="secondary">{stateLabel(item.state)}</Badge>
										{item.language && (
											<span className="text-muted-foreground text-xs">
												{item.language}
											</span>
										)}
									</div>
								</button>
							</li>
						))}
					</ul>
				</aside>

				<section className="flex min-w-0 flex-1 flex-col">
					{detail ? (
						<>
							<header className="flex flex-wrap items-center gap-2 border-b p-3">
								<h2 className="mr-auto min-w-0 truncate font-medium">
									{detail.title ?? detail.downloadId}
								</h2>
								<Badge variant="secondary">{stateLabel(detail.state)}</Badge>
								{detail.stage && (
									<span className="text-muted-foreground text-xs">
										{detail.stage}
									</span>
								)}
								{(detail.state === "none" || detail.state === "no-speech") && (
									<Button
										disabled={busy || !detail.sourceFilePath}
										onClick={() => void act((id) => transcriptsClient.start({ downloadId: id }))}
										size="sm"
									>
										{t("transcript.start", { defaultValue: "Transcribe" })}
									</Button>
								)}
								{ACTIVE_STATES.has(detail.state) && (
									<Button
										disabled={busy}
										onClick={() => void act((id) => transcriptsClient.cancel({ downloadId: id }))}
										size="sm"
										variant="outline"
									>
										{t("transcript.cancel", { defaultValue: "Cancel" })}
									</Button>
								)}
								{(detail.state === "failed" || detail.state === "cancelled") && (
									<Button
										disabled={busy}
										onClick={() => void act((id) => transcriptsClient.retry({ downloadId: id }))}
										size="sm"
									>
										{t("transcript.retry", { defaultValue: "Retry" })}
									</Button>
								)}
								{detail.state === "completed" && (
									<Button
										disabled={busy || !detail.sourceFilePath}
										onClick={() => void act((id) => transcriptsClient.start({ downloadId: id, force: true }))}
										size="sm"
										variant="outline"
									>
										{t("transcript.redo", { defaultValue: "Re-transcribe" })}
									</Button>
								)}
							</header>

							{detail.error && (
								<p className="border-b p-3 text-destructive text-sm">
									{detail.error}
								</p>
							)}

							<div className="flex gap-1 border-b px-3 pt-2">
								{(["transcript", "ai", "chat", "translate"] as const).map((name) => (
									<button
										className={`border-b-2 px-3 py-1.5 text-sm ${
											tab === name
												? "border-primary font-medium"
												: "border-transparent text-muted-foreground"
										}`}
										key={name}
										onClick={() => setTab(name)}
										type="button"
									>
										{name === "ai" &&
											t("transcript.ai.tab", { defaultValue: "AI summary" })}
										{name === "chat" &&
											t("transcript.chat.tab", { defaultValue: "Chat" })}
										{name === "translate" &&
											t("transcript.translate.tab", { defaultValue: "Translate" })}
										{name === "transcript" &&
											t("transcript.tab", { defaultValue: "Transcript" })}
									</button>
								))}
							</div>

							{tab === "ai" && (
								<AiSummaryPanel
									downloadId={detail.downloadId}
									hasTranscript={Boolean(detail.record)}
								/>
							)}

							{tab === "chat" && (
								<ChatPanel
									downloadId={detail.downloadId}
									hasTranscript={Boolean(detail.record)}
								/>
							)}

							{tab === "translate" && (
								<TranslatePanel
									downloadId={detail.downloadId}
									hasTranscript={Boolean(detail.record)}
								/>
							)}

							{tab === "transcript" && detail.record && (
								<div className="flex flex-wrap items-center gap-2 border-b p-3">
									<Input
										className="max-w-xs"
										onChange={(event) => setQuery(event.target.value)}
										placeholder={t("transcript.search", {
											defaultValue: "Search transcript",
										})}
										value={query}
									/>
									<span className="mr-auto text-muted-foreground text-xs">
										{segments.length}/{detail.segmentCount}
									</span>
									{EXPORT_FORMATS.map((format) => (
										<Button
											key={format}
											onClick={() => void exportAs(format)}
											size="sm"
											variant="outline"
										>
											{format.toUpperCase()}
										</Button>
									))}
								</div>
							)}

							{tab === "transcript" && (
							<div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
								{segments.map((segment) => {
									const speaker = segment.speakerId
										? speakerNames.get(segment.speakerId)
										: undefined;
									return (
										<div className="flex gap-3 text-sm" key={segment.id}>
											<span className="w-14 shrink-0 text-muted-foreground tabular-nums">
												{formatClock(segment.startMs)}
											</span>
											<div>
												{speaker && (
													<div className={`font-medium ${speaker.color}`}>
														{speaker.name}
													</div>
												)}
												<div>{segment.text}</div>
											</div>
										</div>
									);
								})}
								{!detail.record && !detail.error && (
									<p className="text-muted-foreground text-sm">
										{ACTIVE_STATES.has(detail.state)
											? t("transcript.working", { defaultValue: "Transcribing…" })
											: t("transcript.none", {
													defaultValue: "No transcript for this download yet.",
												})}
									</p>
								)}
							</div>
							)}
						</>
					) : (
						<p className="p-6 text-muted-foreground text-sm">
							{t("transcript.pick", {
								defaultValue: "Select a download to view its transcript.",
							})}
						</p>
					)}
				</section>
			</div>
		</AppShell>
	);
};
