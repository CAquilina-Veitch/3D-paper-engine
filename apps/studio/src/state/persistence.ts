import { type Doc, docFromJson, docToJson } from "@paper3d/model";
import { get, set } from "idb-keyval";
import { useDocStore } from "./docStore";

const AUTOSAVE_KEY = "paper3d.autosave";

export async function loadAutosave(): Promise<Doc | null> {
  try {
    const json = await get(AUTOSAVE_KEY);
    return json ? docFromJson(json) : null;
  } catch {
    return null;
  }
}

export function startAutosave(): void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  useDocStore.subscribe((state) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      set(AUTOSAVE_KEY, docToJson(state.doc)).catch(() => {});
    }, 2000);
  });
}

export function downloadDoc(doc: Doc): void {
  const blob = new Blob([JSON.stringify(docToJson(doc), null, 2)], { type: "application/json" });
  triggerDownload(blob, `${doc.name.replace(/[^\w-]+/g, "_") || "design"}.paper3d`);
}

export function downloadPdf(bytes: Uint8Array, name: string): void {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  triggerDownload(blob, `${name.replace(/[^\w-]+/g, "_") || "design"}.pdf`);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function openDocFile(file: File): Promise<Doc> {
  const text = await file.text();
  return docFromJson(JSON.parse(text));
}
