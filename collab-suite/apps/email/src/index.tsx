import { useState } from "react";
import { uid, useStore } from "@collab/core";
type Mail = { id: string; to: string; subject: string; body: string; at: number; box: "draft" | "outbox" };

// Local-only mailbox. Real send/receive needs a backend speaking SMTP/IMAP (or a provider API);
// the browser cannot open those sockets itself.
export default function Email() {
  const [mail, setMail] = useStore<Mail[]>("collab.mail", []);
  const [f, setF] = useState({ to: "", subject: "", body: "" });
  const save = (box: Mail["box"]) => { if (!f.to.trim()) return; setMail((l) => [{ id: uid(), at: Date.now(), box, ...f }, ...l]); setF({ to: "", subject: "", body: "" }); };
  return (
    <div className="main" style={{ padding: 12, gap: 8 }}>
      <input placeholder="To" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
      <input placeholder="Subject" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
      <textarea rows={5} placeholder="Message" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
      <div className="row" style={{ padding: 0 }}><button onClick={() => save("draft")}>Save draft</button><button className="primary" onClick={() => save("outbox")}>Queue (not sent)</button></div>
      {mail.map((m) => <div key={m.id} className="row" style={{ borderBottom: "1px solid var(--line)" }}><span className="muted">[{m.box}]</span><b>{m.subject || "(no subject)"}</b><span className="muted grow">to {m.to}</span>{m.box === "draft" && <button onClick={() => { setF({ to: m.to, subject: m.subject, body: m.body }); setMail((l) => l.filter((x) => x.id !== m.id)); }}>Edit</button>}<button onClick={() => setMail((l) => l.filter((x) => x.id !== m.id))}>Delete</button></div>)}
    </div>
  );
}
