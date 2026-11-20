/// <reference types="vite/client" />
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "@collab/core";

// Teamchat and Meetings are upstream's own apps (vendor/everything), built into public/ by
// `npm run build:vendored` and embedded as-is.
const Embed = ({ src, title }: { src: string; title: string }) => (
  <iframe title={title} src={import.meta.env.BASE_URL + src} style={{ border: 0, width: "100%", height: "100%" }}
    allow="camera; microphone; display-capture; fullscreen; clipboard-write; autoplay; notifications" />
);

const apps = {
  teamchat: { label: "Teamchat", C: () => <Embed title="Teamchat" src="teamchat/index.html" /> },
  meetings: { label: "Meetings", C: () => <Embed title="Meetings" src="meetings/index.html" /> },
};
type Id = keyof typeof apps;
const read = (): Id => { const h = location.hash.slice(2) as Id; return h in apps ? h : "teamchat"; };

function Shell() {
  const [id, setId] = useState<Id>(read);
  useEffect(() => { const f = () => setId(read()); window.addEventListener("hashchange", f); return () => window.removeEventListener("hashchange", f); }, []);
  const { C } = apps[id];
  return (
    <div className="app" style={{ height: "100%" }}>
      <nav className="side">
        <h3 style={{ margin: "4px 8px 10px" }}>Collab Suite</h3>
        {(Object.keys(apps) as Id[]).map((k) => <div key={k} className={"item" + (k === id ? " on" : "")} onClick={() => (location.hash = "/" + k)}>{apps[k].label}</div>)}
      </nav>
      <div className="main" style={{ overflow: "auto" }}><C /></div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<Shell />);
