import type {
	TranscriptRecord,
	WebTranslation,
} from "@vidbee/transcription/web-contract";
import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { apiUrl, translateClient } from "../../lib/orpc-client";

const AUDIO_EXTENSIONS = new Set([".mp3", ".m4a", ".aac", ".wav", ".ogg", ".opus", ".flac"]);
/** Larger files are not decoded for the waveform (it needs the whole file in memory). */
const MAX_WAVEFORM_BYTES = 60 * 1024 * 1024;
const WAVEFORM_BUCKETS = 600;

export interface MediaPlayerHandle {
	seek: (seconds: number, play?: boolean) => void;
}

const vttStamp = (ms: number): string => {
	const t = Math.max(0, Math.round(ms));
	const p = (n: number, w = 2) => String(Math.floor(n)).padStart(w, "0");
	return `${p(t / 3_600_000)}:${p((t / 60_000) % 60)}:${p((t / 1000) % 60)}.${p(t % 1000, 3)}`;
};

/** WebVTT for the current transcript, with speaker voice tags. */
export const buildVtt = (record: TranscriptRecord): string => {
	const names = new Map(record.speakers.map((s) => [s.id, s.displayName]));
	const cues = [...record.segments]
		.sort((a, b) => a.sortIndex - b.sortIndex)
		.map((segment) => {
			const who = segment.speakerId ? names.get(segment.speakerId) : undefined;
			const text = segment.text.replace(/-->/g, "→").replace(/[<&]/g, " ");
			return `${vttStamp(segment.startMs)} --> ${vttStamp(Math.max(segment.endMs, segment.startMs + 1))}\n${who ? `<v ${who.replace(/[<>&]/g, "")}>` : ""}${text}`;
		});
	return `WEBVTT\n\n${cues.join("\n\n")}\n`;
};

const blobUrl = (text: string): string =>
	URL.createObjectURL(new Blob([text], { type: "text/vtt" }));

interface TrackSource {
	key: string;
	label: string;
	lang: string;
	url: string;
}

const langTag = (name: string): string => {
	const trimmed = name.trim().toLowerCase();
	return /^[a-z]{2,3}(-[a-z0-9]+)?$/.test(trimmed) ? trimmed : "und";
};

export const MediaPlayer = forwardRef<
	MediaPlayerHandle,
	{
		downloadId: string;
		filePath: string;
		record: TranscriptRecord | null;
		onTime: (ms: number) => void;
		onPlayingChange?: (playing: boolean) => void;
	}
>(({ downloadId, filePath, record, onTime, onPlayingChange }, ref) => {
	const { t } = useTranslation();
	const mediaRef = useRef<HTMLVideoElement & HTMLAudioElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [tracks, setTracks] = useState<TrackSource[]>([]);
	const [shownKey, setShownKey] = useState("");
	const [peaks, setPeaks] = useState<number[] | null>(null);
	const [progress, setProgress] = useState(0);
	const [error, setError] = useState<string | null>(null);

	const isAudio = useMemo(() => {
		const dot = filePath.lastIndexOf(".");
		return dot >= 0 && AUDIO_EXTENSIONS.has(filePath.slice(dot).toLowerCase());
	}, [filePath]);
	const src = `${apiUrl}/files?path=${encodeURIComponent(filePath)}&inline=1`;

	useImperativeHandle(ref, () => ({
		seek: (seconds, play = true) => {
			const media = mediaRef.current;
			if (!media) {
				return;
			}
			media.currentTime = Math.max(0, seconds);
			if (play) {
				void media.play().catch(() => undefined);
			}
		},
	}));

	// Caption tracks: the transcript itself plus every finished translation.
	const recordVersion = record ? `${record.id}:${record.updatedAt}` : "";
	useEffect(() => {
		let cancelled = false;
		const created: string[] = [];
		void (async () => {
			const next: TrackSource[] = [];
			if (record) {
				const url = blobUrl(buildVtt(record));
				created.push(url);
				next.push({
					key: "transcript",
					label: t("webTranscripts.player.original", { defaultValue: "Transcript" }),
					lang: langTag(record.language ?? ""),
					url,
				});
				try {
					const list: WebTranslation[] = await translateClient.list({ downloadId });
					for (const item of list.filter((entry) => entry.status === "completed")) {
						const file = await translateClient.export({
							downloadId,
							language: item.language,
							format: "vtt",
						});
						const url = blobUrl(file.content);
						created.push(url);
						next.push({
							key: `tr:${item.language}`,
							label: item.language,
							lang: langTag(item.language),
							url,
						});
					}
				} catch {
					// Captions from the transcript still work without translations.
				}
			}
			if (cancelled) {
				for (const url of created) {
					URL.revokeObjectURL(url);
				}
				return;
			}
			setTracks(next);
			setShownKey((current) => (next.some((tr) => tr.key === current) ? current : ""));
		})();
		return () => {
			cancelled = true;
			for (const url of created) {
				URL.revokeObjectURL(url);
			}
		};
		// biome-ignore lint/correctness/useExhaustiveDependencies: rebuilt when the transcript version changes
	}, [downloadId, recordVersion, t]);

	// Show exactly one caption track (or none).
	// biome-ignore lint/correctness/useExhaustiveDependencies: tracks are rebuilt with the elements
	useEffect(() => {
		const media = mediaRef.current;
		if (!media) {
			return;
		}
		const apply = () => {
			for (let i = 0; i < media.textTracks.length; i++) {
				const track = media.textTracks[i];
				if (track) {
					track.mode = track.id === shownKey && shownKey ? "showing" : "disabled";
				}
			}
		};
		apply();
		const list = media.textTracks;
		list.addEventListener("addtrack", apply);
		return () => list.removeEventListener("addtrack", apply);
	}, [shownKey, tracks]);

	// Waveform from the audio track, via the Web Audio API.
	useEffect(() => {
		setPeaks(null);
		let cancelled = false;
		const controller = new AbortController();
		void (async () => {
			try {
				const response = await fetch(src, { signal: controller.signal });
				const total = Number(response.headers.get("content-length") ?? 0);
				if (!response.ok || (total && total > MAX_WAVEFORM_BYTES)) {
					controller.abort();
					return;
				}
				const buffer = await response.arrayBuffer();
				if (buffer.byteLength > MAX_WAVEFORM_BYTES) {
					return;
				}
				const context = new AudioContext();
				try {
					const audio = await context.decodeAudioData(buffer);
					const channel = audio.getChannelData(0);
					const size = Math.max(1, Math.floor(channel.length / WAVEFORM_BUCKETS));
					const out: number[] = [];
					for (let bucket = 0; bucket < WAVEFORM_BUCKETS; bucket++) {
						let max = 0;
						for (let i = bucket * size; i < Math.min(channel.length, (bucket + 1) * size); i++) {
							max = Math.max(max, Math.abs(channel[i] ?? 0));
						}
						out.push(max);
					}
					if (!cancelled) {
						setPeaks(out);
					}
				} finally {
					void context.close();
				}
			} catch {
				// No waveform for files the browser cannot decode; playback still works.
			}
		})();
		return () => {
			cancelled = true;
			controller.abort();
		};
	}, [src]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!(canvas && peaks)) {
			return;
		}
		const context = canvas.getContext("2d");
		if (!context) {
			return;
		}
		const { width, height } = canvas;
		context.clearRect(0, 0, width, height);
		const top = Math.max(...peaks, 0.01);
		peaks.forEach((peak, index) => {
			const x = (index / peaks.length) * width;
			const h = Math.max(1, (peak / top) * height);
			context.fillStyle = index / peaks.length <= progress ? "#d9a000" : "#9ca3af";
			context.fillRect(x, (height - h) / 2, Math.max(1, width / peaks.length - 1), h);
		});
	}, [peaks, progress]);

	const onTimeUpdate = useCallback(() => {
		const media = mediaRef.current;
		if (!media) {
			return;
		}
		onTime(media.currentTime * 1000);
		setProgress(media.duration ? media.currentTime / media.duration : 0);
	}, [onTime]);

	const Element = isAudio ? "audio" : "video";
	return (
		<div className="space-y-2 border-b p-3">
			<Element
				className={isAudio ? "w-full" : "max-h-64 w-full rounded-md bg-black"}
				controls
				crossOrigin="anonymous"
				onError={() => setError(t("webTranscripts.player.error", { defaultValue: "This file cannot be played in the browser." }))}
				onPause={() => onPlayingChange?.(false)}
				onPlay={() => onPlayingChange?.(true)}
				onTimeUpdate={onTimeUpdate}
				preload="metadata"
				ref={mediaRef as never}
				src={src}
			>
				{tracks.map((track) => (
					<track
						id={track.key}
						key={track.key}
						kind="captions"
						label={track.label}
						src={track.url}
						srcLang={track.lang}
					/>
				))}
			</Element>
			{error && <p className="text-destructive text-xs">{error}</p>}
			{peaks && (
				<canvas
					className="h-12 w-full cursor-pointer rounded bg-muted/40"
					height={48}
					onClick={(event) => {
						const media = mediaRef.current;
						if (!(media?.duration && Number.isFinite(media.duration))) {
							return;
						}
						const rect = event.currentTarget.getBoundingClientRect();
						media.currentTime = ((event.clientX - rect.left) / rect.width) * media.duration;
					}}
					ref={canvasRef}
					width={WAVEFORM_BUCKETS}
				/>
			)}
			{tracks.length > 0 && (
				<label className="flex items-center gap-2 text-xs">
					<span className="text-muted-foreground">
						{t("webTranscripts.player.captions", { defaultValue: "Captions" })}
					</span>
					<select
						className="rounded border bg-background px-2 py-1"
						onChange={(event) => setShownKey(event.target.value)}
						value={shownKey}
					>
						<option value="">{t("webTranscripts.player.off", { defaultValue: "Off" })}</option>
						{tracks.map((track) => (
							<option key={track.key} value={track.key}>
								{track.label}
							</option>
						))}
					</select>
				</label>
			)}
		</div>
	);
});
MediaPlayer.displayName = "MediaPlayer";
