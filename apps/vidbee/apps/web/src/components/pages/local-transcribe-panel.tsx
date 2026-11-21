import { Button } from "@vidbee/ui/components/ui/button";
import type { WebTranscriptStatus } from "@vidbee/transcription/web-contract";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
	LOCAL_MODELS,
	type LocalProgress,
	transcribeLocally,
	webGpuAvailable,
} from "../../lib/local-asr";
import { apiUrl, transcriptsClient } from "../../lib/orpc-client";
import { listPending, type PendingTranscript, removePending, savePending } from "../../lib/pending-store";

const LANGUAGES: Array<[string, string]> = [
	["", "Detect automatically"],
	["english", "English"],
	["spanish", "Spanish"],
	["french", "French"],
	["german", "German"],
	["portuguese", "Portuguese"],
	["italian", "Italian"],
	["japanese", "Japanese"],
	["chinese", "Chinese"],
	["arabic", "Arabic"],
];

const LANGUAGE_CODES: Record<string, string> = {
	english: "en",
	spanish: "es",
	french: "fr",
	german: "de",
	portuguese: "pt",
	italian: "it",
	japanese: "ja",
	chinese: "zh",
	arabic: "ar",
};

const messageOf = (error: unknown): string =>
	error instanceof Error && error.message ? error.message : "Something went wrong";

/**
 * Transcribe in the browser with Whisper. Either a file the user picks (creates a new
 * transcript) or the downloaded file of an existing download (adds a transcript to it).
 */
export const LocalTranscribePanel = ({
	downloadId,
	filePath,
	onImported,
}: {
	downloadId?: string;
	/** Server path of the existing download's file, when attaching to a download. */
	filePath?: string;
	onImported: (status: WebTranscriptStatus) => void;
}) => {
	const { t } = useTranslation();
	const [file, setFile] = useState<File | null>(null);
	const [modelId, setModelId] = useState(LOCAL_MODELS[0]?.id ?? "");
	const [language, setLanguage] = useState("");
	const [useGpu, setUseGpu] = useState(false);
	const [progress, setProgress] = useState<LocalProgress | null>(null);
	const [error, setError] = useState<string | null>(null);
	const cancelRef = useRef<(() => void) | null>(null);
	const [pending, setPending] = useState<PendingTranscript[]>([]);

	const refreshPending = useCallback(async () => {
		const all = await listPending();
		setPending(all.filter((item) => item.downloadId === downloadId));
	}, [downloadId]);

	useEffect(() => {
		void refreshPending();
	}, [refreshPending]);

	/** Save a finished transcript to the server; keep it in the browser if that fails. */
	const upload = async (item: PendingTranscript): Promise<void> => {
		const status = await transcriptsClient.importCues({
			downloadId: item.downloadId,
			title: item.title,
			language: item.language,
			model: item.model,
			cues: item.cues,
		});
		await removePending(item.id);
		void refreshPending();
		toast.success(
			item.cues.length > 0
				? t("webTranscripts.local.done", { defaultValue: "Transcript ready" })
				: t("webTranscripts.local.noSpeech", { defaultValue: "No speech was found" }),
		);
		onImported(status);
	};

	const model = LOCAL_MODELS.find((item) => item.id === modelId) ?? LOCAL_MODELS[0];
	const running = progress !== null;
	const canRun = !running && Boolean(downloadId ? filePath : file);

	const run = async () => {
		if (!model) {
			return;
		}
		setError(null);
		setProgress({ phase: "decoding" });
		try {
			let data: ArrayBuffer;
			let title: string | undefined;
			if (downloadId && filePath) {
				const response = await fetch(`${apiUrl}/files?path=${encodeURIComponent(filePath)}&inline=1`);
				if (!response.ok) {
					throw new Error("The downloaded file could not be read.");
				}
				data = await response.arrayBuffer();
			} else if (file) {
				data = await file.arrayBuffer();
				title = file.name;
			} else {
				return;
			}
			const job = transcribeLocally(data, {
				model: model.id,
				language: model.multilingual ? language || undefined : undefined,
				device: useGpu ? "webgpu" : "wasm",
				onProgress: setProgress,
			});
			cancelRef.current = job.cancel;
			const cues = await job.promise;
			const item: PendingTranscript = {
				id: crypto.randomUUID(),
				downloadId,
				title,
				language: model.multilingual ? (LANGUAGE_CODES[language] ?? null) : "en",
				model: model.id,
				cues,
				createdAt: Date.now(),
			};
			// Keep the result in the browser until the server has it.
			await savePending(item).catch(() => undefined);
			setProgress(null);
			try {
				await upload(item);
			} catch (cause) {
				void refreshPending();
				setError(
					`${messageOf(cause)} ${t("webTranscripts.local.kept", {
						defaultValue: "The transcript is kept in this browser; you can retry saving it.",
					})}`,
				);
			}
		} catch (cause) {
			const message = messageOf(cause);
			if (message !== "Cancelled.") {
				setError(message);
			}
		} finally {
			cancelRef.current = null;
			setProgress(null);
		}
	};

	const progressText = (): string => {
		if (!progress) {
			return "";
		}
		if (progress.phase === "decoding") {
			return t("webTranscripts.local.decoding", { defaultValue: "Reading the audio…" });
		}
		if (progress.phase === "loading") {
			return progress.fraction === null
				? t("webTranscripts.local.loadingModel", { defaultValue: "Loading the model…" })
				: `${t("webTranscripts.local.downloading", { defaultValue: "Downloading the model" })} ${Math.round(progress.fraction * 100)}%`;
		}
		return t("webTranscripts.local.transcribing", { defaultValue: "Transcribing in your browser…" });
	};

	return (
		<div className="max-w-lg space-y-3 rounded-md border p-4 text-sm" data-testid="local-asr">
			<div className="font-medium">
				{t("webTranscripts.local.title", { defaultValue: "Transcribe in your browser" })}
			</div>
			<p className="text-muted-foreground text-xs">
				{t("webTranscripts.local.privacy", {
					defaultValue:
						"Runs Whisper on this device: the audio is not uploaded. The model downloads once from the Hugging Face Hub and is then cached by your browser. No speaker names.",
				})}
			</p>
			{!downloadId && (
				<input
					accept="audio/*,video/*"
					data-testid="local-asr-file"
					disabled={running}
					onChange={(event) => setFile(event.target.files?.[0] ?? null)}
					type="file"
				/>
			)}
			<div className="flex flex-wrap items-center gap-3">
				<label className="flex items-center gap-2">
					{t("webTranscripts.local.model", { defaultValue: "Model" })}
					<select
						className="rounded border bg-background px-2 py-1"
						disabled={running}
						onChange={(event) => setModelId(event.target.value)}
						value={modelId}
					>
						{LOCAL_MODELS.map((item) => (
							<option key={item.id} value={item.id}>
								{item.label} {item.size}
							</option>
						))}
					</select>
				</label>
				{model?.multilingual && (
					<label className="flex items-center gap-2">
						{t("webTranscripts.local.language", { defaultValue: "Language" })}
						<select
							className="rounded border bg-background px-2 py-1"
							disabled={running}
							onChange={(event) => setLanguage(event.target.value)}
							value={language}
						>
							{LANGUAGES.map(([value, label]) => (
								<option key={value} value={value}>
									{label}
								</option>
							))}
						</select>
					</label>
				)}
				{webGpuAvailable() && (
					<label className="flex items-center gap-1 text-xs">
						<input
							checked={useGpu}
							disabled={running}
							onChange={(event) => setUseGpu(event.target.checked)}
							type="checkbox"
						/>
						{t("webTranscripts.local.gpu", { defaultValue: "Use the GPU (WebGPU)" })}
					</label>
				)}
			</div>
			<div className="flex items-center gap-3">
				{running ? (
					<Button onClick={() => cancelRef.current?.()} size="sm" variant="outline">
						{t("webTranscripts.cancel", { defaultValue: "Cancel" })}
					</Button>
				) : (
					<Button disabled={!canRun} onClick={() => void run()} size="sm">
						{t("webTranscripts.local.run", { defaultValue: "Transcribe" })}
					</Button>
				)}
				<span className="text-muted-foreground text-xs" data-testid="local-asr-progress">
					{progressText()}
				</span>
			</div>
			{pending.length > 0 && (
				<div className="space-y-1 border-t pt-2" data-testid="local-asr-pending">
					<div className="text-xs">
						{t("webTranscripts.local.pending", { defaultValue: "Not saved to the server yet" })}
					</div>
					{pending.map((item) => (
						<div className="flex items-center gap-2 text-xs" key={item.id}>
							<span className="mr-auto truncate">
								{item.title ?? item.downloadId} · {item.cues.length} lines
							</span>
							<Button
								onClick={() =>
									void upload(item).catch((cause) => setError(messageOf(cause)))
								}
								size="sm"
								variant="outline"
							>
								{t("webTranscripts.local.retrySave", { defaultValue: "Save" })}
							</Button>
							<Button
								onClick={() => void removePending(item.id).then(refreshPending)}
								size="sm"
								variant="ghost"
							>
								{t("webTranscripts.local.discard", { defaultValue: "Discard" })}
							</Button>
						</div>
					))}
				</div>
			)}
			{error && (
				<p className="text-destructive" data-testid="local-asr-error">
					{error}
				</p>
			)}
		</div>
	);
};
