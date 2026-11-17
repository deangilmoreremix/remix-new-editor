import { useState } from "react";
import { uid, useStore } from "@collab/core";
type Contact = { id: string; name: string; email: string; phone: string };

export default function Contacts() {
  const [list, setList] = useStore<Contact[]>("collab.contacts", []);
  const [q, setQ] = useState("");
  const [f, setF] = useState({ name: "", email: "", phone: "" });
  const shown = list.filter((c) => (c.name + c.email + c.phone).toLowerCase().includes(q.toLowerCase()));
  const add = () => { if (!f.name.trim()) return; setList((l) => [...l, { id: uid(), ...f }]); setF({ name: "", email: "", phone: "" }); };
  return (
    <div className="main" style={{ padding: 12, gap: 8 }}>
      <input placeholder="Search contacts" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="row" style={{ padding: 0, flexWrap: "wrap" }}>
        <input placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <input placeholder="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <button className="primary" onClick={add}>Add</button>
      </div>
      {shown.length === 0 && <p className="muted">No contacts yet.</p>}
      {shown.map((c) => (
        <div key={c.id} className="row" style={{ borderBottom: "1px solid var(--line)" }}>
          <b>{c.name}</b><span className="muted grow">{c.email} {c.phone}</span>
          <button onClick={() => setList((l) => l.filter((x) => x.id !== c.id))}>Delete</button>
        </div>
      ))}
    </div>
  );
}
