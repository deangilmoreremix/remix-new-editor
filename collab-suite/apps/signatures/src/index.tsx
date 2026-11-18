import { useEffect, useRef, useState } from "react";
import { useStore } from "@collab/core";

export default function Signatures() {
  const cv = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [saved, setSaved] = useStore<string | null>("collab.signature", null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { const c = cv.current!, x = c.getContext("2d")!; x.lineWidth = 2.5; x.lineCap = "round"; x.strokeStyle = "#111"; }, []);
  const pos = (e: React.PointerEvent) => { const r = cv.current!.getBoundingClientRect(); return [(e.clientX - r.left) * (cv.current!.width / r.width), (e.clientY - r.top) * (cv.current!.height / r.height)]; };
  const down = (e: React.PointerEvent) => { drawing.current = true; const [x, y] = pos(e); const g = cv.current!.getContext("2d")!; g.beginPath(); g.moveTo(x, y); cv.current!.setPointerCapture(e.pointerId); };
  const move = (e: React.PointerEvent) => { if (!drawing.current) return; const [x, y] = pos(e); const g = cv.current!.getContext("2d")!; g.lineTo(x, y); g.stroke(); setDirty(true); };
  const clear = () => { const c = cv.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setDirty(false); };
  return (
    <div className="main" style={{ padding: 12, gap: 8 }}>
      <p className="muted" style={{ margin: 0 }}>Draw your signature. Stored in this browser only; PDF placement is not built yet.</p>
      <canvas ref={cv} width={600} height={200} style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 8, width: "100%", maxWidth: 600, touchAction: "none" }}
        onPointerDown={down} onPointerMove={move} onPointerUp={() => (drawing.current = false)} />
      <div className="row" style={{ padding: 0 }}>
        <button onClick={clear}>Clear</button>
        <button className="primary" disabled={!dirty} onClick={() => setSaved(cv.current!.toDataURL("image/png"))}>Save signature</button>
        {saved && <a href={saved} download="signature.png"><button>Download PNG</button></a>}
      </div>
      {saved && <img src={saved} alt="Saved signature" style={{ maxWidth: 300, background: "#fff", borderRadius: 8, border: "1px solid var(--line)" }} />}
    </div>
  );
}
