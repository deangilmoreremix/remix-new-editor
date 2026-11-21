import { languages } from "@vidbee/i18n/languages";
import { Button } from "@vidbee/ui/components/ui/button";
import type { WebAiRun, WebAiSettings, WebAiSkill } from "@vidbee/transcription/web-contract";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { notify } from "../../lib/notify";
import { aiClient, orpcClient } from "../../lib/orpc-client";
import {
	canCopyImage,
	canShareImage,
	copyImage,
	downloadBlob,
	renderNodeToPng,
	shareImage,
} from "../../lib/share-image";
import { useLiveStream } from "../../lib/use-live-stream";
import { AiSettingsForm } from "./ai-settings-form";
import { ChaptersView, parseChapters } from "./chapters-view";
import { MarkdownView } from "./markdown-view";
import { PromptManager } from "./prompt-manager";

const messageOf = (error: unknown): string =>
	error instanceof Error && error.message ? error.message : "Request failed";

/** Turn the server's error text into a plain explanation, and say whether settings can fix it. */
const explainError = (message: string): { text: string; settings: boolean } => {
	if (/Add an OpenAI API key/i.test(message)) {
		return { text: "No API key is set yet.", settings: true };
	}
	if (/OpenAI error 401|Incorrect API key|invalid api key/i.test(message)) {
		return { text: "The provider rejected the API key.", settings: true };
	}
	if (/Enter a model ID|model_not_found|does not exist|model.*not found|OpenAI error 404/i.test(message)) {
		return { text: `The model ID was not accepted. ${message}`, settings: true };
	}
	if (/fetch failed|ECONN|ENOTFOUND|EAI_AGAIN|network|timed? ?out|terminated/i.test(message)) {
		return { text: "The provider could not be reached. Check the base URL and your connection.", settings: true };
	}
	if (/returned no text/i.test(message)) {
		return { text: "The model returned no text. Run it again or try another model.", settings: true };
	}
	return { text: message, settings: false };
};

/** Name of the interface language for the `{{uiLanguage}}` token, for example "English" or "中文". */
const languageName = (code: string): string => {
	const exact = languages[code as keyof typeof languages];
	const base = languages[code.split("-")[0] as keyof typeof languages];
	return (exact ?? base)?.name ?? "English";
};

export const AiSummaryPanel = ({
	downloadId,
	hasTranscript,
	title,
	author,
	onJump,
}: {
	downloadId: string;
	hasTranscript: boolean;
	title: string;
	author: string | null;
	/** Open the transcript at this many seconds from the start. */
	onJump: (seconds: number) => void;
}) => {
	const { t, i18n } = useTranslation();
	const [settings, setSettings] = useState<WebAiSettings | null>(null);
	const [skills, setSkills] = useState<WebAiSkill[]>([]);
	const [runs, setRuns] = useState<Record<string, WebAiRun>>({});
	const [skillId, setSkillId] = useState("overview");
	const [showSettings, setShowSettings] = useState(false);
	const [showManager, setShowManager] = useState(false);
	const [watermark, setWatermark] = useState(false);
	const [capturing, setCapturing] = useState(false);
	const [elapsed, setElapsed] = useState(0);
	const cardRef = useRef<HTMLDivElement>(null);
	const language = languageName(i18n.language);

	const refreshRuns = useCallback(async () => {
		try {
			const list = await aiClient.list({ downloadId });
			setRuns(Object.fromEntries(list.map((run) => [run.skillId, run])));
		} catch (error) {
			toast.error(messageOf(error));
		}
	}, [downloadId]);

	useEffect(() => {
		void (async () => {
			try {
				const [nextSettings, nextSkills] = await Promise.all([aiClient.settingsGet(), aiClient.skills()]);
				setSettings(nextSettings);
				setSkills(nextSkills);
				setSkillId((current) =>
					nextSkills.some((skill) => skill.id === current) ? current : (nextSkills.find((s) => s.visible)?.id ?? current),
				);
				if (!(nextSettings.hasApiKey || nextSettings.locked)) {
					setShowSettings(true);
				}
			} catch (error) {
				toast.error(messageOf(error));
			}
		})();
		void orpcClient.settings
			.get()
			.then((result) => setWatermark(Boolean(result.settings.shareWatermark)))
			.catch(() => undefined);
	}, []);

	useEffect(() => {
		void refreshRuns();
	}, [refreshRuns]);

	const current = runs[skillId];
	const busy = current?.status === "running";
	const anyRunning = Object.values(runs).some((item) => item.status === "running");
	const active = skills.find((skill) => skill.id === skillId);

	// Live text for the selected prompt while it runs; polling covers other prompts and is the fallback.
	const streaming = useLiveStream(
		busy,
		{ channel: "ai", downloadId, skillId },
		{
			onState: (state) => {
				if (state && typeof state === "object") {
					setRuns((previous) => ({ ...previous, [skillId]: state as WebAiRun }));
				}
			},
			onDelta: (delta) => {
				setRuns((previous) => {
					const existing = previous[skillId];
					return existing
						? { ...previous, [skillId]: { ...existing, text: existing.text + delta } }
						: previous;
				});
			},
		},
	);

	useEffect(() => {
		if (!anyRunning || streaming) {
			return;
		}
		const timer = window.setInterval(() => void refreshRuns(), 1000);
		return () => window.clearInterval(timer);
	}, [anyRunning, streaming, refreshRuns]);

	// Seconds since this run started, so a slow model never looks frozen.
	useEffect(() => {
		if (!busy) {
			setElapsed(0);
			return;
		}
		const started = Date.now();
		const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
		return () => window.clearInterval(timer);
	}, [busy]);

	// Tell the user when a prompt they started finishes while the tab is in the background.
	const lastStatus = useRef<Record<string, string>>({});
	useEffect(() => {
		for (const item of Object.values(runs)) {
			const before = lastStatus.current[item.skillId];
			if (before === "running" && item.status !== "running" && item.status !== "cancelled") {
				notify(
					item.status === "completed"
						? t("webTranscripts.notify.summaryDone", { defaultValue: "AI summary ready" })
						: t("webTranscripts.notify.summaryFailed", { defaultValue: "AI summary failed" }),
					skills.find((skill) => skill.id === item.skillId)?.title ?? item.skillId,
				);
			}
			lastStatus.current[item.skillId] = item.status;
		}
	}, [runs, skills, t]);

	const run = useCallback(
		async (id: string) => {
			try {
				const started = await aiClient.run({ downloadId, skillId: id, language });
				setRuns((previous) => ({ ...previous, [id]: started }));
			} catch (error) {
				const message = messageOf(error);
				setRuns((previous) => ({
					...previous,
					[id]: { downloadId, skillId: id, status: "failed", text: "", error: message, model: null, updatedAt: Date.now() },
				}));
			}
		},
		[downloadId, language],
	);

	/** Choosing a prompt starts it the first time, like upstream. */
	const choose = (id: string) => {
		setSkillId(id);
		setShowManager(false);
		if (hasTranscript && settings?.hasApiKey && !runs[id]) {
			void run(id);
		}
	};

	const stop = async () => {
		try {
			await aiClient.cancel({ downloadId, skillId });
			void refreshRuns();
		} catch (error) {
			toast.error(messageOf(error));
		}
	};

	const text = current?.text ?? "";
	const completed = current?.status === "completed" && Boolean(text);
	const isChapters = skillId === "chapters";
	const imageName = `${(active?.title ?? skillId).replace(/[^\w]+/g, "-").toLowerCase()}.png`;

	/** Draw the result card, with the watermark footer only while capturing. */
	const capture = async (): Promise<Blob | null> => {
		if (!cardRef.current) {
			return null;
		}
		try {
			setCapturing(true);
			await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
			return await renderNodeToPng(cardRef.current);
		} catch (error) {
			toast.error(messageOf(error));
			return null;
		} finally {
			setCapturing(false);
		}
	};

	const saveImage = async () => {
		const blob = await capture();
		if (blob) {
			downloadBlob(blob, imageName);
		}
	};
	const copyImageToClipboard = async () => {
		const blob = await capture();
		if (!blob) {
			return;
		}
		try {
			await copyImage(blob);
			toast.success(t("webTranscripts.ai.imageCopied", { defaultValue: "Image copied" }));
		} catch (error) {
			toast.error(messageOf(error));
		}
	};
	const shareImageSheet = async () => {
		const blob = await capture();
		if (blob && canShareImage(imageName, blob)) {
			try {
				await shareImage(blob, imageName, title);
			} catch (error) {
				if (!(error instanceof DOMException && error.name === "AbortError")) {
					toast.error(messageOf(error));
				}
			}
		} else if (blob) {
			downloadBlob(blob, imageName);
		}
	};
	const copyMarkdown = async () => {
		try {
			await navigator.clipboard.writeText(text);
			toast.success(t("webTranscripts.ai.copied", { defaultValue: "Copied" }));
		} catch (error) {
			toast.error(messageOf(error));
		}
	};

	const visible = useMemo(() => skills.filter((skill) => skill.visible), [skills]);
	const others = useMemo(() => skills.filter((skill) => !skill.visible), [skills]);
	const failure = current?.error ? explainError(current.error) : null;
	const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="flex flex-wrap items-center gap-2 border-b p-3">
				{visible.map((skill) => (
					<Button
						key={skill.id}
						onClick={() => choose(skill.id)}
						size="sm"
						title={skill.description}
						variant={skill.id === skillId && !showManager ? "default" : "outline"}
					>
						{skill.icon} {skill.title}
					</Button>
				))}
				{others.length > 0 && (
					<select
						aria-label="All prompts"
						className="rounded border bg-background px-2 py-1 text-sm"
						onChange={(event) => event.target.value && choose(event.target.value)}
						value={others.some((skill) => skill.id === skillId) && !showManager ? skillId : ""}
					>
						<option value="">{t("webTranscripts.prompts.all", { defaultValue: "All prompts" })}</option>
						{others.map((skill) => (
							<option key={skill.id} value={skill.id}>
								{skill.icon} {skill.title}
							</option>
						))}
					</select>
				)}
				<span className="mr-auto" />
				<Button onClick={() => setShowManager((value) => !value)} size="sm" variant="ghost">
					{t("webTranscripts.prompts.manage", { defaultValue: "Edit prompts" })}
				</Button>
				<Button onClick={() => setShowSettings((value) => !value)} size="sm" variant="ghost">
					{t("webTranscripts.ai.settings", { defaultValue: "OpenAI settings" })}
				</Button>
			</div>
			<div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
				{showSettings && settings?.locked && (
					<p className="text-muted-foreground text-sm">
						{t("webTranscripts.ai.locked", { defaultValue: "OpenAI settings are managed by the server." })}
					</p>
				)}
				{showSettings && settings && !settings.locked && (
					<AiSettingsForm
						onSaved={(next) => {
							setSettings(next);
							if (next.hasApiKey) {
								setShowSettings(false);
							}
						}}
						settings={settings}
					/>
				)}

				{showManager ? (
					<PromptManager languageName={language} onChange={setSkills} skills={skills} />
				) : (
					<>
						<div className="flex flex-wrap items-center gap-2">
							<Button
								disabled={busy || !hasTranscript || !settings?.hasApiKey || !active}
								onClick={() => void run(skillId)}
								size="sm"
							>
								{current?.text
									? t("webTranscripts.ai.rerun", { defaultValue: "Run again" })
									: t("webTranscripts.ai.run", { defaultValue: "Run" })}
							</Button>
							{busy && (
								<Button onClick={() => void stop()} size="sm" variant="outline">
									{t("webTranscripts.ai.stop", { defaultValue: "Stop" })}
								</Button>
							)}
							{completed && !isChapters && (
								<Button onClick={() => void copyMarkdown()} size="sm" variant="outline">
									{t("webTranscripts.ai.copy", { defaultValue: "Copy" })}
								</Button>
							)}
							{completed && (
								<>
									<Button onClick={() => void saveImage()} size="sm" variant="outline">
										{t("webTranscripts.ai.saveImage", { defaultValue: "Save as image" })}
									</Button>
									{canCopyImage() && (
										<Button onClick={() => void copyImageToClipboard()} size="sm" variant="outline">
											{t("webTranscripts.ai.copyImage", { defaultValue: "Copy image" })}
										</Button>
									)}
									{canShare && (
										<Button onClick={() => void shareImageSheet()} size="sm" variant="outline">
											{t("webTranscripts.ai.share", { defaultValue: "Share…" })}
										</Button>
									)}
								</>
							)}
							{busy && (
								<span className="text-muted-foreground text-xs tabular-nums" data-testid="ai-elapsed">
									{t("webTranscripts.ai.working", { defaultValue: "Working…" })} {elapsed}s
								</span>
							)}
							{settings && <span className="ml-auto text-muted-foreground text-xs">{settings.model}</span>}
						</div>

						{!hasTranscript && (
							<p className="text-muted-foreground text-sm">
								{t("webTranscripts.ai.needTranscript", {
									defaultValue:
										"This download has no transcript text yet. Transcribe it first (a file marked “no speech” needs Transcribe anyway).",
								})}
							</p>
						)}

						{failure && (
							<div className="space-y-2" data-testid="ai-error">
								<p className="text-destructive text-sm">{failure.text}</p>
								{failure.settings && !settings?.locked && (
									<Button onClick={() => setShowSettings(true)} size="sm" variant="outline">
										{t("webTranscripts.ai.openSettings", { defaultValue: "Open provider settings" })}
									</Button>
								)}
							</div>
						)}

						{(text || completed) && (
							<div className="max-w-2xl space-y-3 bg-background p-4" data-testid="ai-card" ref={cardRef}>
								<div>
									<div className="font-semibold">{title}</div>
									<div className="text-muted-foreground text-xs">
										{active?.icon} {active?.title}
									</div>
								</div>
								{isChapters ? (
									completed &&
									(() => {
										const data = parseChapters(text);
										return data ? <ChaptersView data={data} onJump={onJump} /> : null;
									})()
								) : (
									<MarkdownView streaming={busy} text={text} />
								)}
								{capturing && watermark && (
									<div className="border-t pt-2 text-muted-foreground text-xs" data-testid="ai-watermark">
										{[title, author, "VidBee"].filter(Boolean).join(" · ")}
									</div>
								)}
							</div>
						)}

						{busy && (isChapters || !text) && (
							<p className="text-muted-foreground text-sm">
								{t("webTranscripts.ai.waiting", { defaultValue: "Waiting for the model…" })}
							</p>
						)}
					</>
				)}
			</div>
		</div>
	);
};
