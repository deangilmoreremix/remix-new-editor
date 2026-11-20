import { Badge } from "@vidbee/ui/components/ui/badge";
import { Button } from "@vidbee/ui/components/ui/button";
import { Input } from "@vidbee/ui/components/ui/input";
import type {
	WebTranscriptDetail,
	WebTranscriptExportFormat,
	WebTranscriptStatus,
} from "@vidbee/transcription/web-contract";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
	notificationPermission,
	notify,
	requestNotifications,
} from "../../lib/notify";
import { transcriptsClient } from "../../lib/orpc-client";
import { AppShell } from "../layout/app-shell";
import { AiSummaryPanel } from "./ai-summary-panel";
import { LocalTranscribePanel } from "./local-transcribe-panel";
import { MediaPlayer, type MediaPlayerHandle } from "./media-player";
import { VideoExport } from "./video-export";
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
	const [highlightId, setHighlightId] = useState<string | null>(null);
	const [jumpMs, setJumpMs] = useState<number | null>(null);
	const playerRef = useRef<MediaPlayerHandle>(null);
	const [showPlayer, setShowPlayer] = useState(true);
	const [localOpen, setLocalOpen] = useState(false);
	const [translationVersion, setTranslationVersion] = useState(0);
	const onTranslationCompleted = useCallback(() => setTranslationVersion((value) => value + 1), []);
	const [playheadMs, setPlayheadMs] = useState(0);
	const [playing, setPlaying] = useState(false);
	const [followPlayback, setFollowPlayback] = useState(true);
	const [notifyState, setNotifyState] = useState(notificationPermission());
	const lastStates = useRef<Record<string, string>>({});
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

	// Tell the user when a transcription they were waiting on finishes.
	useEffect(() => {
		for (const item of items) {
			const before = lastStates.current[item.downloadId];
			if (before && ACTIVE_STATES.has(before) && !ACTIVE_STATES.has(item.state)) {
				notify(
					item.state === "failed"
						? t("webTranscripts.notify.failed", { defaultValue: "Transcription failed" })
						: t("webTranscripts.notify.done", { defaultValue: "Transcription finished" }),
					item.title ?? item.downloadId,
				);
			}
			lastStates.current[item.downloadId] = item.state;
		}
	}, [items, t]);

	// The line being spoken at the playhead.
	const activeSegmentId = useMemo(() => {
		if (!(detail?.record && (playing || playheadMs > 0))) {
			return null;
		}
		const ordered = [...detail.record.segments].sort((a, b) => a.sortIndex - b.sortIndex);
		return [...ordered].reverse().find((segment) => segment.startMs <= playheadMs)?.id ?? null;
	}, [detail, playheadMs, playing]);

	useEffect(() => {
		if (!(followPlayback && playing && activeSegmentId && tab === "transcript")) {
			return;
		}
		document
			.getElementById(`seg-${activeSegmentId}`)
			?.scrollIntoView({ block: "nearest", behavior: "smooth" });
	}, [activeSegmentId, followPlayback, playing, tab]);

	// Open the transcript at a moment: clear search, find the segment, scroll to it.
	const jumpTo = (seconds: number) => {
		setQuery("");
		setTab("transcript");
		setJumpMs(Math.max(0, seconds * 1000));
		playerRef.current?.seek(seconds);
	};

	useEffect(() => {
		if (jumpMs === null || tab !== "transcript" || !detail?.record) {
			return;
		}
		const ordered = [...detail.record.segments].sort((a, b) => a.sortIndex - b.sortIndex);
		// The segment containing the moment: the last one starting at or just after it.
		const target = [...ordered].reverse().find((segment) => segment.startMs <= jumpMs + 500) ?? ordered[0];
		setJumpMs(null);
		if (!target) {
			return;
		}
		setHighlightId(target.id);
		window.requestAnimationFrame(() =>
			document.getElementById(`seg-${target.id}`)?.scrollIntoView({ block: "center" }),
		);
		const timer = window.setTimeout(() => setHighlightId(null), 3000);
		return () => window.clearTimeout(timer);
	}, [jumpMs, tab, detail]);

	const stateLabel = (state: string) =>
		t(`webTranscripts.state.${state}`, { defaultValue: state });

	return (
		<AppShell page="transcripts">
			<div className="flex h-full min-h-0">
				<aside className="w-72 shrink-0 overflow-y-auto border-r">
					<div className="flex items-center justify-between p-3 font-medium text-sm">
						{t("menu.transcripts")}
						<Button
							onClick={() => {
								setSelectedId(null);
								setLocalOpen(true);
							}}
							size="sm"
							variant="outline"
						>
							{t("webTranscripts.local.open", { defaultValue: "From a file" })}
						</Button>
					</div>
					{loaded && items.length === 0 && (
						<p className="px-3 text-muted-foreground text-sm">
							{t("webTranscripts.empty", {
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
									onClick={() => {
										setLocalOpen(false);
										setSelectedId(item.downloadId);
									}}
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
					{localOpen && !detail ? (
						<div className="p-4">
							<LocalTranscribePanel
								onImported={(status) => {
									setLocalOpen(false);
									void refreshList();
									setSelectedId(status.downloadId);
								}}
							/>
						</div>
					) : detail ? (
						<>
							<header className="flex flex-wrap items-center gap-2 border-b p-3">
								<h2 className="mr-auto min-w-0 truncate font-medium">
									{detail.title ?? detail.downloadId}
								</h2>
								<Badge variant="secondary">{stateLabel(detail.state)}</Badge>
								{notifyState === "default" && (
									<Button
										onClick={() => void requestNotifications().then(setNotifyState)}
										size="sm"
										variant="ghost"
									>
										{t("webTranscripts.notify.enable", { defaultValue: "Notify me" })}
									</Button>
								)}
								{detail.sourceFilePath && (
									<Button
										onClick={() => setShowPlayer((value) => !value)}
										size="sm"
										variant="ghost"
									>
										{showPlayer
											? t("webTranscripts.player.hide", { defaultValue: "Hide player" })
											: t("webTranscripts.player.show", { defaultValue: "Show player" })}
									</Button>
								)}
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
										{detail.state === "no-speech"
											? t("webTranscripts.startAnyway", { defaultValue: "Transcribe anyway" })
											: t("webTranscripts.start", { defaultValue: "Transcribe" })}
									</Button>
								)}
								{ACTIVE_STATES.has(detail.state) && (
									<Button
										disabled={busy}
										onClick={() => void act((id) => transcriptsClient.cancel({ downloadId: id }))}
										size="sm"
										variant="outline"
									>
										{t("webTranscripts.cancel", { defaultValue: "Cancel" })}
									</Button>
								)}
								{(detail.state === "failed" || detail.state === "cancelled") && (
									<Button
										disabled={busy}
										onClick={() => void act((id) => transcriptsClient.retry({ downloadId: id }))}
										size="sm"
									>
										{t("webTranscripts.retry", { defaultValue: "Retry" })}
									</Button>
								)}
								{detail.state === "completed" && (
									<Button
										disabled={busy || !detail.sourceFilePath}
										onClick={() => void act((id) => transcriptsClient.start({ downloadId: id, force: true }))}
										size="sm"
										variant="outline"
									>
										{t("webTranscripts.redo", { defaultValue: "Re-transcribe" })}
									</Button>
								)}
							</header>

							{detail.error && (
								<p className="border-b p-3 text-destructive text-sm">
									{detail.error}
								</p>
							)}

							{detail.sourceFilePath && showPlayer && (
								<MediaPlayer
									downloadId={detail.downloadId}
									filePath={detail.sourceFilePath}
									onPlayingChange={setPlaying}
									onTime={setPlayheadMs}
									record={detail.record}
									translationVersion={translationVersion}
									ref={playerRef}
								/>
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
											t("webTranscripts.ai.tab", { defaultValue: "AI summary" })}
										{name === "chat" &&
											t("webTranscripts.chat.tab", { defaultValue: "Chat" })}
										{name === "translate" &&
											t("webTranscripts.translate.tab", { defaultValue: "Translate" })}
										{name === "transcript" &&
											t("webTranscripts.tab", { defaultValue: "Transcript" })}
									</button>
								))}
							</div>

							{tab === "ai" && (
								<AiSummaryPanel
									author={detail.author}
									downloadId={detail.downloadId}
									hasTranscript={Boolean(detail.record)}
									title={detail.title ?? detail.downloadId}
									onJump={jumpTo}
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
									onCompleted={onTranslationCompleted}
									downloadId={detail.downloadId}
									hasTranscript={Boolean(detail.record)}
								/>
							)}

							{tab === "transcript" && detail.record && (
								<div className="flex flex-wrap items-center gap-2 border-b p-3">
									<Input
										className="max-w-xs"
										onChange={(event) => setQuery(event.target.value)}
										placeholder={t("webTranscripts.search", {
											defaultValue: "Search transcript",
										})}
										value={query}
									/>
									<span className="mr-auto text-muted-foreground text-xs">
										{segments.length}/{detail.segmentCount}
									</span>
									{detail.sourceFilePath && (
										<label className="flex items-center gap-1 text-xs">
											<input
												checked={followPlayback}
												onChange={(event) => setFollowPlayback(event.target.checked)}
												type="checkbox"
											/>
											{t("webTranscripts.player.follow", { defaultValue: "Follow playback" })}
										</label>
									)}
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

							{tab === "transcript" && detail.record && detail.sourceFilePath && (
								<div className="border-b px-3 py-2">
									<VideoExport
										downloadId={detail.downloadId}
										sourceFilePath={detail.sourceFilePath}
										title={detail.title ?? detail.downloadId}
										translationVersion={translationVersion}
									/>
								</div>
							)}

							{tab === "transcript" && (
							<div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
								{segments.map((segment) => {
									const speaker = segment.speakerId
										? speakerNames.get(segment.speakerId)
										: undefined;
									return (
										<div
											className={`flex gap-3 rounded-md text-sm ${
												highlightId === segment.id
													? "bg-primary/15"
													: activeSegmentId === segment.id
														? "bg-muted"
														: ""
											}`}
											id={`seg-${segment.id}`}
											key={segment.id}
										>
											<button
												className="w-14 shrink-0 text-left text-muted-foreground tabular-nums hover:text-primary"
												onClick={() => playerRef.current?.seek(segment.startMs / 1000)}
												title={t("webTranscripts.player.seek", { defaultValue: "Play from here" })}
												type="button"
											>
												{formatClock(segment.startMs)}
											</button>
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
								{!detail.record && detail.sourceFilePath && !ACTIVE_STATES.has(detail.state) && (
									<LocalTranscribePanel
										downloadId={detail.downloadId}
										filePath={detail.sourceFilePath}
										onImported={() => {
											void refreshDetail(detail.downloadId);
											void refreshList();
										}}
									/>
								)}
								{!detail.record && !detail.error && (
									<p className="text-muted-foreground text-sm">
										{ACTIVE_STATES.has(detail.state)
											? t("webTranscripts.working", { defaultValue: "Transcribing…" })
											: t("webTranscripts.none", {
													defaultValue: "No transcript for this download yet.",
												})}
									</p>
								)}
							</div>
							)}
						</>
					) : (
						<p className="p-6 text-muted-foreground text-sm">
							{t("webTranscripts.pick", {
								defaultValue: "Select a download to view its transcript.",
							})}
						</p>
					)}
				</section>
			</div>
		</AppShell>
	);
};
