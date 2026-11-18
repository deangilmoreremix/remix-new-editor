import { useEffect, useRef, useState } from "react";
import { uid, useStore } from "@collab/core";
type Msg = { id: string; ch: string; user: string; text: string; at: number };

// Messages sync live between browser tabs via the storage event. Swap useStore for a
// WebSocket/Supabase Realtime channel to make this work across machines.
export default function Teamchat() {
  const [msgs, setMsgs] = useStore<Msg[]>("collab.chat", []);
  const [channels, setChannels] = useStore<string[]>("collab.channels", ["general", "random"]);
  const [user, setUser] = useStore<string>("collab.chat.user", "user-" + uid().slice(0, 3));
  const [ch, setCh] = useState("general"); const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const shown = msgs.filter((m) => m.ch === ch);
  useEffect(() => { end.current?.scrollIntoView(); }, [shown.length, ch]);
  const send = () => { if (!text.trim()) return; setMsgs((l) => [...l, { id: uid(), ch, user, text, at: Date.now() }]); setText(""); };
  return (
    <div className="app">
      <div className="side">
        <input value={user} onChange={(e) => setUser(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
        {channels.map((c) => <div key={c} className={"item" + (c === ch ? " on" : "")} onClick={() => setCh(c)}># {c}</div>)}
        <button style={{ marginTop: 8 }} onClick={() => { const n = prompt("Channel name")?.trim().toLowerCase(); if (n) setChannels((l) => (l.includes(n) ? l : [...l, n])); }}>+ Channel</button>
      </div>
      <div className="main">
        <div className="grow" style={{ overflow: "auto", padding: 12 }}>
          {shown.length === 0 && <p className="muted">No messages in #{ch}. Open a second tab to chat with yourself.</p>}
          {shown.map((m) => <p key={m.id} style={{ margin: "4px 0" }}><b>{m.user}</b> <span className="muted">{new Date(m.at).toLocaleTimeString()}</span><br />{m.text}</p>)}
          <div ref={end} />
        </div>
        <div className="row"><input className="grow" placeholder={`Message #${ch}`} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} /><button className="primary" onClick={send}>Send</button></div>
      </div>
    </div>
  );
}
