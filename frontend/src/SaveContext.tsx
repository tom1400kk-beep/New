import { createContext, useContext, useState, type ReactNode } from "react";

interface SaveContextValue {
  activeSaveId: string | null;
  setActiveSaveId: (id: string | null) => void;
}

const SaveContext = createContext<SaveContextValue | null>(null);

export function SaveProvider({ children }: { children: ReactNode }) {
  const [activeSaveId, setActiveSaveIdState] = useState<string | null>(localStorage.getItem("activeSaveId"));

  function setActiveSaveId(id: string | null) {
    setActiveSaveIdState(id);
    if (id) localStorage.setItem("activeSaveId", id);
    else localStorage.removeItem("activeSaveId");
  }

  return <SaveContext.Provider value={{ activeSaveId, setActiveSaveId }}>{children}</SaveContext.Provider>;
}

export function useSave() {
  const ctx = useContext(SaveContext);
  if (!ctx) throw new Error("useSave must be used within SaveProvider");
  return ctx;
}
