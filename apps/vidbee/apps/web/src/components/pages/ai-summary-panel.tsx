import { Button } from "@vidbee/ui/components/ui/button";
import { Input } from "@vidbee/ui/components/ui/input";
import type {
	WebAiRun,
	WebAiSettings,
	WebAiSkill,
} from "@vidbee/transcription/web-contract";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { aiClient } from "../../lib/orpc-client";
import { notify } from "../../lib/notify";
import { saveNodeAsPng } from "../../lib/share-image";
import { useLiveStream } from "../../lib/use-live-stream";

const messageOf = (error: unknown): string =>
	error instanceof Error && error.message ? error.message : "Request failed";

const prettySkill = (skill: WebAiSkill): string =>
	skill.id
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");

const inline = (text: string): ReactNode[] =>
	text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
		part.startsWith("**") && part.endsWith("**") ? (
			// biome-ignore lint/suspicious/noArrayIndexKey: static split of one string
			<strong key={index}>{part.slice(2, -2)}</strong>
		) : (
			part
		),
	);

interface ChaptersData {
	takeaway: string;
	chapters: Array<{ start_seconds: number; title: string; summary: string }>;
	quotes: Array<{ start_seconds: number; quote: string }>;
}

const parseChapters = (text: string): ChaptersData | null => {
	try {
		const data = JSON.parse(text) as ChaptersData;
		return Array.isArray(data.chapters) ? data : null;
	} catch {
		return null;
	}
};

const clockLabel = (seconds: number): string => {
	const total = Math.max(0, Math.floor(seconds));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = String(total % 60).padStart(2, "0");
	return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
};

const ChaptersView = ({
	data,
	onJump,
}: {
	data: ChaptersData;
	onJump: (seconds: number) => void;
}) => (
	<div className="space-y-4 text-sm">
		{data.takeaway && <h2 className="font-semibold text-base">{data.takeaway}</h2>}
		<ul className="space-y-2">
			{data.chapters.map((chapter) => (
				<li key={`${chapter.start_seconds}-${chapter.title}`}>
					<button
						className="flex w-full gap-3 rounded-md p-2 text-left hover:bg-muted"
						onClick={() => onJump(chapter.start_seconds)}
						type="button"
					>
						<span className="w-14 shrink-0 font-medium text-primary tabular-nums">
							{clockLabel(chapter.start_seconds)}
						</span>
						<span>
							<span className="block font-medium">{chapter.title}</span>
							<span className="text-muted-foreground">{chapter.summary}</span>
						</span>
					</button>
				</li>
			))}
		</ul>
		{data.quotes.length > 0 && (
			<div>
				<h3 className="mb-1 font-semibold">Key quotes</h3>
				<ul className="space-y-1">
					{data.quotes.map((quote) => (
						<li key={`${quote.start_seconds}-${quote.quote.slice(0, 20)}`}>
							<button
								className="flex w-full gap-3 rounded-md p-2 text-left hover:bg-muted"
								onClick={() => onJump(quote.start_seconds)}
								type="button"
							>
								<span className="w-14 shrink-0 font-medium text-primary tabular-nums">
									{clockLabel(quote.start_seconds)}
								</span>
								<span>“{quote.quote}”</span>
							</button>
						</li>
					))}
				</ul>
			</div>
		)}
	</div>
);

/** Minimal Markdown for the skill outputs: headings, bullet lists, bold. */
const SimpleMarkdown = ({ text }: { text: string }) => (
	<div className="space-y-1 text-sm">
		{text.split("\n").map((line, index) => {
			const key = `${index}`;
			if (line.startsWith("## ")) {
				return (
					<h3 className="mt-3 font-semibold" key={key}>
						{inline(line.slice(3))}
					</h3>
				);
			}
			if (line.startsWith("# ")) {
				return (
					<h2 className="font-semibold text-base" key={key}>
						{inline(line.slice(2))}
					</h2>
				);
			}
			const bullet = /^(\s*)[-*]\s+(.*)$/.exec(line);
			if (bullet) {
				return (
					<div
						className="flex gap-2"
						key={key}
						style={{ paddingLeft: `${Math.floor((bullet[1]?.length ?? 0) / 2) * 16}px` }}
					>
						<span>•</span>
						<span>{inline(bullet[2] ?? "")}</span>
					</div>
				);
			}
			return line.trim() ? <p key={key}>{inline(line)}</p> : null;
		})}
	</div>
);

const AiSettingsForm = ({
	settings,
	onSaved,
}: {
	settings: WebAiSettings;
	onSaved: (next: WebAiSettings) => void;
}) => {
	const { t } = useTranslation();
	const [apiKey, setApiKey] = useState("");
	const [model, setModel] = useState(settings.model);
	const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
	const [saving, setSaving] = useState(false);

	const save = async (clearApiKey = false) => {
		setSaving(true);
		try {
			const next = await aiClient.settingsSet({
				apiKey: apiKey.trim() || undefined,
				clearApiKey,
				baseUrl,
				model,
			});
			setApiKey("");
			onSaved(next);
			toast.success(t("webTranscripts.ai.saved", { defaultValue: "AI settings saved" }));
		} catch (error) {
			toast.error(messageOf(error));
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="max-w-md space-y-3 rounded-md border p-4 text-sm">
			<div className="font-medium">
				{t("webTranscripts.ai.settings", { defaultValue: "OpenAI settings" })}
			</div>
			<label className="block space-y-1">
				<span className="text-muted-foreground">API key</span>
				<Input
					autoComplete="off"
					onChange={(event) => setApiKey(event.target.value)}
					placeholder={
						settings.hasApiKey
							? `••••${settings.apiKeyHint ?? ""}${settings.keyFromEnv ? " (from server environment)" : ""}`
							: "sk-…"
					}
					type="password"
					value={apiKey}
				/>
			</label>
			<label className="block space-y-1">
				<span className="text-muted-foreground">Model</span>
				<Input onChange={(event) => setModel(event.target.value)} value={model} />
			</label>
			<label className="block space-y-1">
				<span className="text-muted-foreground">Base URL</span>
				<Input onChange={(event) => setBaseUrl(event.target.value)} value={baseUrl} />
			</label>
			<div className="flex gap-2">
				<Button disabled={saving} onClick={() => void save()} size="sm">
					{t("webTranscripts.ai.save", { defaultValue: "Save" })}
				</Button>
				{settings.hasApiKey && !settings.keyFromEnv && (
					<Button disabled={saving} onClick={() => void save(true)} size="sm" variant="outline">
						{t("webTranscripts.ai.removeKey", { defaultValue: "Remove key" })}
					</Button>
				)}
			</div>
			<p className="text-muted-foreground text-xs">
				{t("webTranscripts.ai.privacy", {
					defaultValue:
						"The key is stored on the server and never sent back to the browser. Transcript text is sent to this OpenAI endpoint when you run a summary.",
				})}
			</p>
		</div>
	);
};

export const AiSummaryPanel = ({
	downloadId,
	hasTranscript,
	onJump,
}: {
	downloadId: string;
	hasTranscript: boolean;
	/** Open the transcript at this many seconds from the start. */
	onJump: (seconds: number) => void;
}) => {
	const { t, i18n } = useTranslation();
	const [settings, setSettings] = useState<WebAiSettings | null>(null);
	const [skills, setSkills] = useState<WebAiSkill[]>([]);
	const [runs, setRuns] = useState<Record<string, WebAiRun>>({});
	const [skillId, setSkillId] = useState("overview");
	const [showSettings, setShowSettings] = useState(false);
	const resultRef = useRef<HTMLDivElement>(null);

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
				const [nextSettings, nextSkills] = await Promise.all([
					aiClient.settingsGet(),
					aiClient.skills(),
				]);
				setSettings(nextSettings);
				setSkills(nextSkills);
				if (!(nextSettings.hasApiKey || nextSettings.locked)) {
					setShowSettings(true);
				}
			} catch (error) {
				toast.error(messageOf(error));
			}
		})();
	}, []);

	useEffect(() => {
		void refreshRuns();
	}, [refreshRuns]);

	const current = runs[skillId];
	const busy = current?.status === "running";
	const anyRunning = Object.values(runs).some((item) => item.status === "running");

	// Tell the user when a summary they started finishes while the tab is in the background.
	const lastStatus = useRef<Record<string, string>>({});
	useEffect(() => {
		for (const item of Object.values(runs)) {
			const before = lastStatus.current[item.skillId];
			if (before === "running" && item.status !== "running" && item.status !== "cancelled") {
				notify(
					item.status === "completed"
						? t("webTranscripts.notify.summaryDone", { defaultValue: "AI summary ready" })
						: t("webTranscripts.notify.summaryFailed", { defaultValue: "AI summary failed" }),
					prettySkill({ id: item.skillId, name: item.skillId, description: "" }),
				);
			}
			lastStatus.current[item.skillId] = item.status;
		}
	}, [runs, t]);

	// Live text for the selected skill while it runs; polling covers other skills
	// and is the fallback when the stream is not connected.
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

	const run = async () => {
		try {
			const started = await aiClient.run({
				downloadId,
				skillId,
				language: i18n.language,
			});
			setRuns((current) => ({ ...current, [skillId]: started }));
		} catch (error) {
			toast.error(messageOf(error));
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

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="flex flex-wrap items-center gap-2 border-b p-3">
				{skills.map((skill) => (
					<Button
						key={skill.id}
						onClick={() => setSkillId(skill.id)}
						size="sm"
						title={skill.description}
						variant={skill.id === skillId ? "default" : "outline"}
					>
						{prettySkill(skill)}
					</Button>
				))}
				<span className="mr-auto" />
				<Button onClick={() => setShowSettings((value) => !value)} size="sm" variant="ghost">
					{t("webTranscripts.ai.settings", { defaultValue: "OpenAI settings" })}
				</Button>
			</div>
			<div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
				{showSettings && settings?.locked && (
					<p className="text-muted-foreground text-sm">
						{t("webTranscripts.ai.locked", {
							defaultValue: "OpenAI settings are managed by the server.",
						})}
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
				<div className="flex items-center gap-2">
					<Button
						disabled={busy || !hasTranscript || !settings?.hasApiKey}
						onClick={() => void run()}
						size="sm"
					>
						{current?.text
							? t("webTranscripts.ai.rerun", { defaultValue: "Run again" })
							: t("webTranscripts.ai.run", { defaultValue: "Run" })}
					</Button>
					{busy && (
						<Button onClick={() => void stop()} size="sm" variant="outline">
							{t("webTranscripts.cancel", { defaultValue: "Cancel" })}
						</Button>
					)}
					{!hasTranscript && (
						<span className="text-muted-foreground text-xs">
							{t("webTranscripts.ai.needTranscript", {
								defaultValue: "Transcribe this download first.",
							})}
						</span>
					)}
					{settings && (
						<span className="ml-auto text-muted-foreground text-xs">{settings.model}</span>
					)}
				</div>
				{current?.error && <p className="text-destructive text-sm">{current.error}</p>}
				{current?.status === "completed" && current.text && (
					<Button
						onClick={() =>
							resultRef.current &&
							void saveNodeAsPng(resultRef.current, `${prettySkill({ id: skillId, name: skillId, description: "" }).replace(/\s+/g, "-").toLowerCase()}.png`).catch(
								(cause) => toast.error(messageOf(cause)),
							)
						}
						size="sm"
						variant="outline"
					>
						{t("webTranscripts.ai.saveImage", { defaultValue: "Save as image" })}
					</Button>
				)}
				<div className="max-w-2xl bg-background p-3" ref={resultRef}>
				{skillId === "chapters"
					? current?.status === "completed" &&
						(() => {
							const data = parseChapters(current.text);
							return data ? <ChaptersView data={data} onJump={onJump} /> : null;
						})()
					: current?.text && <SimpleMarkdown text={current.text} />}
				</div>
				{busy && (skillId === "chapters" || !current?.text) && (
					<p className="text-muted-foreground text-sm">
						{t("webTranscripts.ai.working", { defaultValue: "Waiting for the model…" })}
					</p>
				)}
			</div>
		</div>
	);
};
