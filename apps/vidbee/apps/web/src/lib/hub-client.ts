// Host glue (not upstream): typed client for the /hub transcript + AI endpoints (apps/api/src/lib/hub-router.ts).
import { apiUrl } from "./orpc-client";

export type TranscriptState = "none" | "running" | "ready" | "no-speech" | "failed";

export interface LibraryItem {
	id: string;
	title: string;
	url: string | null;
	mediaKind: "audio" | "video";
	createdAt: number;
	state: TranscriptState;
	stage: string | null;
	error: string | null;
}

export interface HubSpeaker {
	id: string;
	key: string;
	name: string;
}

export interface HubSegment {
	id: string;
	speakerId: string | null;
	startMs: number;
	endMs: number;
	text: string;
}

export interface TranscriptDetail {
	id: string;
	title: string | null;
	mediaKind: "audio" | "video";
	state: TranscriptState;
	stage: string | null;
	error: string | null;
	record: {
		id: string;
		language: string | null;
		sourceKind: string;
		resultKind: string;
		speakers: HubSpeaker[];
		segments: HubSegment[];
	} | null;
}

export interface AiConfig {
	settings: { presetId: string; baseUrl: string; model: string; hasApiKey: boolean };
	providers: Array<{ id: string; defaultModel: string; needsApiKey: boolean; requiresBaseUrl: boolean }>;
	prompts: Array<{ name: string; description: string }>;
}

export const hubUrl = (path: string): string => `${apiUrl}/hub${path}`;

const hub = async <T>(path: string, init?: { body?: unknown; method?: string }): Promise<T> => {
	const response = await fetch(hubUrl(path), {
		method: init?.method ?? (init?.body === undefined ? "GET" : "POST"),
		headers: init?.body === undefined ? undefined : { "content-type": "application/json" },
		body: init?.body === undefined ? undefined : JSON.stringify(init.body),
	});
	const data = (await response.json().catch(() => ({}))) as { message?: string };
	if (!response.ok) {
		throw new Error(data.message ?? `Request failed (${response.status})`);
	}
	return data as T;
};

export const hubApi = {
	library: () => hub<{ items: LibraryItem[] }>("/library"),
	transcript: (id: string) => hub<TranscriptDetail>(`/transcripts/${id}`),
	start: (id: string, force = false) =>
		hub<{ ok: boolean }>(`/transcripts/${id}/start`, { body: { force } }),
	renameSpeaker: (id: string, speakerId: string, name: string) =>
		hub<{ ok: boolean }>(`/transcripts/${id}/speakers`, { body: { speakerId, name } }),
	aiConfig: () => hub<AiConfig>("/ai/config"),
	saveAi: (settings: { apiKey?: string; baseUrl?: string; model?: string; presetId?: string }) =>
		hub<{ settings: AiConfig["settings"] }>("/ai/settings", { body: settings }),
	runPrompt: (downloadId: string, prompt: string, language: string) =>
		hub<{ text: string }>("/ai/run", { body: { downloadId, prompt, language } }),
	chat: (downloadId: string, messages: Array<{ role: "user" | "assistant"; content: string }>) =>
		hub<{ text: string }>("/ai/chat", { body: { downloadId, messages } }),
	mediaUrl: (id: string) => hubUrl(`/media/${id}`),
	exportUrl: (id: string, format: string) => hubUrl(`/transcripts/${id}/export?format=${format}`),
};
