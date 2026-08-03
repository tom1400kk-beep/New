import type { WorldState } from "./types";

const DB_NAME = "coach-sim";
const DB_VERSION = 1;
const STORE = "saves";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "save.id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface SaveSummary {
  id: string;
  name: string;
  currentSeasonYear: number;
  currentPhase: string;
  updatedAt: Date;
}

export async function listSaves(): Promise<SaveSummary[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const rows = (req.result as WorldState[]).map((s) => ({
        id: s.save.id, name: s.save.name, currentSeasonYear: s.save.currentSeasonYear,
        currentPhase: s.save.currentPhase, updatedAt: s.save.updatedAt,
      }));
      rows.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function loadSave(id: string): Promise<WorldState | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result as WorldState | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function persistSave(state: WorldState): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(state);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteSave(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
