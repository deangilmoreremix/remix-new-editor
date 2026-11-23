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
import { InfoPane, SpeakerAvatar, SpeakersPane, formatClock, speakerStyle } from "./speakers-pane";
import { TranslatePanel } from "./translate-panel";

const ACTIVE_STATES = new Set(["queued", "running", "retry-scheduled"]);
const EXPORT_FORMATS: WebTranscriptExportFormat[] = ["txt", "md", "srt", "vtt"];

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
	const [leftTab, setLeftTab] = useState<"speakers" | "info">("speakers");
	const [exportOpen, setExportOpen] = useState(false);

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
					{ name: speaker.displayName, index },
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

	const activeSpeakerId = useMemo(
		() => detail?.record?.segments.find((segment) => segment.id === activeSegmentId)?.speakerId ?? null,
		[detail, activeSegmentId],
	);

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

	const actionButtons = detail ? (
		<>
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
					variant="ghost"
				>
					{t("webTranscripts.redo", { defaultValue: "Re-transcribe" })}
				</Button>
			)}
		</>
	) : null;

	return (
		<AppShell page="transcripts">
			{!detail && !localOpen ? (
				<div className="flex h-full min-h-0 flex-col">
					<div className="flex items-center justify-between border-b p-4">
						<h1 className="font-semibold text-lg">{t("menu.transcripts")}</h1>
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
					{loaded && items.length === 0 ? (
						<p className="p-6 text-muted-foreground text-sm">
							{t("webTranscripts.empty", {
								defaultValue:
									"No transcripts yet. Finish a download on Home, then open it here to transcribe.",
							})}
						</p>
					) : (
						<ul className="min-h-0 flex-1 divide-y overflow-y-auto">
							{items.map((item) => (
								<li key={item.downloadId}>
									<button
										className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/60"
										onClick={() => {
											setLocalOpen(false);
											setSelectedId(item.downloadId);
										}}
										type="button"
									>
										<div className="min-w-0 flex-1">
											<div className="truncate text-sm">{item.title ?? item.downloadId}</div>
											{item.author && (
												<div className="truncate text-muted-foreground text-xs">{item.author}</div>
											)}
										</div>
										{item.language && (
											<span className="text-muted-foreground text-xs">{item.language}</span>
										)}
										<Badge variant="secondary">{stateLabel(item.state)}</Badge>
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
			) : localOpen && !detail ? (
				<div className="flex h-full min-h-0 flex-col">
					<div className="flex items-center gap-2 border-b p-3">
						<Button onClick={() => setLocalOpen(false)} size="sm" variant="ghost">
							←
						</Button>
						<h1 className="font-medium text-sm">
							{t("webTranscripts.local.open", { defaultValue: "From a file" })}
						</h1>
					</div>
					<div className="min-h-0 flex-1 overflow-y-auto p-4">
						<LocalTranscribePanel
							onImported={(status) => {
								setLocalOpen(false);
								void refreshList();
								setSelectedId(status.downloadId);
							}}
						/>
					</div>
				</div>
			) : detail ? (
				<div className="flex h-full min-h-0 flex-col">
					<header className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
						<Button
							aria-label={t("webTranscripts.back", { defaultValue: "Back to transcripts" })}
							onClick={() => {
								setSelectedId(null);
								setPlaying(false);
								setPlayheadMs(0);
							}}
							size="sm"
							variant="ghost"
						>
							←
						</Button>
						<h2 className="mr-auto min-w-0 truncate font-medium text-sm">
							{detail.title ?? detail.downloadId}
						</h2>
						{ACTIVE_STATES.has(detail.state) || detail.state === "failed" || detail.state === "cancelled" ? (
							<Badge variant="secondary">{stateLabel(detail.state)}</Badge>
						) : null}
						{detail.stage && <span className="text-muted-foreground text-xs">{detail.stage}</span>}
						{notifyState === "default" && (
							<Button
								onClick={() => void requestNotifications().then(setNotifyState)}
								size="sm"
								variant="ghost"
							>
								{t("webTranscripts.notify.enable", { defaultValue: "Notify me" })}
							</Button>
						)}
						{actionButtons}
						{detail.record && (
							<div className="relative">
								<Button onClick={() => setExportOpen((open) => !open)} size="sm" variant="outline">
									{t("webTranscripts.export", { defaultValue: "Export" })}
								</Button>
								{exportOpen && (
									<>
										<button
											aria-label="Close"
											className="fixed inset-0 z-10 cursor-default"
											onClick={() => setExportOpen(false)}
											type="button"
										/>
										<div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-md border bg-popover shadow-md">
											{EXPORT_FORMATS.map((format) => (
												<button
													className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
													key={format}
													onClick={() => {
														setExportOpen(false);
														void exportAs(format);
													}}
													type="button"
												>
													{format.toUpperCase()}
												</button>
											))}
										</div>
									</>
								)}
							</div>
						)}
						{detail.sourceFilePath && (
							<Button
								aria-pressed={showPlayer}
								onClick={() => setShowPlayer((value) => !value)}
								size="sm"
								title={
									showPlayer
										? t("webTranscripts.player.hide", { defaultValue: "Hide player" })
										: t("webTranscripts.player.show", { defaultValue: "Show player" })
								}
								variant="ghost"
							>
								▭
							</Button>
						)}
					</header>

					{detail.error && (
						<p className="border-b px-3 py-2 text-destructive text-sm">{detail.error}</p>
					)}

					<div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
						<div className="flex min-h-0 flex-col overflow-y-auto border-b lg:border-r lg:border-b-0">
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
							{detail.record && (
								<>
									<div className="flex items-center gap-1 border-b px-4 pt-2">
										{(["speakers", "info"] as const).map((name) => (
											<button
												className={`border-b-2 px-3 py-1.5 text-sm ${
													leftTab === name
														? "border-primary font-medium"
														: "border-transparent text-muted-foreground"
												}`}
												key={name}
												onClick={() => setLeftTab(name)}
												type="button"
											>
												{name === "speakers"
													? t("webTranscripts.speakers.tab", {
															defaultValue: "Speakers ({{count}})",
															count: detail.record?.speakers.length ?? 0,
														})
													: t("webTranscripts.info.tab", { defaultValue: "Info" })}
											</button>
										))}
									</div>
									{leftTab === "speakers" ? (
										<SpeakersPane
											activeSpeakerId={activeSpeakerId}
											onSeek={(ms) => playerRef.current?.seek(ms / 1000)}
											record={detail.record}
										/>
									) : (
										<>
											<InfoPane detail={detail} />
											{detail.sourceFilePath && (
												<div className="border-t px-4 py-3">
													<VideoExport
														downloadId={detail.downloadId}
														sourceFilePath={detail.sourceFilePath}
														title={detail.title ?? detail.downloadId}
														translationVersion={translationVersion}
													/>
												</div>
											)}
										</>
									)}
								</>
							)}
						</div>

						<div className="flex min-h-0 min-w-0 flex-col">
							<div className="flex gap-1 overflow-x-auto border-b px-3 pt-2">
								{(["transcript", "ai", "chat", "translate"] as const).map((name) => (
									<button
										className={`shrink-0 border-b-2 px-3 py-1.5 text-sm ${
											tab === name
												? "border-primary font-medium"
												: "border-transparent text-muted-foreground"
										}`}
										key={name}
										onClick={() => setTab(name)}
										type="button"
									>
										{name === "ai" && t("webTranscripts.ai.tab", { defaultValue: "AI summary" })}
										{name === "chat" && t("webTranscripts.chat.tab", { defaultValue: "Chat" })}
										{name === "translate" &&
											t("webTranscripts.translate.tab", { defaultValue: "Translate" })}
										{name === "transcript" && t("webTranscripts.tab", { defaultValue: "Transcript" })}
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
								<ChatPanel downloadId={detail.downloadId} hasTranscript={Boolean(detail.record)} />
							)}

							{tab === "translate" && (
								<TranslatePanel
									onCompleted={onTranslationCompleted}
									downloadId={detail.downloadId}
									hasTranscript={Boolean(detail.record)}
								/>
							)}

							{tab === "transcript" && detail.record && (
								<div className="flex items-center gap-2 px-3 py-2">
									<Input
										className="min-w-0 flex-1"
										onChange={(event) => setQuery(event.target.value)}
										placeholder={t("webTranscripts.search", { defaultValue: "Search transcript" })}
										value={query}
									/>
									<span className="text-muted-foreground text-xs tabular-nums">
										{segments.length}/{detail.segmentCount}
									</span>
									{detail.sourceFilePath && (
										<label className="flex items-center gap-1 whitespace-nowrap text-xs">
											<input
												checked={followPlayback}
												onChange={(event) => setFollowPlayback(event.target.checked)}
												type="checkbox"
											/>
											{t("webTranscripts.player.follow", { defaultValue: "Follow playback" })}
										</label>
									)}
								</div>
							)}

							{tab === "transcript" && (
								<div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
									{segments.map((segment) => {
										const speaker = segment.speakerId ? speakerNames.get(segment.speakerId) : undefined;
										return (
											<div
												className={`flex gap-3 rounded-md px-2 py-2 text-sm ${
													highlightId === segment.id
														? "bg-primary/15"
														: activeSegmentId === segment.id
															? "bg-muted"
															: ""
												}`}
												id={`seg-${segment.id}`}
												key={segment.id}
											>
												{speaker && <SpeakerAvatar index={speaker.index} name={speaker.name} />}
												<div className="min-w-0 flex-1">
													<div className="flex items-baseline gap-2">
														{speaker && (
															<span className={`font-medium ${speakerStyle(speaker.index).name}`}>
																{speaker.name}
															</span>
														)}
														<button
															className="text-muted-foreground text-xs tabular-nums hover:text-primary"
															onClick={() => playerRef.current?.seek(segment.startMs / 1000)}
															title={t("webTranscripts.player.seek", { defaultValue: "Play from here" })}
															type="button"
														>
															{formatClock(segment.startMs)}
														</button>
													</div>
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
						</div>
					</div>
				</div>
			) : null}
		</AppShell>
	);
};
