// tauriShim — drop-in replacement for `@tauri-apps/api` used by the upstream
// timeline-studio features. Every upstream `invoke(...)`, `open` dialog, and
// filesystem call is mapped to a browser-native mechanism or to this repo's
// existing MCP WebSocket (see mcpClient.ts).
//
// Nothing in this shim introduces backend work; persistence uses idb-keyval and
// clip commands reuse the existing `add_clip` / `remove_clip` / `move_clip` /
// `set_playhead` MCP handlers.

import { get, set } from 'idb-keyval';
import { mcpClient } from './mcpClient';

/** Mimics `@tauri-apps/api/dialog.open` — returns picked File objects. */
export async function open(opts?: {
  multiple?: boolean;
  filters?: { name: string; extensions: string[] }[];
}): Promise<File[] | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = Boolean(opts?.multiple);
    if (opts?.filters?.length) {
      const exts = opts.filters.flatMap((f) => f.extensions);
      input.accept = exts.map((e) => (e.startsWith('.') ? e : `.${e}`)).join(',');
    }
    input.onchange = () => {
      const files = input.files ? Array.from(input.files) : [];
      resolve(files.length ? files : null);
    };
    input.click();
  });
}

/** Mimics `@tauri-apps/api/fs` snapshot persistence using IndexedDB. */
export async function saveTimelineSnapshot(key: string, state: unknown): Promise<void> {
  await set(`timeline-snapshot:${key}`, state);
}

export async function loadTimelineSnapshot<T = unknown>(key: string): Promise<T | undefined> {
  return (await get(`timeline-snapshot:${key}`)) as T | undefined;
}

/** Mimics `@tauri-apps/api/core.invoke` — routed to the existing MCP backend. */
export async function invoke(command: string, args: Record<string, unknown> = {}): Promise<unknown> {
  return mcpClient.command(command, args);
}

/** Equivalent to upstream `version-control-integration` snapshot calls. */
export const versionControl = {
  snapshot: (id: string, state: unknown) => saveTimelineSnapshot(`vc:${id}`, state),
  load: (id: string) => loadTimelineSnapshot(`vc:${id}`),
};
