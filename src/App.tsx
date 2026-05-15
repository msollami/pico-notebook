import { useEffect } from "react";
import { useNotebookStore } from "./store/notebook";
import { useShortcuts } from "./hooks/useShortcuts";
import TabBar from "./components/TabBar";
import NotebookView from "./components/NotebookView";

function App() {
  const { activeId, createNotebook } = useNotebookStore();

  useEffect(() => {
    if (!activeId) createNotebook();
  }, [activeId, createNotebook]);

  useShortcuts(activeId);

  return (
    <div className="app">
      <TabBar />
      {activeId ? (
        <NotebookView id={activeId} />
      ) : (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--fg-muted)",
          }}
        >
          No notebook open — press ⌘N
        </div>
      )}
    </div>
  );
}

export default App;
