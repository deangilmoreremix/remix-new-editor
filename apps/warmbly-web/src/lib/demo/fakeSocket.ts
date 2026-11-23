// A WebSocket that speaks just enough Phoenix (vsn 1.0.0) for the dashboard to show "Live".
type Frame = { topic: string; event: string; payload: unknown; ref: string | null };

export class DemoSocket extends EventTarget {
    static readonly CONNECTING = 0; static readonly OPEN = 1; static readonly CLOSING = 2; static readonly CLOSED = 3;
    readonly CONNECTING = 0; readonly OPEN = 1; readonly CLOSING = 2; readonly CLOSED = 3;
    readyState = 0; url: string; protocol = ""; extensions = ""; bufferedAmount = 0; binaryType: BinaryType = "blob";
    onopen: ((e: Event) => void) | null = null; onmessage: ((e: MessageEvent) => void) | null = null; onclose: ((e: CloseEvent) => void) | null = null; onerror: ((e: Event) => void) | null = null;
    constructor(url: string | URL) {
        super(); this.url = String(url);
        setTimeout(() => { this.readyState = 1; const e = new Event("open"); this.onopen?.(e); this.dispatchEvent(e); }, 30);
    }
    private emit(frame: Frame) {
        if (this.readyState !== 1) return;
        const e = new MessageEvent("message", { data: JSON.stringify(frame) });
        setTimeout(() => { this.onmessage?.(e); this.dispatchEvent(e); }, 5);
    }
    send(data: string) {
        let f: Frame; try { f = JSON.parse(data) as Frame; } catch { return; }
        if (f.event === "heartbeat" || f.event === "phx_join" || f.event === "phx_leave") this.emit({ topic: f.topic, event: "phx_reply", payload: { status: "ok", response: {} }, ref: f.ref });
    }
    close() {
        this.readyState = 3; const e = new CloseEvent("close", { code: 1000, wasClean: true });
        this.onclose?.(e); this.dispatchEvent(e);
    }
}
