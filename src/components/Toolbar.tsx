import { useNotebookStore } from "../store/notebook";
import { useSettings } from "../store/settings";

interface Props {
  notebookId: string;
}

export default function Toolbar({ notebookId }: Props) {
  const { runAll, resetKernel } = useNotebookStore();
  const { executionMode, setExecutionMode } = useSettings();
  const isImmediate = executionMode === "immediate";

  return (
    <div className="toolbar">
      <button
        className="toolbar-btn"
        title="Run all cells (⌘⇧Enter)"
        onClick={() => runAll(notebookId)}
      >
        ▶ Run All
      </button>
      <button
        className="toolbar-btn"
        title={isImmediate ? "Immediate mode: Shift+Enter runs cell" : "Batch mode: use Run All"}
        onClick={() => setExecutionMode(isImmediate ? "batch" : "immediate")}
        style={{ minWidth: 120 }}
      >
        {isImmediate ? "⚡ Immediate" : "⏸ Batch"}
      </button>
      <button
        className="toolbar-btn danger"
        title="Reset kernel (⌘⇧0)"
        onClick={() => resetKernel(notebookId)}
      >
        ↺ Reset Kernel
      </button>
    </div>
  );
}
