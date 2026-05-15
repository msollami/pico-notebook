import CodeMirror from "@uiw/react-codemirror";
import { StreamLanguage } from "@codemirror/language";
import { mathematica } from "@codemirror/legacy-modes/mode/mathematica";
import { keymap } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";

const mathLang = StreamLanguage.define(mathematica);

interface Props {
  value: string;
  onChange: (val: string) => void;
  /** Called when the user requests evaluation. Null in batch mode — Shift-Enter is a no-op. */
  onRun: (() => void) | null;
  lineNumber: number | null;
}

export default function CellInput({ value, onChange, onRun, lineNumber }: Props) {
  const extraKeymap = keymap.of([
    {
      key: "Shift-Enter",
      run: () => {
        onRun?.();
        return true; // always consume the keystroke so it doesn't insert a newline
      },
    },
  ]);

  return (
    <div className="cell-input">
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={[mathLang, extraKeymap, keymap.of(defaultKeymap)]}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          dropCursor: false,
          allowMultipleSelections: false,
          indentOnInput: false,
          highlightActiveLine: false,
          highlightSelectionMatches: false,
          closeBrackets: true,
          autocompletion: false,
          searchKeymap: false,
          lintKeymap: false,
          completionKeymap: false,
        }}
        placeholder={`In[${lineNumber ?? "?"}]:= `}
        theme="none"
        style={{ background: "transparent" }}
      />
    </div>
  );
}
