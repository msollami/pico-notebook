import { Cell } from "../types/notebook";

interface Props {
  cell: Cell;
}

export default function CellOutput({ cell }: Props) {
  if (cell.status === "idle" || cell.status === "queued") return null;
  if (cell.status === "running") {
    return (
      <div className="cell-output is-null" style={{ fontStyle: "italic" }}>
        evaluating…
      </div>
    );
  }
  if (!cell.output) return null;

  const classes = [
    "cell-output",
    cell.isNull ? "is-null" : "",
    cell.isError ? "is-error" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Suppress raw "Null" for assignments — show nothing
  const display = cell.isNull ? null : cell.output;

  return (
    <>
      {display !== null && (
        <div className={classes}>
          {cell.lineNumber ? (
            <span className="gutter-out" style={{ marginRight: 8, userSelect: "none" }}>
              Out[{cell.lineNumber}]=
            </span>
          ) : null}
          {display}
        </div>
      )}
      {cell.elapsedMs !== null && (
        <div className="cell-output-meta" style={{ paddingLeft: cell.lineNumber ? 72 : 8 }}>
          {cell.elapsedMs} ms
        </div>
      )}
    </>
  );
}
