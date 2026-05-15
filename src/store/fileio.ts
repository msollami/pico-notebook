/**
 * Notebook persistence — save/load .pnb files (JSON).
 *
 * .pnb schema v1:
 * {
 *   "version": 1,
 *   "title": "My Notebook",
 *   "cells": [
 *     { "id": "...", "type": "expr", "source": "2+2", "output": "4", "lineNumber": 1 },
 *     { "id": "...", "type": "md",   "source": "# Heading" }
 *   ]
 * }
 *
 * NOTE: Outputs are stored for display on load, but kernel state is NOT restored.
 * A banner is shown on load: "Loaded from file — kernel state not restored. Re-run to evaluate."
 */

import { Notebook, Cell, newCell } from "../types/notebook";

export interface PnbCell {
  id: string;
  type: "expr" | "md";
  source: string;
  output?: string;
  lineNumber?: number;
}

export interface PnbFile {
  version: 1;
  title: string;
  cells: PnbCell[];
}

/** Serialise a notebook to the .pnb JSON format. */
export function serialise(nb: Notebook): string {
  const pnb: PnbFile = {
    version: 1,
    title: nb.title,
    cells: nb.cells.map((c) => ({
      id: c.id,
      type: "expr",
      source: c.source,
      output: c.output || undefined,
      lineNumber: c.lineNumber || undefined,
    })),
  };
  return JSON.stringify(pnb, null, 2);
}

/** Deserialise a .pnb JSON string into a partial Notebook (no id/filePath). */
export function deserialise(json: string): { title: string; cells: Cell[] } {
  const pnb = JSON.parse(json) as PnbFile;
  if (pnb.version !== 1) throw new Error(`Unsupported .pnb version: ${pnb.version}`);
  const cells: Cell[] = pnb.cells.map((pc) => ({
    ...newCell(pc.source),
    id: pc.id,
    output: pc.output ?? "",
    lineNumber: pc.lineNumber ?? null,
    // Status is idle — kernel state is not restored on load
    status: "idle" as const,
  }));
  return { title: pnb.title, cells };
}

/**
 * Save a notebook to a file path via Tauri fs plugin.
 * Requires tauri-plugin-fs in Cargo.toml (Phase 6 full implementation).
 */
export async function saveNotebook(nb: Notebook, path: string): Promise<void> {
  const content = serialise(nb);
  // TODO (Phase 6): invoke("save_notebook", { path, content })
  // Placeholder until tauri-plugin-fs is wired up.
  console.log(`[fileio] save to ${path}:`, content.slice(0, 80) + "…");
  void content;
  void path;
}

/**
 * Open a file dialog and load a notebook.
 * Requires tauri-plugin-dialog (Phase 6 full implementation).
 */
export async function openNotebook(): Promise<{ title: string; cells: Cell[] } | null> {
  // TODO (Phase 6): show file dialog, read file, return deserialised notebook
  // Placeholder until tauri-plugin-dialog is wired up.
  console.log("[fileio] openNotebook() — not yet implemented");
  return null;
}
