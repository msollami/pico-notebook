import { useEffect } from "react";
import { useNotebookStore } from "../store/notebook";

/** Global keyboard shortcuts. Mount once at the app root. */
export function useShortcuts(activeNotebookId: string | null) {
  const { runAll, resetKernel, createNotebook, closeNotebook, appendCell } =
    useNotebookStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!activeNotebookId) return;

      // Cmd+Shift+Enter — run all cells
      if (meta && e.shiftKey && e.key === "Enter") {
        e.preventDefault();
        runAll(activeNotebookId);
        return;
      }
      // Cmd+N — new notebook
      if (meta && e.key === "n" && !e.shiftKey) {
        e.preventDefault();
        createNotebook();
        return;
      }
      // Cmd+W — close active notebook
      if (meta && e.key === "w") {
        e.preventDefault();
        closeNotebook(activeNotebookId);
        return;
      }
      // Cmd+J — append a new cell
      if (meta && e.key === "j") {
        e.preventDefault();
        appendCell(activeNotebookId);
        return;
      }
      // Cmd+Shift+0 — reset kernel
      if (meta && e.shiftKey && e.key === "0") {
        e.preventDefault();
        resetKernel(activeNotebookId);
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    activeNotebookId,
    runAll,
    resetKernel,
    createNotebook,
    closeNotebook,
    appendCell,
  ]);
}
