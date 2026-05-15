import { Notebook } from "../types/notebook";
import { useNotebookStore } from "../store/notebook";

function kernelDot(nb: Notebook) {
  const busy = nb.cells.some((c) => c.status === "running");
  const dead = nb.cells.some(
    (c) => c.isError && c.output.includes("kernel is dead")
  );
  const cls = dead ? "dead" : busy ? "busy" : "ready";
  const title = dead ? "Kernel dead — reset to restart" : busy ? "Evaluating…" : "Kernel ready";
  return <span className={`kernel-dot ${cls}`} title={title} />;
}

export default function TabBar() {
  const { notebooks, activeId, setActive, closeNotebook, createNotebook } =
    useNotebookStore();
  const tabs = Object.values(notebooks);

  return (
    <div className="tab-bar">
      {tabs.map((nb) => (
        <div
          key={nb.id}
          className={`tab ${nb.id === activeId ? "active" : ""}`}
          onClick={() => setActive(nb.id)}
        >
          {kernelDot(nb)}
          <span>
            {nb.title}
            {nb.dirty ? " ●" : ""}
          </span>
          <span
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation();
              closeNotebook(nb.id);
            }}
          >
            ×
          </span>
        </div>
      ))}
      <button className="tab-new" title="New notebook (⌘N)" onClick={createNotebook}>
        +
      </button>
    </div>
  );
}
