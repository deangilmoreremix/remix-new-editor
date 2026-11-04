import ReactDOM from "react-dom/client";
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import "../styles/global.css";
import { App } from "./App";
import { initHostBridge } from "./host/bridge";

// Load Monaco from the bundle instead of the default CDN.
loader.config({ monaco });
initHostBridge();

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
