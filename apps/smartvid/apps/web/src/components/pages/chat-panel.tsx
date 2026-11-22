import { Button } from "@smartvid/ui/components/ui/button";
import { Input } from "@smartvid/ui/components/ui/input";
import type { WebChat } from "@smartvid/transcription/web-contract";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { chatClient } from "../../lib/orpc-client";
import { useLiveStream } from "../../lib/use-live-stream";

const messageOf = (error: unknown): string =>
	error instanceof Error && error.message ? error.message : "Request failed";

export const ChatPanel = ({
	downloadId,
	hasTranscript,
}: {
	downloadId: string;
	hasTranscript: boolean;
}) => {
	const { t } = useTranslation();
	const [chat, setChat] = useState<WebChat | null>(null);
	const [draft, setDraft] = useState("");
	const [webSearch, setWebSearch] = useState(false);
	const endRef = useRef<HTMLDivElement>(null);

	const refresh = useCallback(async () => {
		try {
			setChat(await chatClient.get({ downloadId }));
		} catch (error) {
			toast.error(messageOf(error));
		}
	}, [downloadId]);

	useEffect(() => {
		setChat(null);
		void refresh();
	}, [refresh]);

	const running = chat?.status === "running";
	const streaming = useLiveStream(
		true,
		{ channel: "chat", downloadId },
		{
			onState: (state) => {
				if (state && typeof state === "object") {
					setChat(state as WebChat);
				}
			},
			onDelta: (delta) => {
				setChat((previous) =>
					previous ? { ...previous, partial: previous.partial + delta } : previous,
				);
			},
		},
	);
	useEffect(() => {
		if (!running || streaming) {
			return;
		}
		const timer = window.setInterval(() => void refresh(), 700);
		return () => window.clearInterval(timer);
	}, [running, streaming, refresh]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll when content changes
	useEffect(() => {
		endRef.current?.scrollIntoView({ block: "end" });
	}, [chat?.messages.length, chat?.partial]);

	const send = async () => {
		const message = draft.trim();
		if (!message) {
			return;
		}
		try {
			setChat(await chatClient.send({ downloadId, message, webSearch }));
			setDraft("");
		} catch (error) {
			toast.error(messageOf(error));
		}
	};

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 text-sm">
				{!hasTranscript && (
					<p className="text-muted-foreground">
						{t("webTranscripts.ai.needTranscript", {
							defaultValue: "Transcribe this download first.",
						})}
					</p>
				)}
				{chat?.messages.map((message, index) =>
					message.role === "tool" ? (
						<div
							className="text-muted-foreground text-xs"
							// biome-ignore lint/suspicious/noArrayIndexKey: append-only list
							key={index}
						>
							🔧 {message.text}
						</div>
					) : (
						<div
							className={message.role === "user" ? "text-right" : ""}
							// biome-ignore lint/suspicious/noArrayIndexKey: append-only list
							key={index}
						>
							<div
								className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-left ${
									message.role === "user" ? "bg-primary/10" : "bg-muted"
								}`}
							>
								{message.text}
							</div>
						</div>
					),
				)}
				{chat?.partial && (
					<div>
						<div className="inline-block max-w-[85%] whitespace-pre-wrap rounded-lg bg-muted px-3 py-2">
							{chat.partial}
						</div>
					</div>
				)}
				{running && !chat?.partial && (
					<p className="text-muted-foreground text-xs">
						{t("webTranscripts.ai.working", { defaultValue: "Waiting for the model…" })}
					</p>
				)}
				{chat?.error && <p className="text-destructive">{chat.error}</p>}
				<div ref={endRef} />
			</div>
			<label className="flex items-center gap-2 border-t px-3 pt-2 text-muted-foreground text-xs">
				<input
					checked={webSearch}
					disabled={running}
					onChange={(event) => setWebSearch(event.target.checked)}
					type="checkbox"
				/>
				{t("webTranscripts.chat.webSearch", {
					defaultValue: "Let the assistant search the web (OpenAI web search)",
				})}
			</label>
			<div className="flex gap-2 p-3 pt-2">
				<Input
					disabled={!hasTranscript}
					onChange={(event) => setDraft(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter" && !event.shiftKey && !running) {
							event.preventDefault();
							void send();
						}
					}}
					placeholder={t("webTranscripts.chat.placeholder", {
						defaultValue: "Ask about this video…",
					})}
					value={draft}
				/>
				{running ? (
					<Button
						onClick={() => void chatClient.cancel({ downloadId }).then(refresh)}
						variant="outline"
					>
						{t("webTranscripts.cancel", { defaultValue: "Cancel" })}
					</Button>
				) : (
					<Button disabled={!hasTranscript || !draft.trim()} onClick={() => void send()}>
						{t("webTranscripts.chat.send", { defaultValue: "Send" })}
					</Button>
				)}
				{chat && chat.messages.length > 0 && !running && (
					<Button
						onClick={() => void chatClient.reset({ downloadId }).then(setChat)}
						variant="ghost"
					>
						{t("webTranscripts.chat.clear", { defaultValue: "Clear" })}
					</Button>
				)}
			</div>
		</div>
	);
};
