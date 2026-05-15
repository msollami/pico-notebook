import { useNotebookStore } from "../store/notebook";
import Cell from "./Cell";
import Toolbar from "./Toolbar";

interface Props {
  id: string;
}

export default function NotebookView({ id }: Props) {
  const { notebooks, appendCell } = useNotebookStore();
  const notebook = notebooks[id];
  if (!notebook) return null;

  return (
    <div className="notebook-view">
      <Toolbar notebookId={id} />
      <div className="cell-list">
        {notebook.cells.map((cell, i) => (
          <Cell key={cell.id} cell={cell} notebookId={id} index={i} />
        ))}
        <button className="add-cell-btn" onClick={() => appendCell(id)}>
          + Add cell
        </button>
      </div>
    </div>
  );
}
