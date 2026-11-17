import { useEffect, useRef, useState } from "react";

// Step 1 of Meetings: local camera/mic preview. Next: WebRTC peer connections plus a
// signaling channel (WebSocket or Supabase Realtime) and an optional SFU for >4 people.
export default function Meetings() {
  const v = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [err, setErr] = useState(""); const [on, setOn] = useState(false);
  const alive = useRef(true);
  // Release camera/mic when leaving the app, including a permission prompt answered after navigating away.
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; };
  }, []);
  const start = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (!alive.current) { s.getTracks().forEach((t) => t.stop()); return; }
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = s; v.current!.srcObject = s; setOn(true); setErr("");
    }
    catch (e) { setErr((e as Error).message); }
  };
  const stop = () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; if (v.current) v.current.srcObject = null; setOn(false); };
  return (
    <div className="main" style={{ padding: 12, gap: 8 }}>
      <video ref={v} autoPlay muted playsInline style={{ width: "100%", maxWidth: 640, background: "#000", borderRadius: 8 }} />
      <div className="row" style={{ padding: 0 }}>
        {on ? <button onClick={stop}>Stop</button> : <button className="primary" onClick={start}>Start camera preview</button>}
        <span className="muted">Multi-party calls need a signaling server (not built yet).</span>
      </div>
      {err && <p style={{ color: "crimson" }}>{err}</p>}
    </div>
  );
}
