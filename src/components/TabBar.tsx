import { useNotebookStore } from "../store/notebook";

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
