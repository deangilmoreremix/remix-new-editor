/**
 * Browser-side media tools built on Mediabunny (MPL-2.0) and the WebCodecs API.
 * Everything runs in the page: files are never uploaded.
 *
 * Which codecs can be written depends on the browser (for example Chromium builds
 * without AAC can still write H.264/VP9 video and Opus audio), so every run reports
 * tracks it could not convert instead of failing silently.
 */
import {
	ALL_FORMATS,
	BlobSource,
	BufferTarget,
	Conversion,
	ConversionCanceledError,
	canEncodeAudio,
	canEncodeVideo,
	Input,
	type OutputFormat,
	Mp4OutputFormat,
	OggOutputFormat,
	Output,
	QUALITY_HIGH,
	QUALITY_LOW,
	QUALITY_MEDIUM,
	WavOutputFormat,
	WebMOutputFormat,
} from "mediabunny";

export type OutputKind = "mp4" | "webm" | "wav" | "ogg";
export type QualityName = "low" | "medium" | "high";

export interface MediaInfo {
	duration: number;
	hasVideo: boolean;
	hasAudio: boolean;
	width: number | null;
	height: number | null;
	videoCodec: string | null;
	audioCodec: string | null;
}

export interface CropBox {
	left: number;
	top: number;
	width: number;
	height: number;
}

export interface ConvertRequest {
	file: File;
	output: OutputKind;
	/** Seconds from the start of the file. */
	trim?: { start?: number; end?: number };
	audioOnly?: boolean;
	video?: {
		width?: number;
		height?: number;
		crop?: CropBox;
		rotate?: 0 | 90 | 180 | 270;
		flip?: boolean;
		quality?: QualityName;
	};
	onProgress?: (fraction: number) => void;
	/** Set to cancel the run. */
	signal?: AbortSignal;
}

export interface ConvertResult {
	blob: Blob;
	filename: string;
	/** Things the user should know, e.g. a track that could not be converted. */
	notes: string[];
}

export const OUTPUT_LABELS: Record<OutputKind, string> = {
	mp4: "MP4 (H.264 / AAC)",
	webm: "WebM (VP9 / Opus)",
	wav: "WAV (audio)",
	ogg: "OGG (Opus audio)",
};

const formatFor = (kind: OutputKind): OutputFormat => {
	switch (kind) {
		case "mp4":
			return new Mp4OutputFormat();
		case "webm":
			return new WebMOutputFormat();
		case "wav":
			return new WavOutputFormat();
		case "ogg":
			return new OggOutputFormat();
	}
};

const isAudioKind = (kind: OutputKind): boolean => kind === "wav" || kind === "ogg";

const QUALITIES = { low: QUALITY_LOW, medium: QUALITY_MEDIUM, high: QUALITY_HIGH } as const;

/** True when this browser exposes the APIs the tools need. */
export const mediaToolsSupported = (): boolean =>
	typeof VideoEncoder !== "undefined" && typeof AudioEncoder !== "undefined";

/** Which outputs this browser can write, with a reason when it cannot. */
export const outputSupport = async (): Promise<
	Record<OutputKind, { ok: boolean; note?: string }>
> => {
	const result = {} as Record<OutputKind, { ok: boolean; note?: string }>;
	for (const kind of ["mp4", "webm", "wav", "ogg"] as OutputKind[]) {
		const format = formatFor(kind);
		const videoCodecs = format.getSupportedVideoCodecs();
		const audioCodecs = format.getSupportedAudioCodecs();
		let video = false;
		for (const codec of videoCodecs) {
			if (await canEncodeVideo(codec)) {
				video = true;
				break;
			}
		}
		let audio = false;
		for (const codec of audioCodecs) {
			if (await canEncodeAudio(codec)) {
				audio = true;
				break;
			}
		}
		if (isAudioKind(kind)) {
			result[kind] = audio
				? { ok: true }
				: { ok: false, note: "This browser cannot encode audio for this format." };
		} else if (video) {
			result[kind] = audio
				? { ok: true }
				: {
						ok: true,
						note: "This browser cannot encode this format's audio codec; audio is kept only if it can be copied unchanged.",
					};
		} else {
			result[kind] = { ok: false, note: "This browser cannot encode video for this format." };
		}
	}
	return result;
};

const openInput = (file: File): Input =>
	new Input({ source: new BlobSource(file), formats: ALL_FORMATS });

export const probeFile = async (file: File): Promise<MediaInfo> => {
	const input = openInput(file);
	try {
		const [video, audio, duration] = await Promise.all([
			input.getPrimaryVideoTrack(),
			input.getPrimaryAudioTrack(),
			input.computeDuration(),
		]);
		return {
			duration,
			hasVideo: Boolean(video),
			hasAudio: Boolean(audio),
			width: video?.displayWidth ?? null,
			height: video?.displayHeight ?? null,
			videoCodec: video?.codec ?? null,
			audioCodec: audio?.codec ?? null,
		};
	} finally {
		input.dispose();
	}
};

const REASONS: Record<string, string> = {
	unknown_source_codec: "its codec is not recognised",
	undecodable_source_codec: "this browser cannot decode it",
	no_encodable_target_codec: "this browser cannot encode it into the chosen format",
	cannot_copy: "it cannot be copied and re-encoding was not possible",
	max_track_count_reached: "the format allows no more tracks",
	max_track_count_of_type_reached: "the format allows no more tracks of that kind",
};

const outputName = (file: File, suffix: string, extension: string): string => {
	const dot = file.name.lastIndexOf(".");
	const stem = dot > 0 ? file.name.slice(0, dot) : file.name;
	return `${stem}${suffix}.${extension}`;
};

export const runConversion = async (request: ConvertRequest): Promise<ConvertResult> => {
	const input = openInput(request.file);
	const output = new Output({ format: formatFor(request.output), target: new BufferTarget() });
	const discardVideo = request.audioOnly || isAudioKind(request.output);
	const quality = QUALITIES[request.video?.quality ?? "medium"];
	let conversion: Conversion;
	try {
		conversion = await Conversion.init({
			input,
			output,
			trim: request.trim,
			video: discardVideo
				? { discard: true }
				: {
						width: request.video?.width,
						height: request.video?.height,
						crop: request.video?.crop,
						rotate: request.video?.rotate,
						flip: request.video?.flip,
						quality,
					},
		});
	} catch (error) {
		input.dispose();
		throw error;
	}

	const notes: string[] = [];
	for (const item of conversion.discardedTracks) {
		if (item.reason === "discarded_by_user") {
			continue;
		}
		notes.push(
			`A ${item.track.type} track was left out because ${REASONS[item.reason] ?? item.reason}.`,
		);
	}
	if (!conversion.isValid) {
		input.dispose();
		throw new Error(
			notes.length
				? `Nothing could be converted. ${notes.join(" ")}`
				: "Nothing could be converted for this file and format.",
		);
	}

	conversion.onProgress = (fraction) => request.onProgress?.(fraction);
	const onAbort = () => void conversion.cancel();
	request.signal?.addEventListener("abort", onAbort);
	try {
		await conversion.execute();
	} catch (error) {
		if (error instanceof ConversionCanceledError) {
			throw new Error("Cancelled.");
		}
		throw error;
	} finally {
		request.signal?.removeEventListener("abort", onAbort);
		input.dispose();
	}

	const buffer = (output.target as BufferTarget).buffer;
	if (!buffer) {
		throw new Error("The conversion produced no data.");
	}
	const blob = new Blob([buffer], { type: output.format.mimeType });
	const suffix = request.trim ? "-trimmed" : request.output === request.file.name.split(".").pop() ? "-converted" : "";
	return { blob, filename: outputName(request.file, suffix, output.format.fileExtension.replace(/^\./, "")), notes };
};
