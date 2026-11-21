import { useEffect, useRef, useState } from "react";
import { apiUrl } from "./orpc-client";

interface LiveHandlers {
	/** Full state of the run or chat (sent first, and again on every state change). */
	onState: (state: unknown) => void;
	/** A chunk of streamed text. */
	onDelta: (delta: string) => void;
}

/**
 * Subscribe to `GET /stream` (server-sent events) while `enabled`.
 * Returns whether the stream is connected, so callers can fall back to polling.
 */
export const useLiveStream = (
	enabled: boolean,
	params: Record<string, string>,
	handlers: LiveHandlers,
): boolean => {
	const [connected, setConnected] = useState(false);
	const handlersRef = useRef(handlers);
	handlersRef.current = handlers;
	const query = new URLSearchParams(params).toString();

	useEffect(() => {
		if (!enabled || typeof EventSource === "undefined") {
			setConnected(false);
			return;
		}
		const source = new EventSource(`${apiUrl}/stream?${query}`);
		const parse = (event: MessageEvent): unknown => {
			try {
				return JSON.parse(event.data);
			} catch {
				return null;
			}
		};
		const onState = (event: Event) => {
			setConnected(true);
			handlersRef.current.onState(parse(event as MessageEvent));
		};
		source.addEventListener("snapshot", onState);
		source.addEventListener("state", onState);
		source.addEventListener("delta", (event) => {
			const payload = parse(event as MessageEvent) as { delta?: string } | null;
			if (payload?.delta) {
				handlersRef.current.onDelta(payload.delta);
			}
		});
		source.onerror = () => setConnected(false);
		return () => {
			source.close();
			setConnected(false);
		};
	}, [enabled, query]);

	return connected;
};
