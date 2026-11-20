import { Button } from "@vidbee/ui/components/ui/button";
import { Input } from "@vidbee/ui/components/ui/input";
import type { WebTranslation } from "@vidbee/transcription/web-contract";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { translateClient } from "../../lib/orpc-client";
import { useLiveStream } from "../../lib/use-live-stream";

const FORMATS = ["srt", "vtt", "txt"] as const;
const SUGGESTIONS = ["Spanish", "French", "German", "Portuguese", "Japanese", "Chinese", "Arabic"];

const messageOf = (error: unknown): string =>
	error instanceof Error && error.message ? error.message : "Request failed";

export const TranslatePanel = ({
	downloadId,
	hasTranscript,
}: {
	downloadId: string;
	hasTranscript: boolean;
}) => {
	const { t } = useTranslation();
	const [items, setItems] = useState<WebTranslation[]>([]);
	const [language, setLanguage] = useState("");

	const refresh = useCallback(async () => {
		try {
			setItems(await translateClient.list({ downloadId }));
		} catch (error) {
			toast.error(messageOf(error));
		}
	}, [downloadId]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const running = items.some((item) => item.status === "running");
	const streaming = useLiveStream(
		true,
		{ channel: "translate", downloadId },
		{
			onState: (state) => {
				if (Array.isArray(state)) {
					setItems(state as WebTranslation[]);
				}
			},
			onDelta: () => undefined,
		},
	);
	useEffect(() => {
		if (!running || streaming) {
			return;
		}
		const timer = window.setInterval(() => void refresh(), 1000);
		return () => window.clearInterval(timer);
	}, [running, streaming, refresh]);

	const start = async (target: string) => {
		try {
			await translateClient.start({ downloadId, language: target });
			setLanguage("");
			void refresh();
		} catch (error) {
			toast.error(messageOf(error));
		}
	};

	const download = async (target: string, format: (typeof FORMATS)[number]) => {
		try {
			const file = await translateClient.export({ downloadId, language: target, format });
			const url = URL.createObjectURL(new Blob([file.content], { type: file.mimeType }));
			const link = document.createElement("a");
			link.href = url;
			link.download = file.filename;
			link.click();
			URL.revokeObjectURL(url);
		} catch (error) {
			toast.error(messageOf(error));
		}
	};

	return (
		<div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3 text-sm">
			<div className="flex flex-wrap items-center gap-2">
				<Input
					className="max-w-xs"
					disabled={!hasTranscript}
					onChange={(event) => setLanguage(event.target.value)}
					placeholder={t("transcript.translate.language", {
						defaultValue: "Target language, e.g. Spanish",
					})}
					value={language}
				/>
				<Button
					disabled={!hasTranscript || !language.trim()}
					onClick={() => void start(language)}
					size="sm"
				>
					{t("transcript.translate.start", { defaultValue: "Translate" })}
				</Button>
			</div>
			<div className="flex flex-wrap gap-1">
				{SUGGESTIONS.map((name) => (
					<Button
						disabled={!hasTranscript}
						key={name}
						onClick={() => setLanguage(name)}
						size="sm"
						variant="ghost"
					>
						{name}
					</Button>
				))}
			</div>
			{!hasTranscript && (
				<p className="text-muted-foreground">
					{t("transcript.ai.needTranscript", { defaultValue: "Transcribe this download first." })}
				</p>
			)}
			<ul className="space-y-2">
				{items.map((item) => (
					<li className="flex flex-wrap items-center gap-2 rounded-md border p-2" key={item.language}>
						<span className="font-medium">{item.language}</span>
						<span className="text-muted-foreground text-xs">
							{item.status === "running"
								? `${item.done}/${item.total}`
								: item.status}
						</span>
						{item.error && <span className="text-destructive text-xs">{item.error}</span>}
						<span className="mr-auto" />
						{item.status === "running" && (
							<Button
								onClick={() =>
									void translateClient.cancel({ downloadId, language: item.language }).then(refresh)
								}
								size="sm"
								variant="outline"
							>
								{t("transcript.cancel", { defaultValue: "Cancel" })}
							</Button>
						)}
						{item.status === "completed" &&
							FORMATS.map((format) => (
								<Button
									key={format}
									onClick={() => void download(item.language, format)}
									size="sm"
									variant="outline"
								>
									{format.toUpperCase()}
								</Button>
							))}
						{(item.status === "failed" || item.status === "cancelled") && (
							<Button onClick={() => void start(item.language)} size="sm">
								{t("transcript.retry", { defaultValue: "Retry" })}
							</Button>
						)}
					</li>
				))}
			</ul>
		</div>
	);
};
