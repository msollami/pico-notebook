import { create } from "zustand";
import {
  Cell,
  CellId,
  Notebook,
  NotebookId,
  newCell,
  newNotebook,
} from "../types/notebook";
import * as kernel from "../tauri/kernel";

interface NotebookState {
  notebooks: Record<NotebookId, Notebook>;
  activeId: NotebookId | null;

  // Notebook lifecycle
  createNotebook: () => NotebookId;
  closeNotebook: (id: NotebookId) => void;
  setActive: (id: NotebookId) => void;
  renameNotebook: (id: NotebookId, title: string) => void;

  // Cell operations
  appendCell: (nb: NotebookId) => CellId;
  insertCellAfter: (nb: NotebookId, afterId: CellId) => CellId;
  deleteCell: (nb: NotebookId, cellId: CellId) => void;
  updateSource: (nb: NotebookId, cellId: CellId, src: string) => void;

  // Execution
  runCell: (nb: NotebookId, cellId: CellId) => Promise<void>;
  runAll: (nb: NotebookId) => Promise<void>;
  resetKernel: (nb: NotebookId) => Promise<void>;
}

const patchCell = (
  notebooks: Record<NotebookId, Notebook>,
  nb: NotebookId,
  cellId: CellId,
  patch: Partial<Cell>
): Record<NotebookId, Notebook> => {
  const book = notebooks[nb];
  if (!book) return notebooks;
  return {
    ...notebooks,
    [nb]: {
      ...book,
      cells: book.cells.map((c) => (c.id === cellId ? { ...c, ...patch } : c)),
    },
  };
};

export const useNotebookStore = create<NotebookState>((set, get) => ({
  notebooks: {},
  activeId: null,

  createNotebook: () => {
    const n = newNotebook();
    set((s) => ({
      notebooks: { ...s.notebooks, [n.id]: n },
      activeId: n.id,
    }));
    return n.id;
  },

  closeNotebook: (id) => {
    kernel.resetKernel(id).catch(() => {});
    set((s) => {
      const { [id]: _removed, ...rest } = s.notebooks;
      const remaining = Object.keys(rest);
      return {
        notebooks: rest,
        activeId: s.activeId === id ? (remaining[0] ?? null) : s.activeId,
      };
    });
  },

  setActive: (id) => set({ activeId: id }),

  renameNotebook: (id, title) =>
    set((s) => ({
      notebooks: {
        ...s.notebooks,
        [id]: { ...s.notebooks[id], title, dirty: true },
      },
    })),

  appendCell: (nb) => {
    const c = newCell();
    set((s) => ({
      notebooks: {
        ...s.notebooks,
        [nb]: {
          ...s.notebooks[nb],
          cells: [...s.notebooks[nb].cells, c],
          dirty: true,
        },
      },
    }));
    return c.id;
  },

  insertCellAfter: (nb, afterId) => {
    const c = newCell();
    set((s) => {
      const cells = [...s.notebooks[nb].cells];
      const idx = cells.findIndex((x) => x.id === afterId);
      cells.splice(idx + 1, 0, c);
      return {
        notebooks: {
          ...s.notebooks,
          [nb]: { ...s.notebooks[nb], cells, dirty: true },
        },
      };
    });
    return c.id;
  },

  deleteCell: (nb, cellId) =>
    set((s) => ({
      notebooks: {
        ...s.notebooks,
        [nb]: {
          ...s.notebooks[nb],
          cells: s.notebooks[nb].cells.filter((c) => c.id !== cellId),
          dirty: true,
        },
      },
    })),

  updateSource: (nb, cellId, src) =>
    set((s) => ({
      notebooks: patchCell(s.notebooks, nb, cellId, { source: src }),
    })),

  runCell: async (nb, cellId) => {
    const book = get().notebooks[nb];
    const cell = book?.cells.find((c) => c.id === cellId);
    if (!cell || cell.source.trim() === "") return;

    // Mark running
    set((s) => ({
      notebooks: patchCell(s.notebooks, nb, cellId, {
        status: "running",
        output: "",
        isError: false,
        isNull: false,
      }),
    }));

    try {
      const r = await kernel.evaluate(nb, cell.source);
      set((s) => ({
        notebooks: patchCell(s.notebooks, nb, cellId, {
          status: r.is_error ? "error" : "done",
          output: r.output,
          isNull: r.is_null,
          isError: r.is_error,
          lineNumber: r.line_number || null,
          elapsedMs: r.elapsed_ms,
        }),
      }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      set((s) => ({
        notebooks: patchCell(s.notebooks, nb, cellId, {
          status: "error",
          output: msg,
          isError: true,
        }),
      }));
    }
  },

  runAll: async (nb) => {
    const cells = get().notebooks[nb]?.cells ?? [];
    for (const cell of cells) {
      await get().runCell(nb, cell.id);
      const after = get().notebooks[nb]?.cells.find((c) => c.id === cell.id);
      if (after?.isError) break; // halt on first error
    }
  },

  resetKernel: async (nb) => {
    await kernel.resetKernel(nb);
    set((s) => {
      const book = s.notebooks[nb];
      if (!book) return s;
      return {
        notebooks: {
          ...s.notebooks,
          [nb]: {
            ...book,
            cells: book.cells.map((c) => ({
              ...c,
              status: "idle" as const,
              output: "",
              isError: false,
              isNull: false,
              lineNumber: null,
              elapsedMs: null,
            })),
          },
        },
      };
    });
  },
}));
