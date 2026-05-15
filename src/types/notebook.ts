import { nanoid } from "nanoid";

export type CellId = string;
export type NotebookId = string;

export type CellStatus = "idle" | "queued" | "running" | "done" | "error";

export interface Cell {
  id: CellId;
  source: string;
  output: string;
  lineNumber: number | null;
  status: CellStatus;
  isNull: boolean; // true = dim the output (assignment returned Null)
  isError: boolean;
  elapsedMs: number | null;
  createdAt: number;
}

export interface Notebook {
  id: NotebookId;
  title: string;
  cells: Cell[];
  filePath: string | null;
  dirty: boolean;
}

export const newCell = (source = ""): Cell => ({
  id: nanoid(),
  source,
  output: "",
  lineNumber: null,
  status: "idle",
  isNull: false,
  isError: false,
  elapsedMs: null,
  createdAt: Date.now(),
});

export const newNotebook = (title = "Untitled"): Notebook => ({
  id: nanoid(),
  title,
  cells: [newCell()],
  filePath: null,
  dirty: false,
});
