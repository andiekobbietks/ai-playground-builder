import { html } from "@codemirror/lang-html";
import { php } from "@codemirror/lang-php";
import { python } from "@codemirror/lang-python";
import { sql } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import CodeMirror from "@uiw/react-codemirror";
import { useMemo } from "react";

import type { EditorProps } from "./editor";

export default function EditorInner({ value, language, onChange }: EditorProps) {
  const extensions = useMemo(() => {
    switch (language) {
      case "python":
        return [python()];
      case "sql":
        return [sql()];
      case "php":
        return [php()];
      case "html":
        return [html()];
      default:
        return [];
    }
  }, [language]);

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <CodeMirror
        value={value}
        theme={oneDark}
        extensions={extensions}
        onChange={onChange}
        basicSetup={{ highlightActiveLine: true, foldGutter: false, autocompletion: true }}
        height="100%"
        style={{ fontSize: 12, height: "100%" }}
      />
    </div>
  );
}
