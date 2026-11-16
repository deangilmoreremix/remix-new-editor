// Host glue (not upstream): Transcripts page — captions with speaker labels, AI summarize / translate / chat.
// Backed by /hub (apps/api/src/lib/hub-router.ts), which uses upstream's transcript store and built-in prompts.
import { Badge } from "@vidbee/ui/components/ui/badge";
import { Button } from "@vidbee/ui/components/ui/button";
import { Input } from "@vidbee/ui/components/ui/input";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "../layout/app-shell";
import {
	type AiConfig,
	hubApi,
	type LibraryItem,
	type TranscriptDetail,
} from "../../lib/hub-client";

const FORMATS = ["txt", "md", "srt", "vtt"] as const;
const STATE_LABEL: Record<string, string> = {
	none: "Not transcribed",
	running: "Transcribing…",
	ready: "Transcript ready",
	"no-speech": "No speech found",
	failed: "Failed",
};
const TIMESTAMP = /\[((?:\d+:)?\d{1,2}:\d{2})\]/g;

const clock = (ms: number): string => {
	const total = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = String(total % 60).padStart(2, "0");
	return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
};
const parseClock = (value: string): number =>
	value.split(":").reduce((acc, part) => acc * 60 + Number(part), 0);

/** Inline text: **bold** and clickable [m:ss] timestamps (no HTML injection, everything is a React node). */
const inline = (text: string, seek: (seconds: number) => void, keyBase: string): ReactNode[] => {
	const out: ReactNode[] = [];
	for (const [i, part] of text.split(/(\*\*[^*]+\*\*)/g).entries()) {
		if (part.startsWith("**") && part.endsWith("**")) {
			out.push(<strong key={`${keyBase}-b${i}`}>{part.slice(2, -2)}</strong>);
			continue;
		}
		let last = 0;
		for (const match of part.matchAll(TIMESTAMP)) {
			out.push(part.slice(last, match.index));
			out.push(
				<button className="font-semibold text-primary" key={`${keyBase}-t${i}-${match.index}`} onClick={() => seek(parseClock(match[1]))} type="button">
					[{match[1]}]
				</button>,
			);
			last = (match.index ?? 0) + match[0].length;
		}
		out.push(part.slice(last));
	}
	return out;
};

const Markdown = ({ text, seek }: { text: string; seek: (seconds: number) => void }) => {
	const blocks: ReactNode[] = [];
	let bullets: ReactNode[] = [];
	const flush = (key: string) => {
		if (bullets.length > 0) {
			blocks.push(<ul className="my-2 ml-5 list-disc space-y-1" key={key}>{bullets}</ul>);
			bullets = [];
		}
	};
	for (const [i, line] of text.split("\n").entries()) {
		const bullet = /^\s*(?:[-*•]|\d+\.)\s+(.*)/.exec(line);
		if (bullet) {
			bullets.push(<li key={`li${i}`}>{inline(bullet[1], seek, `li${i}`)}</li>);
			continue;
		}
		flush(`ul${i}`);
		const heading = /^#{1,4}\s+(.*)/.exec(line);
		if (heading) {
			blocks.push(<h4 className="mt-3 mb-1 font-semibold" key={`h${i}`}>{inline(heading[1], seek, `h${i}`)}</h4>);
		} else if (line.trim()) {
			blocks.push(<p className="my-1" key={`p${i}`}>{inline(line, seek, `p${i}`)}</p>);
		}
	}
	flush("ul-end");
	return <div className="text-sm leading-relaxed">{blocks}</div>;
};

const SpeakerName = ({ name, onCommit }: { name: string; onCommit: (value: string) => void }) => {
	const [value, setValue] = useState(name);
	useEffect(() => setValue(name), [name]);
	return (
		<Input
			aria-label={`Rename speaker ${name}`}
			className="h-8 w-32"
			onBlur={() => value.trim() && value !== name && onCommit(value.trim())}
			onChange={(event) => setValue(event.target.value)}
			onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
			value={value}
		/>
	);
};

const AiSettingsPanel = ({ config, onSaved }: { config: AiConfig; onSaved: () => void }) => {
	const [presetId, setPresetId] = useState(config.settings.presetId);
	const [baseUrl, setBaseUrl] = useState(config.settings.baseUrl);
	const [model, setModel] = useState(config.settings.model);
	const [apiKey, setApiKey] = useState("");
	const [message, setMessage] = useState("");
	const preset = config.providers.find((p) => p.id === presetId);
	const save = async () => {
		try {
			await hubApi.saveAi({ presetId, baseUrl, model, ...(apiKey ? { apiKey } : {}) });
			setApiKey("");
			setMessage("Saved");
			onSaved();
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Could not save");
		}
	};
	return (
		<div className="mb-4 grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
			<label className="text-xs">
				Provider
				<select className="mt-1 h-9 w-full rounded-md border bg-transparent px-2 text-sm" onChange={(e) => setPresetId(e.target.value)} value={presetId}>
					{config.providers.map((p) => <option key={p.id} value={p.id}>{p.id}</option>)}
				</select>
			</label>
			<label className="text-xs">
				Model
				<Input className="mt-1" onChange={(e) => setModel(e.target.value)} placeholder={preset?.defaultModel || "model name"} value={model} />
			</label>
			<label className="text-xs">
				Base URL {preset?.requiresBaseUrl ? "" : "(optional)"}
				<Input className="mt-1" onChange={(e) => setBaseUrl(e.target.value)} placeholder="provider default" value={baseUrl} />
			</label>
			<label className="text-xs">
				API key {config.settings.hasApiKey ? "(saved — leave blank to keep)" : ""}
				<Input autoComplete="off" className="mt-1" onChange={(e) => setApiKey(e.target.value)} type="password" value={apiKey} />
			</label>
			<div className="flex items-center gap-3 sm:col-span-2">
				<Button onClick={save} size="sm" type="button">Save</Button>
				<span className="text-muted-foreground text-xs">Stored on the server and shared by everyone allowed to use Media Hub.</span>
				{message ? <span className="text-xs">{message}</span> : null}
			</div>
		</div>
	);
};

const AiPane = ({ detail, seek }: { detail: TranscriptDetail; seek: (seconds: number) => void }) => {
	const { t } = useTranslation();
	const [config, setConfig] = useState<AiConfig | null>(null);
	const [showSettings, setShowSettings] = useState(false);
	const [output, setOutput] = useState("");
	const [busy, setBusy] = useState("");
	const [language, setLanguage] = useState("");
	const [chat, setChat] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
	const [question, setQuestion] = useState("");
	const logRef = useRef<HTMLDivElement>(null);
	const loadConfig = useCallback(() => void hubApi.aiConfig().then(setConfig).catch(() => undefined), []);
	useEffect(loadConfig, [loadConfig]);
	useEffect(() => {
		if (logRef.current) {
			logRef.current.scrollTop = logRef.current.scrollHeight;
		}
	}, [chat.length]);

	const run = async (prompt: string, lang = "en") => {
		setBusy(prompt);
		try {
			setOutput((await hubApi.runPrompt(detail.id, prompt, lang)).text);
		} catch (error) {
			setOutput(`**Error:** ${error instanceof Error ? error.message : "request failed"}`);
		}
		setBusy("");
	};
	const send = async () => {
		const text = question.trim();
		if (!text) {
			return;
		}
		const next = [...chat, { role: "user" as const, content: text }];
		setChat(next);
		setQuestion("");
		try {
			const reply = await hubApi.chat(detail.id, next);
			setChat([...next, { role: "assistant", content: reply.text }]);
		} catch (error) {
			setChat([...next, { role: "assistant", content: `⚠ ${error instanceof Error ? error.message : "request failed"}` }]);
		}
	};

	if (!config) {
		return <p className="text-muted-foreground text-sm">Loading…</p>;
	}
	const needsKey = !config.settings.hasApiKey && config.providers.find((p) => p.id === config.settings.presetId)?.needsApiKey;
	return (
		<div>
			{needsKey || showSettings ? <AiSettingsPanel config={config} onSaved={loadConfig} /> : null}
			<div className="flex flex-wrap items-center gap-2">
				{config.prompts.filter((p) => p.name !== "translate").map((p) => (
					<Button disabled={Boolean(busy)} key={p.name} onClick={() => void run(p.name)} size="sm" title={p.description} type="button" variant="outline">
						{t(`settings.ai.presetSkills.${p.name}.name`, { defaultValue: p.name })}
					</Button>
				))}
				<Input aria-label="Translate to (language code)" className="h-8 w-28" onChange={(e) => setLanguage(e.target.value)} placeholder="es, fr, ja…" value={language} />
				<Button disabled={Boolean(busy) || !language.trim()} onClick={() => void run("translate", language.trim())} size="sm" type="button" variant="outline">
					{t("settings.ai.presetSkills.translate.name", { defaultValue: "Translate" })}
				</Button>
				<Button onClick={() => setShowSettings((v) => !v)} size="sm" type="button" variant="outline">AI settings</Button>
			</div>
			<div className="mt-3 min-h-20 rounded-lg border p-4">
				{busy ? <p className="text-muted-foreground text-sm">Running {busy}…</p> : output ? <Markdown seek={seek} text={output} /> : <p className="text-muted-foreground text-sm">Pick a prompt to generate output from the transcript.</p>}
			</div>
			<h3 className="mt-6 mb-2 font-semibold text-xs uppercase tracking-wide">Chat with the transcript</h3>
			<div className="flex max-h-64 flex-col gap-2 overflow-auto" ref={logRef}>
				{chat.map((m, i) => (
					<div className={`max-w-[85%] rounded-lg border px-3 py-2 text-sm ${m.role === "user" ? "self-end border-primary/50" : "self-start"}`} key={`${m.role}-${i}`}>
						{m.role === "user" ? m.content : <Markdown seek={seek} text={m.content} />}
					</div>
				))}
			</div>
			<div className="mt-2 flex gap-2">
				<Input aria-label="Ask about this video" onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void send()} placeholder="Ask about this video…" value={question} />
				<Button onClick={() => void send()} type="button">Send</Button>
			</div>
		</div>
	);
};

const DetailPane = ({ id, onChanged }: { id: string; onChanged: () => void }) => {
	const [detail, setDetail] = useState<TranscriptDetail | null>(null);
	const [tab, setTab] = useState<"captions" | "ai">("captions");
	const [query, setQuery] = useState("");
	const [error, setError] = useState("");
	const [now, setNow] = useState(0);
	const media = useRef<HTMLVideoElement & HTMLAudioElement>(null);
	const seek = useCallback((seconds: number) => {
		if (media.current) {
			media.current.currentTime = seconds;
			void media.current.play().catch(() => undefined);
		}
	}, []);

	const load = useCallback(async () => {
		try {
			setDetail(await hubApi.transcript(id));
			setError("");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not load");
		}
	}, [id]);
	useEffect(() => {
		void load();
	}, [load]);
	useEffect(() => {
		if (detail?.state !== "running") {
			return undefined;
		}
		const timer = setInterval(() => void load().then(onChanged), 2000);
		return () => clearInterval(timer);
	}, [detail?.state, load, onChanged]);

	const names = useMemo(() => new Map((detail?.record?.speakers ?? []).map((s) => [s.id, s.name])), [detail]);
	if (error) {
		return <p className="p-6 text-destructive text-sm">{error}</p>;
	}
	if (!detail) {
		return <p className="p-6 text-muted-foreground text-sm">Loading…</p>;
	}
	const start = async (force: boolean) => {
		try {
			await hubApi.start(id, force);
			await load();
			onChanged();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not start");
		}
	};
	const q = query.toLowerCase();
	const Media = detail.mediaKind === "audio" ? "audio" : "video";
	return (
		<div className="p-6">
			<h2 className="mb-3 truncate font-semibold">{detail.title ?? "Untitled"}</h2>
			<Media className={detail.mediaKind === "audio" ? "w-full" : "max-h-80 w-full rounded-lg bg-black"} controls onTimeUpdate={(e) => setNow(e.currentTarget.currentTime * 1000)} preload="metadata" ref={media} src={hubApi.mediaUrl(id)} />
			<div className="mt-4 flex items-center gap-2 border-b pb-2">
				<Button onClick={() => setTab("captions")} size="sm" type="button" variant={tab === "captions" ? "default" : "ghost"}>Transcript</Button>
				<Button disabled={!detail.record} onClick={() => setTab("ai")} size="sm" type="button" variant={tab === "ai" ? "default" : "ghost"}>AI · Summary &amp; chat</Button>
			</div>
			<div className="pt-4">
				{detail.state === "running" ? <p className="text-sm">Transcribing… {detail.stage ?? ""}</p> : null}
				{detail.state === "failed" ? <p className="mb-3 text-destructive text-sm">{detail.error}</p> : null}
				{!detail.record && detail.state !== "running" ? (
					<div className="flex items-center gap-3">
						<Button onClick={() => void start(false)} type="button">{detail.state === "failed" ? "Retry transcription" : "Transcribe"}</Button>
						<span className="text-muted-foreground text-xs">Uses VidBee&apos;s local speech models (downloaded on first use).</span>
					</div>
				) : null}
				{detail.record && tab === "captions" ? (
					<div>
						<div className="mb-3 flex flex-wrap items-center gap-2">
							<Input aria-label="Search transcript" className="h-8 max-w-xs" onChange={(e) => setQuery(e.target.value)} placeholder="Search text or speaker…" value={query} />
							{FORMATS.map((f) => (
								<Button asChild key={f} size="sm" variant="outline"><a href={hubApi.exportUrl(id, f)}>{f.toUpperCase()}</a></Button>
							))}
						</div>
						{detail.record.speakers.length > 0 ? (
							<div className="mb-3 flex flex-wrap items-center gap-2">
								<span className="text-muted-foreground text-xs">Speakers:</span>
								{detail.record.speakers.map((s) => (
									<SpeakerName key={`${s.id}-${s.name}`} name={s.name} onCommit={(value) => void hubApi.renameSpeaker(id, s.id, value).then(load)} />
								))}
							</div>
						) : null}
						<div className="max-h-[420px] overflow-auto">
							{detail.record.segments.filter((s) => !q || s.text.toLowerCase().includes(q) || (names.get(s.speakerId ?? "") ?? "").toLowerCase().includes(q)).map((s) => (
								<button
									className={`flex w-full gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent ${now >= s.startMs && now < s.endMs ? "bg-accent" : ""}`}
									key={s.id}
									onClick={() => seek(s.startMs / 1000)}
									type="button"
								>
									<span className="w-12 shrink-0 text-muted-foreground text-xs tabular-nums">{clock(s.startMs)}</span>
									<span>{s.speakerId && names.get(s.speakerId) ? <b className="text-primary">{names.get(s.speakerId)}: </b> : null}{s.text}</span>
								</button>
							))}
						</div>
						<div className="mt-3 flex items-center gap-3 text-muted-foreground text-xs">
							<span>{detail.record.language ?? "auto"} · {detail.record.sourceKind === "captions" ? "video captions" : "speech recognition"}</span>
							<Button onClick={() => void start(true)} size="sm" type="button" variant="outline">Re-transcribe</Button>
						</div>
					</div>
				) : null}
				{detail.record && tab === "ai" ? <AiPane detail={detail} seek={seek} /> : null}
			</div>
		</div>
	);
};

export const TranscriptsPage = () => {
	const [items, setItems] = useState<LibraryItem[]>([]);
	const [selected, setSelected] = useState<string | null>(null);
	const [error, setError] = useState("");
	const refresh = useCallback(async () => {
		try {
			const { items: list } = await hubApi.library();
			setItems(list);
			setError("");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not load library");
		}
	}, []);
	useEffect(() => {
		void refresh();
	}, [refresh]);
	return (
		<AppShell page="transcripts">
			<div className="grid min-h-full grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)]">
				<aside className="border-r p-4">
					<h1 className="mb-3 font-semibold">Transcripts</h1>
					{error ? <p className="text-destructive text-sm">{error}</p> : null}
					{items.length === 0 && !error ? <p className="text-muted-foreground text-sm">Download something first — completed downloads show up here.</p> : null}
					<div className="flex flex-col gap-1">
						{items.map((item) => (
							<button className={`rounded-lg border p-3 text-left hover:bg-accent ${selected === item.id ? "border-primary/60 bg-accent" : "border-transparent"}`} key={item.id} onClick={() => setSelected(item.id)} type="button">
								<div className="truncate font-medium text-sm">{item.title}</div>
								<div className="mt-1 flex items-center gap-2">
									<Badge className={item.state === "ready" ? "border-primary/50 text-primary" : ""} variant="outline">{STATE_LABEL[item.state]}</Badge>
									<span className="text-muted-foreground text-xs">{item.mediaKind}</span>
								</div>
							</button>
						))}
					</div>
				</aside>
				<section className="min-w-0">
					{selected ? <DetailPane id={selected} key={selected} onChanged={() => void refresh()} /> : <p className="p-10 text-center text-muted-foreground text-sm">Select a download to read, search and chat with its transcript.</p>}
				</section>
			</div>
		</AppShell>
	);
};
