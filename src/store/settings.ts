import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ExecutionMode = "immediate" | "batch";
export type Theme = "dark" | "light";

interface SettingsState {
  executionMode: ExecutionMode;
  theme: Theme;
  setExecutionMode: (m: ExecutionMode) => void;
  setTheme: (t: Theme) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      executionMode: "immediate",
      theme: "dark",
      setExecutionMode: (m) => set({ executionMode: m }),
      setTheme: (t) => set({ theme: t }),
    }),
    { name: "pico-notebook-settings" }
  )
);
