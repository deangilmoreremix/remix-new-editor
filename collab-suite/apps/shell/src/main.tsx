import { Suspense, lazy, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "@collab/core";

const apps = {
  teamchat: { label: "Teamchat", C: lazy(() => import("@collab/teamchat")) },
  calendar: { label: "Calendar", C: lazy(() => import("@collab/calendar")) },
  contacts: { label: "Contacts", C: lazy(() => import("@collab/contacts")) },
  meetings: { label: "Meetings", C: lazy(() => import("@collab/meetings")) },
  email: { label: "Email", C: lazy(() => import("@collab/email")) },
  signatures: { label: "Signatures", C: lazy(() => import("@collab/signatures")) },
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
      <Suspense fallback={<p className="muted" style={{ padding: 12 }}>Loading…</p>}><div className="main" style={{ overflow: "auto" }}><C /></div></Suspense>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<Shell />);
