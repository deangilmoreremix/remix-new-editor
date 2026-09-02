// Thin client for the EXISTING backend MCP WebSocket at ws://localhost:3001/mcp.
// Reuses the protocol already implemented in backend/server.js (get_timeline_state,
// execute_command: add_clip / remove_clip / move_clip / set_playhead). No new backend
// feature is introduced — this is the adapter the ported timeline talks to.

export interface BackendTimelineState {
  duration: number;
  playhead: number;
  tracks: unknown[];
}

export interface McpMessage {
  type: string;
  id?: string;
  data?: unknown;
  [key: string]: unknown;
}

type Listener = (msg: McpMessage) => void;

class McpClient {
  private ws: WebSocket | null = null;
  private url: string;
  private listeners = new Set<Listener>();
  private pending = new Map<string, (res: unknown) => void>();

  constructor(url: string = 'ws://localhost:3001/mcp') {
    this.url = url;
  }

  connect(): Promise<void> {
    if (this.ws && this.ws.readyState <= 1) return Promise.resolve();
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
        this.ws.onopen = () => resolve();
        this.ws.onerror = (e) => reject(e);
        this.ws.onmessage = (ev) => {
          let msg: McpMessage = { type: 'unknown' };
          try {
            msg = JSON.parse(ev.data as string);
          } catch {
            return;
          }
          this.listeners.forEach((l) => l(msg));
          if (msg.id && this.pending.has(msg.id)) {
            this.pending.get(msg.id)!(msg);
            this.pending.delete(msg.id);
          }
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  onMessage(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  send(msg: McpMessage): void {
    if (!this.ws) return;
    this.ws.send(JSON.stringify(msg));
  }

  async command(action: string, data: Record<string, unknown>): Promise<unknown> {
    await this.connect();
    const id = `cmd_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.send({ type: 'execute_command', id, data: { action, ...data } });
    });
  }

  async getTimelineState(): Promise<BackendTimelineState> {
    await this.connect();
    const id = `gts_${Date.now()}`;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.send({ type: 'get_timeline_state', id });
    }) as Promise<BackendTimelineState>;
  }
}

export const mcpClient = new McpClient();
