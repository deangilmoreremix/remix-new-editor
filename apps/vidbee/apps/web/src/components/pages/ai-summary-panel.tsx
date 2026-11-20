import { Button } from "@vidbee/ui/components/ui/button";
import { Input } from "@vidbee/ui/components/ui/input";
import type {
	WebAiRun,
	WebAiSettings,
	WebAiSkill,
} from "@vidbee/transcription/web-contract";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { aiClient } from "../../lib/orpc-client";

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
			toast.success(t("transcript.ai.saved", { defaultValue: "AI settings saved" }));
		} catch (error) {
			toast.error(messageOf(error));
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="max-w-md space-y-3 rounded-md border p-4 text-sm">
			<div className="font-medium">
				{t("transcript.ai.settings", { defaultValue: "OpenAI settings" })}
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
					{t("transcript.ai.save", { defaultValue: "Save" })}
				</Button>
				{settings.hasApiKey && !settings.keyFromEnv && (
					<Button disabled={saving} onClick={() => void save(true)} size="sm" variant="outline">
						{t("transcript.ai.removeKey", { defaultValue: "Remove key" })}
					</Button>
				)}
			</div>
			<p className="text-muted-foreground text-xs">
				{t("transcript.ai.privacy", {
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
}: {
	downloadId: string;
	hasTranscript: boolean;
}) => {
	const { t, i18n } = useTranslation();
	const [settings, setSettings] = useState<WebAiSettings | null>(null);
	const [skills, setSkills] = useState<WebAiSkill[]>([]);
	const [runs, setRuns] = useState<Record<string, WebAiRun>>({});
	const [skillId, setSkillId] = useState("overview");
	const [showSettings, setShowSettings] = useState(false);

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
				if (!nextSettings.hasApiKey) {
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

	const running = Object.values(runs).some((run) => run.status === "running");
	useEffect(() => {
		if (!running) {
			return;
		}
		const timer = window.setInterval(() => void refreshRuns(), 1000);
		return () => window.clearInterval(timer);
	}, [running, refreshRuns]);

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

	const current = runs[skillId];
	const busy = current?.status === "running";

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
					{t("transcript.ai.settings", { defaultValue: "OpenAI settings" })}
				</Button>
			</div>
			<div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
				{showSettings && settings && (
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
							? t("transcript.ai.rerun", { defaultValue: "Run again" })
							: t("transcript.ai.run", { defaultValue: "Run" })}
					</Button>
					{busy && (
						<Button onClick={() => void stop()} size="sm" variant="outline">
							{t("transcript.cancel", { defaultValue: "Cancel" })}
						</Button>
					)}
					{!hasTranscript && (
						<span className="text-muted-foreground text-xs">
							{t("transcript.ai.needTranscript", {
								defaultValue: "Transcribe this download first.",
							})}
						</span>
					)}
					{settings && (
						<span className="ml-auto text-muted-foreground text-xs">{settings.model}</span>
					)}
				</div>
				{current?.error && <p className="text-destructive text-sm">{current.error}</p>}
				{current?.text && <SimpleMarkdown text={current.text} />}
				{busy && !current?.text && (
					<p className="text-muted-foreground text-sm">
						{t("transcript.ai.working", { defaultValue: "Waiting for the model…" })}
					</p>
				)}
			</div>
		</div>
	);
};
