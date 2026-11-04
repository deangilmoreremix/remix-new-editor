import React, { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import { CARDS, CARD_LIST } from "../cards/registry";
import { applyOps, compactCatalog, compactProject, type EditOp } from "../ai/ops";
import { useHost } from "../host/bridge";

/** SmartVid: AI chat editing. The model returns edit operations (see
 *  netlify/functions/workbench-chat.js); they're validated by applyOps and applied
 *  as ONE undo step, so ⌘Z reverts a whole AI edit. */
const ENDPOINT = "/.netlify/functions/workbench-chat";

interface Msg {
  role: "user" | "assistant";
  content: string;
  note?: string;
}

const SUGGESTIONS = [
  "Trim the first clip to 3 seconds",
  "Add a title card at the start that says “Hello”",
  "Slow the second clip down to half speed",
  "Fade the music to 40% volume",
];

export const ChatPanel: React.FC = () => {
  const token = useHost((s) => s.token);
  const embedded = useHost((s) => s.embedded);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const catalog = useRef(compactCatalog(CARD_LIST));

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [msgs, busy]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    const history = msgs.map(({ role, content }) => ({ role, content }));
    setMsgs((m) => [...m, { role: "user", content: message }]);
    setInput("");
    setBusy(true);
    try {
      const project = useStore.getState().project;
      const r = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ message, history, project: compactProject(project), cards: catalog.current }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error || (r.status === 401 ? "Please sign in to SmartVid to use AI editing." : `Request failed (${r.status})`));
      const ops: EditOp[] = Array.isArray(j.ops) ? j.ops : [];
      let note: string | undefined;
      if (ops.length) {
        // Re-read: the user may have edited while the request was in flight.
        const current = useStore.getState().project;
        const res = applyOps(current, ops, CARDS);
        if (res.applied > 0) useStore.getState().setProject(res.project);
        note =
          `${res.applied} change${res.applied === 1 ? "" : "s"} applied` +
          (res.errors.length ? ` · ${res.errors.length} skipped (${res.errors.slice(0, 2).join("; ")})` : "") +
          (res.applied ? " · ⌘Z to undo" : "");
      }
      setMsgs((m) => [...m, { role: "assistant", content: j.reply || (ops.length ? "Done." : "No changes."), note }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: e instanceof Error ? e.message : String(e), note: "error" }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-list" ref={listRef}>
        {msgs.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-title">Edit with AI</div>
            <div className="dim">Describe a change and it's applied to the timeline. Every AI edit can be undone.</div>
            {!embedded && !token && <div className="dim chat-warn">Open the Workbench from SmartVid to use AI editing.</div>}
            <div className="chat-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="btn chat-suggestion" onClick={() => send(s)} disabled={busy}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}${m.note === "error" ? " error" : ""}`}>
            <div className="chat-bubble">{m.content}</div>
            {m.note && m.note !== "error" && <div className="chat-note dim">{m.note}</div>}
          </div>
        ))}
        {busy && <div className="chat-msg assistant"><div className="chat-bubble dim">Editing…</div></div>}
      </div>
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          value={input}
          rows={2}
          placeholder="e.g. Cut the intro to 2s and add a caption “Summer sale”"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          disabled={busy}
          aria-label="Describe an edit"
        />
        <button className="btn primary" type="submit" disabled={busy || !input.trim()}>Send</button>
      </form>
    </div>
  );
};
