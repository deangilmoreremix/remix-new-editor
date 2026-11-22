/**
 * Bring your own key: the visitor's OpenAI key lives in this browser only (localStorage), is sent with each AI
 * request in a header, and is never stored on the server.
 */
const KEY = "smartvid-openai";

interface Stored {
	apiKey?: string;
	model?: string;
}

const read = (): Stored => {
	if (typeof window === "undefined") {
		return {};
	}
	try {
		const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Stored;
		return {
			apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : undefined,
			model: typeof parsed.model === "string" ? parsed.model : undefined,
		};
	} catch {
		return {};
	}
};

export const saveOpenAiKey = (next: Stored): void => {
	try {
		window.localStorage.setItem(KEY, JSON.stringify({ ...read(), ...next }));
	} catch {
		throw new Error("This browser blocks saving the key (private window or blocked site data).");
	}
};

export const clearOpenAiKey = (): void => {
	try {
		const { model } = read();
		window.localStorage.setItem(KEY, JSON.stringify({ model }));
	} catch {
		// nothing stored
	}
};

export const openAiHeaders = (): Record<string, string> => {
	const { apiKey, model } = read();
	const headers: Record<string, string> = {};
	if (apiKey) {
		headers["x-smartvid-openai-key"] = apiKey;
	}
	if (model) {
		headers["x-smartvid-openai-model"] = model;
	}
	return headers;
};
