/**
 * Real code editing surface for the PDE.
 *
 * CodeMirror 6 is browser-only, so the component is lazily imported behind
 * <ClientOnly>. Language support is chosen from the file extension.
 */
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const Inner = lazy(() => import("./editor-inner"));

export type EditorProps = {
  value: string;
  language: "python" | "sql" | "php" | "html" | "markdown";
  onChange: (next: string) => void;
};

function Skeleton() {
  return (
    <div className="min-h-0 flex-1 animate-pulse bg-muted/20 p-3 font-mono text-[11px] text-muted-foreground">
      loading editor…
    </div>
  );
}

export function CodeEditor(props: EditorProps) {
  return (
    <ClientOnly fallback={<Skeleton />}>
      <Suspense fallback={<Skeleton />}>
        <Inner {...props} />
      </Suspense>
    </ClientOnly>
  );
}
