import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { MODE_BLURB, MODE_LABEL, type PedagogyMode } from "@/lib/lampforge";
import { useFocus, useStore } from "@/lib/store";

/* ------------------------------------------------------------------ shell */

const NAV = [
  { to: "/", label: "playground", hint: "contracts + study" },
  { to: "/inspect", label: "inspector", hint: "MCP" },
  { to: "/pde", label: "pde", hint: "build" },
  { to: "/chat", label: "chat", hint: "pedagogy" },
] as const;

export function TopRail() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [focus] = useFocus();
  const [store] = useStore();
  const mode = store.learner.mode as PedagogyMode;

  return (
    <header className="sticky top-0 z-40 flex h-12 shrink-0 items-center gap-1 border-b border-border bg-card/80 px-3 backdrop-blur">
      <Link to="/" className="mr-3 flex items-center gap-2">
        <span className="inline-block size-2 rounded-full bg-primary" />
        <span className="font-mono text-sm font-semibold tracking-tight">LAMPForge</span>
      </Link>
      <nav className="flex items-center gap-1">
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            title={n.hint}
            className={cn(
              "rounded-md px-2.5 py-1 font-mono text-xs transition-colors",
              path === n.to
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            /{n.label}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-3">
        {focus ? (
          <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
            focus: <span className="text-foreground">{focus.kind}</span>/{focus.id}
          </span>
        ) : null}
        <ModeBadge mode={mode} />
      </div>
    </header>
  );
}

export function ModeBadge({ mode, className }: { mode: PedagogyMode; className?: string }) {
  const tone =
    mode === "i_do"
      ? "bg-chart-3/20 text-chart-3"
      : mode === "we_do"
        ? "bg-chart-2/20 text-chart-2"
        : "bg-chart-4/20 text-chart-4";
  return (
    <span
      title={MODE_BLURB[mode]}
      className={cn("rounded-sm px-2 py-0.5 font-mono text-[11px] font-semibold", tone, className)}
    >
      {MODE_LABEL[mode]}
    </span>
  );
}

export function ModeSwitch({
  mode,
  onChange,
}: {
  mode: PedagogyMode;
  onChange: (m: PedagogyMode) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-border p-0.5">
      {(["i_do", "we_do", "you_do"] as PedagogyMode[]).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          title={MODE_BLURB[m]}
          className={cn(
            "rounded-sm px-2 py-1 font-mono text-[11px] transition-colors",
            m === mode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {MODE_LABEL[m]}
        </button>
      ))}
    </div>
  );
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <TopRail />
      <main className={cn("flex min-h-0 flex-1 flex-col", className)}>{children}</main>
    </div>
  );
}

/* ------------------------------------------------------------------- bits */

export function Chip({
  children,
  onClick,
  active,
  title,
}: {
  children: ReactNode;
  onClick?: (() => void) | undefined;
  active?: boolean | undefined;
  title?: string | undefined;
}) {
  const Comp = onClick ? "button" : "span";
  return (
    <Comp
      {...(onClick ? { type: "button" as const, onClick } : {})}
      title={title}
      className={cn(
        "rounded-sm border border-border px-1.5 py-0.5 font-mono text-[11px]",
        active ? "border-primary/60 bg-primary/15 text-primary" : "text-muted-foreground",
        onClick && "hover:border-primary/60 hover:text-foreground",
      )}
    >
      {children}
    </Comp>
  );
}

export function MethodTag({ method }: { method: string }) {
  const tone = method === "GET" ? "bg-chart-2/20 text-chart-2" : "bg-chart-4/20 text-chart-4";
  return (
    <span className={cn("rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-bold", tone)}>{method}</span>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-3 py-2">
      <h2 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{children}</h2>
      {right}
    </div>
  );
}

export function Json({ value, className }: { value: unknown; className?: string }) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <pre
      className={cn(
        "overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-foreground/90",
        className,
      )}
    >
      {text}
    </pre>
  );
}

/** Renders learner-facing Bootstrap markup in a sandboxed frame with real Bootstrap CSS. */
export function BootstrapFrame({ html, height = 320 }: { html: string; height?: number }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [h, setH] = useState(height);
  const doc = `<!doctype html><html data-bs-theme="dark"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<style>body{background:transparent;color:#e6e8ee}</style></head>
<body>${html}
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script>const send=()=>parent.postMessage({t:'h',h:document.body.scrollHeight+24},'*');
addEventListener('load',send);new ResizeObserver(send).observe(document.body);</script>
</body></html>`;

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { t?: string; h?: number };
      if (d?.t === "h" && typeof d.h === "number") setH(Math.max(120, Math.min(900, d.h)));
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  return (
    <iframe
      ref={ref}
      title="Bootstrap artefact"
      srcDoc={doc}
      sandbox="allow-scripts"
      className="w-full rounded-md border border-border bg-[#12141a]"
      style={{ height: h }}
    />
  );
}
