import { useRef } from "react";
import { Cell as CellType } from "../types/notebook";
import { useNotebookStore } from "../store/notebook";
import { useSettings } from "../store/settings";
import CellInput from "./CellInput";
import CellOutput from "./CellOutput";

interface Props {
  cell: CellType;
  notebookId: string;
  index: number;
}

export default function Cell({ cell, notebookId, index }: Props) {
  const { updateSource, runCell } = useNotebookStore();
  const { executionMode } = useSettings();
  const inputRef = useRef<HTMLDivElement>(null);

  // In batch mode Shift-Enter is a no-op — user runs via Run All or ⌘⇧Enter.
  const onRun = executionMode === "immediate" ? () => runCell(notebookId, cell.id) : null;

  const handleChange = (val: string) => updateSource(notebookId, cell.id, val);

  const statusClass = cell.status === "running"
    ? "running"
    : cell.isError
    ? "error"
    : "";

  return (
    <div
      ref={inputRef}
      className={`cell ${statusClass}`}
      data-cell-id={cell.id}
    >
      {/* Gutter */}
      <div className="cell-gutter">
        <span className="gutter-in">In[{index + 1}]</span>
      </div>

      {/* Body */}
      <div className="cell-body">
        <CellInput
          value={cell.source}
          onChange={handleChange}
          onRun={onRun}
          lineNumber={cell.lineNumber ?? index + 1}
        />
        <CellOutput cell={cell} />
      </div>
    </div>
  );
}
