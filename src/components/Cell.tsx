import { useRef } from "react";
import { Cell as CellType } from "../types/notebook";
import { useNotebookStore } from "../store/notebook";
import CellInput from "./CellInput";
import CellOutput from "./CellOutput";

interface Props {
  cell: CellType;
  notebookId: string;
  index: number;
}

export default function Cell({ cell, notebookId, index }: Props) {
  const { updateSource, runCell } = useNotebookStore();
  const inputRef = useRef<HTMLDivElement>(null);

  const run = () => runCell(notebookId, cell.id);

  const handleChange = (val: string) => {
    updateSource(notebookId, cell.id, val);
    // In immediate mode, running is triggered by Shift-Enter inside CellInput.
    // In batch mode, user clicks Run All or uses ⌘⇧Enter.
  };

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
          onRun={run}
          lineNumber={cell.lineNumber ?? index + 1}
        />
        <CellOutput cell={cell} />
      </div>
    </div>
  );
}
