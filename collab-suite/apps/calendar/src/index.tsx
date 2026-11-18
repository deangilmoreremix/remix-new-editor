import { useState } from "react";
import { uid, useStore } from "@collab/core";
type Ev = { id: string; date: string; time: string; title: string };
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function Calendar() {
  const [events, setEvents] = useStore<Ev[]>("collab.events", []);
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [sel, setSel] = useState(iso(new Date()));
  const [title, setTitle] = useState(""); const [time, setTime] = useState("09:00");
  const first = month.getDay(), days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const day = events.filter((e) => e.date === sel).sort((a, b) => a.time.localeCompare(b.time));
  return (
    <div className="main" style={{ padding: 12, gap: 8 }}>
      <div className="row" style={{ padding: 0 }}>
        <button onClick={() => shift(-1)}>‹</button>
        <b className="grow" style={{ textAlign: "center" }}>{month.toLocaleString(undefined, { month: "long", year: "numeric" })}</b>
        <button onClick={() => shift(1)}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="muted" style={{ textAlign: "center" }}>{d}</div>)}
        {cells.map((n, i) => {
          if (!n) return <div key={i} />;
          const k = iso(new Date(month.getFullYear(), month.getMonth(), n));
          const has = events.some((e) => e.date === k);
          return <button key={i} className={k === sel ? "primary" : ""} onClick={() => setSel(k)}>{n}{has ? " •" : ""}</button>;
        })}
      </div>
      <div className="row" style={{ padding: 0 }}>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        <input className="grow" placeholder={`New event on ${sel}`} value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className="primary" onClick={() => { if (title.trim()) { setEvents((l) => [...l, { id: uid(), date: sel, time, title }]); setTitle(""); } }}>Add</button>
      </div>
      {day.length === 0 && <p className="muted">Nothing scheduled.</p>}
      {day.map((e) => (
        <div key={e.id} className="row"><span className="muted">{e.time}</span><span className="grow">{e.title}</span>
          <button onClick={() => setEvents((l) => l.filter((x) => x.id !== e.id))}>Delete</button></div>
      ))}
    </div>
  );
}
