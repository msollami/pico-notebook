import { describe, it, expect, vi, beforeEach } from "vitest";
import { useNotebookStore } from "./notebook";

// Mock the Tauri kernel module — tests run in jsdom, no real subprocess
vi.mock("../tauri/kernel", () => ({
  evaluate: vi.fn(async (_id: string, expr: string) => ({
    line_number: 1,
    output: expr === "2+2" ? "4" : "result",
    is_null: false,
    is_error: false,
    elapsed_ms: 3,
  })),
  resetKernel: vi.fn(async () => {}),
}));

beforeEach(() => {
  useNotebookStore.setState({ notebooks: {}, activeId: null });
  vi.clearAllMocks(); // reset mock call counts between tests
});

describe("notebook store", () => {
  it("creates a notebook with one empty cell", () => {
    const id = useNotebookStore.getState().createNotebook();
    const nb = useNotebookStore.getState().notebooks[id];
    expect(nb.cells).toHaveLength(1);
    expect(nb.cells[0].source).toBe("");
    expect(nb.cells[0].status).toBe("idle");
  });

  it("sets active notebook on create", () => {
    const id = useNotebookStore.getState().createNotebook();
    expect(useNotebookStore.getState().activeId).toBe(id);
  });

  it("runs a cell and stores output", async () => {
    const id = useNotebookStore.getState().createNotebook();
    const cellId = useNotebookStore.getState().notebooks[id].cells[0].id;
    useNotebookStore.getState().updateSource(id, cellId, "2+2");
    await useNotebookStore.getState().runCell(id, cellId);
    const cell = useNotebookStore.getState().notebooks[id].cells[0];
    expect(cell.output).toBe("4");
    expect(cell.status).toBe("done");
    expect(cell.isError).toBe(false);
  });

  it("appends a cell", () => {
    const id = useNotebookStore.getState().createNotebook();
    useNotebookStore.getState().appendCell(id);
    expect(useNotebookStore.getState().notebooks[id].cells).toHaveLength(2);
  });

  it("inserts a cell after a given cell", () => {
    const id = useNotebookStore.getState().createNotebook();
    const firstId = useNotebookStore.getState().notebooks[id].cells[0].id;
    useNotebookStore.getState().appendCell(id); // 2nd cell
    const newId = useNotebookStore.getState().insertCellAfter(id, firstId);
    const cells = useNotebookStore.getState().notebooks[id].cells;
    expect(cells).toHaveLength(3);
    expect(cells[1].id).toBe(newId); // inserted at position 1
  });

  it("deletes a cell", () => {
    const id = useNotebookStore.getState().createNotebook();
    useNotebookStore.getState().appendCell(id);
    const cellId = useNotebookStore.getState().notebooks[id].cells[0].id;
    useNotebookStore.getState().deleteCell(id, cellId);
    expect(useNotebookStore.getState().notebooks[id].cells).toHaveLength(1);
  });

  it("closes a notebook and switches active", () => {
    const id1 = useNotebookStore.getState().createNotebook();
    const id2 = useNotebookStore.getState().createNotebook();
    expect(useNotebookStore.getState().activeId).toBe(id2);
    useNotebookStore.getState().closeNotebook(id2);
    expect(useNotebookStore.getState().notebooks[id2]).toBeUndefined();
    expect(useNotebookStore.getState().activeId).toBe(id1);
  });

  it("reset kernel clears all cell outputs", async () => {
    const id = useNotebookStore.getState().createNotebook();
    const cellId = useNotebookStore.getState().notebooks[id].cells[0].id;
    useNotebookStore.getState().updateSource(id, cellId, "2+2");
    await useNotebookStore.getState().runCell(id, cellId);
    expect(useNotebookStore.getState().notebooks[id].cells[0].output).toBe("4");

    await useNotebookStore.getState().resetKernel(id);
    const cell = useNotebookStore.getState().notebooks[id].cells[0];
    expect(cell.output).toBe("");
    expect(cell.status).toBe("idle");
    expect(cell.lineNumber).toBeNull();
  });

  it("skips empty cells in runCell", async () => {
    const { evaluate } = await import("../tauri/kernel");
    const id = useNotebookStore.getState().createNotebook();
    const cellId = useNotebookStore.getState().notebooks[id].cells[0].id;
    // source is empty — should not call kernel.evaluate
    await useNotebookStore.getState().runCell(id, cellId);
    expect(evaluate).not.toHaveBeenCalled();
  });
});
