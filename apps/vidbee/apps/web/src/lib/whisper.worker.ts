/// <reference lib="webworker" />
/**
 * Runs Whisper in a worker with Transformers.js (Apache-2.0), on WebGPU when asked
 * and available, otherwise WASM. Models download from the Hugging Face Hub on first
 * use and are cached by the browser, so later runs work offline.
 */
import { env, pipeline } from "@huggingface/transformers";

env.allowLocalModels = false;

export interface WhisperRequest {
	audio: Float32Array;
	model: string;
	/** Omit for English-only models or automatic detection. */
	language?: string;
	device: "wasm" | "webgpu";
}

export type WhisperMessage =
	| { type: "download"; fraction: number; file: string }
	| { type: "status"; status: "loading" | "transcribing" }
	| { type: "done"; chunks: Array<{ text: string; start: number; end: number | null }> }
	| { type: "error"; message: string };

const post = (message: WhisperMessage) => self.postMessage(message);

type Recognizer = (
	audio: Float32Array,
	options: Record<string, unknown>,
) => Promise<{ text: string; chunks?: Array<{ text: string; timestamp: [number, number | null] }> }>;

let cached: { key: string; recognizer: Recognizer } | null = null;

self.onmessage = async (event: MessageEvent<WhisperRequest>) => {
	const { audio, model, language, device } = event.data;
	try {
		const key = `${model}:${device}`;
		if (cached?.key !== key) {
			post({ type: "status", status: "loading" });
			const bytes = new Map<string, { loaded: number; total: number }>();
			const recognizer = (await pipeline("automatic-speech-recognition", model, {
				device,
				dtype: device === "webgpu" ? { encoder_model: "fp32", decoder_model_merged: "q4" } : { encoder_model: "fp32", decoder_model_merged: "q8" },
				progress_callback: (info: { status: string; file?: string; loaded?: number; total?: number }) => {
					if (info.status === "progress" && info.file && info.total) {
						bytes.set(info.file, { loaded: info.loaded ?? 0, total: info.total });
						let loaded = 0;
						let total = 0;
						for (const item of bytes.values()) {
							loaded += item.loaded;
							total += item.total;
						}
						post({ type: "download", fraction: total ? loaded / total : 0, file: info.file });
					}
				},
			})) as unknown as Recognizer;
			cached = { key, recognizer };
		}
		post({ type: "status", status: "transcribing" });
		const multilingual = !/\.en$/.test(model);
		const result = await cached.recognizer(audio, {
			return_timestamps: true,
			chunk_length_s: 30,
			stride_length_s: 5,
			...(multilingual ? { task: "transcribe", ...(language ? { language } : {}) } : {}),
		});
		post({
			type: "done",
			chunks: (result.chunks ?? [{ text: result.text, timestamp: [0, null] as [number, number | null] }]).map((chunk) => ({
				text: chunk.text.trim(),
				start: chunk.timestamp[0],
				end: chunk.timestamp[1],
			})),
		});
	} catch (error) {
		post({ type: "error", message: error instanceof Error ? error.message : String(error) });
	}
};
