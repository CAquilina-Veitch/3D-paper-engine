import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans-condensed/500.css";
import "@fontsource/ibm-plex-sans-condensed/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { redo, undo, useDocStore } from "./state/docStore";
import { startSliceSync } from "./state/engineClient";
import { startFieldSync } from "./state/fieldStore";
import { loadAutosave, startAutosave } from "./state/persistence";
import "./styles.css";

async function boot() {
  const saved = await loadAutosave();
  if (saved) useDocStore.getState().setDoc(saved);

  startFieldSync();
  startSliceSync();
  startAutosave();

  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    }
  });

  createRoot(document.getElementById("root")!).render(<App />);
}

void boot();
