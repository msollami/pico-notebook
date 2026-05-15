import { useNotebookStore } from "../store/notebook";

interface Props {
  notebookId: string;
}

export default function Toolbar({ notebookId }: Props) {
  const { runAll, resetKernel } = useNotebookStore();

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
        className="toolbar-btn danger"
        title="Reset kernel (⌘⇧0)"
        onClick={() => resetKernel(notebookId)}
      >
        ↺ Reset Kernel
      </button>
    </div>
  );
}
