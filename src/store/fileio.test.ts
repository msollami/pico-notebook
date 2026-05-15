import { describe, it, expect } from "vitest";
import { serialise, deserialise } from "./fileio";
import { newNotebook, newCell } from "../types/notebook";

describe("fileio round-trip", () => {
  it("serialises and deserialises a notebook", () => {
    const nb = newNotebook("Test");
    nb.cells = [
      { ...newCell("2+2"), output: "4", lineNumber: 1, status: "done" },
      { ...newCell("x = 5"), output: "", lineNumber: 2, isNull: true, status: "done" },
    ];

    const json = serialise(nb);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(parsed.title).toBe("Test");
    expect(parsed.cells).toHaveLength(2);
    expect(parsed.cells[0].source).toBe("2+2");
    expect(parsed.cells[0].output).toBe("4");

    const restored = deserialise(json);
    expect(restored.title).toBe("Test");
    expect(restored.cells).toHaveLength(2);
    expect(restored.cells[0].source).toBe("2+2");
    // Status is always idle after load — kernel state not restored
    expect(restored.cells[0].status).toBe("idle");
    expect(restored.cells[1].source).toBe("x = 5");
  });

  it("throws on unsupported version", () => {
    expect(() =>
      deserialise(JSON.stringify({ version: 99, title: "x", cells: [] }))
    ).toThrow("Unsupported .pnb version: 99");
  });

  it("restores cell ids from file", () => {
    const nb = newNotebook("A");
    const json = serialise(nb);
    const restored = deserialise(json);
    expect(restored.cells[0].id).toBe(nb.cells[0].id);
  });
});
