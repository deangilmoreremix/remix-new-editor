/**
 * Transcribe a media file entirely in the browser (Whisper via Transformers.js).
 * Decodes to 16 kHz mono, runs the worker, and returns timed cues.
 */
import type { WhisperMessage, WhisperRequest } from "./whisper.worker";

export interface LocalModel {
	id: string;
	label: string;
	/** Rough first-download size. */
	size: string;
	multilingual: boolean;
}

export const LOCAL_MODELS: LocalModel[] = [
	{ id: "onnx-community/whisper-tiny.en", label: "Tiny (English)", size: "≈ 40 MB", multilingual: false },
	{ id: "onnx-community/whisper-base.en", label: "Base (English)", size: "≈ 80 MB", multilingual: false },
	{ id: "onnx-community/whisper-tiny", label: "Tiny (multilingual)", size: "≈ 40 MB", multilingual: true },
	{ id: "onnx-community/whisper-base", label: "Base (multilingual)", size: "≈ 80 MB", multilingual: true },
	{ id: "onnx-community/whisper-small", label: "Small (multilingual, slower, better)", size: "≈ 250 MB", multilingual: true },
];

export interface LocalCue {
	startMs: number;
	endMs: number;
	text: string;
}

export type LocalProgress =
	| { phase: "decoding" }
	| { phase: "loading"; fraction: number | null }
	| { phase: "transcribing" };

const TARGET_RATE = 16000;
/** Longer audio would need more memory than most browsers allow for one tab. */
export const MAX_LOCAL_SECONDS = 2 * 60 * 60;

export const webGpuAvailable = (): boolean =>
	typeof navigator !== "undefined" && "gpu" in navigator;

/** Decode any audio or video file the browser understands to 16 kHz mono samples. */
export const decodeToMono16k = async (data: ArrayBuffer): Promise<Float32Array> => {
	const context = new AudioContext({ sampleRate: TARGET_RATE });
	try {
		const buffer = await context.decodeAudioData(data);
		if (buffer.duration > MAX_LOCAL_SECONDS) {
			throw new Error("This file is longer than 2 hours, which is too much for the browser to transcribe at once.");
		}
		const mono = new Float32Array(buffer.length);
		for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
			const samples = buffer.getChannelData(channel);
			for (let i = 0; i < samples.length; i++) {
				mono[i] = (mono[i] ?? 0) + (samples[i] ?? 0) / buffer.numberOfChannels;
			}
		}
		return mono;
	} finally {
		void context.close();
	}
};

export interface LocalTranscription {
	cues: LocalCue[];
	/** Call to stop early. */
	cancel: () => void;
}

export const transcribeLocally = (
	data: ArrayBuffer,
	options: { model: string; language?: string; device: "wasm" | "webgpu"; onProgress: (p: LocalProgress) => void },
): { promise: Promise<LocalCue[]>; cancel: () => void } => {
	let worker: Worker | null = null;
	let rejectRun: ((error: Error) => void) | null = null;
	const promise = (async () => {
		options.onProgress({ phase: "decoding" });
		const audio = await decodeToMono16k(data);
		const durationMs = (audio.length / TARGET_RATE) * 1000;
		return await new Promise<LocalCue[]>((resolve, reject) => {
			rejectRun = reject;
			worker = new Worker(new URL("./whisper.worker.ts", import.meta.url), { type: "module" });
			worker.onmessage = (event: MessageEvent<WhisperMessage>) => {
				const message = event.data;
				if (message.type === "download") {
					options.onProgress({ phase: "loading", fraction: message.fraction });
				} else if (message.type === "status") {
					options.onProgress(message.status === "loading" ? { phase: "loading", fraction: null } : { phase: "transcribing" });
				} else if (message.type === "error") {
					worker?.terminate();
					reject(new Error(message.message));
				} else {
					worker?.terminate();
					const cues = message.chunks
						.filter((chunk) => chunk.text.length > 0)
						.map((chunk, index, all) => {
							const startMs = Math.max(0, Math.round(chunk.start * 1000));
							const fallbackEnd = all[index + 1] ? all[index + 1]?.start ?? chunk.start : durationMs / 1000;
							const endMs = Math.round((chunk.end ?? fallbackEnd) * 1000);
							return { startMs, endMs: Math.max(endMs, startMs + 1), text: chunk.text };
						});
					resolve(cues);
				}
			};
			worker.onerror = (event) => {
				worker?.terminate();
				reject(new Error(event.message || "The transcription worker crashed."));
			};
			const request: WhisperRequest = { audio, model: options.model, language: options.language, device: options.device };
			worker.postMessage(request, [audio.buffer]);
		});
	})();
	return {
		promise,
		cancel: () => {
			worker?.terminate();
			rejectRun?.(new Error("Cancelled."));
		},
	};
};
