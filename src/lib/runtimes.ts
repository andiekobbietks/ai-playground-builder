/**
 * Browser-first execution runtimes for the PDE.
 *
 * Nothing here is simulated: Python runs in CPython compiled to WebAssembly
 * (Pyodide), SQL runs in real SQLite (sql.js), and PHP runs in the php-wasm
 * build of the PHP interpreter. Every engine is loaded lazily, in the browser
 * only, and reports honest errors when a load fails — we never fabricate output.
 */

type Loader<T> = () => Promise<T>;

function once<T>(loader: Loader<T>): Loader<T> {
  let p: Promise<T> | null = null;
  return () => (p ??= loader());
}

function assertBrowser(engine: string) {
  if (typeof window === "undefined") throw new Error(`${engine} runtime is browser-only`);
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(el);
  });
}

export type RunResult = {
  ok: boolean;
  lines: string[];
  /** Structured result rows, when the engine produced a table (SQL). */
  table?: { columns: string[]; rows: unknown[][] } | null;
  ms: number;
};

/* ------------------------------------------------------------------ python */

const PYODIDE_VERSION = "0.28.3";

type PyodideApi = {
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (o: { batched: (s: string) => void }) => void;
  setStderr: (o: { batched: (s: string) => void }) => void;
  loadPackagesFromImports: (code: string) => Promise<void>;
  globals: { set: (k: string, v: unknown) => void };
};

export const loadPython = once(async (): Promise<PyodideApi> => {
  assertBrowser("Python");
  const mod = (await import(
    /* @vite-ignore */ `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.mjs`
  )) as { loadPyodide: (o: { indexURL: string }) => Promise<PyodideApi> };
  return mod.loadPyodide({ indexURL: `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/` });
});

export async function runPython(code: string): Promise<RunResult> {
  const start = performance.now();
  const lines: string[] = [];
  try {
    const py = await loadPython();
    py.setStdout({ batched: (s) => lines.push(s) });
    py.setStderr({ batched: (s) => lines.push(s) });
    await py.loadPackagesFromImports(code);
    const value = await py.runPythonAsync(code);
    if (value !== undefined && value !== null) lines.push(String(value));
    return { ok: true, lines, ms: performance.now() - start };
  } catch (err) {
    lines.push(err instanceof Error ? err.message : String(err));
    return { ok: false, lines, ms: performance.now() - start };
  }
}

/* -------------------------------------------------------------------- sql */

type SqlDatabase = {
  exec: (sql: string) => Array<{ columns: string[]; values: unknown[][] }>;
  getRowsModified: () => number;
};

let db: SqlDatabase | null = null;

const loadSqlite = once(async () => {
  assertBrowser("SQLite");
  const w = window as unknown as {
    initSqlJs?: (o: { locateFile: (f: string) => string }) => Promise<{
      Database: new () => SqlDatabase;
    }>;
  };
  if (!w.initSqlJs) await loadScript("https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/sql-wasm.js");
  if (!w.initSqlJs) throw new Error("sql.js failed to initialise");
  return w.initSqlJs({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/${f}` });
});

export async function resetSql() {
  const SQL = await loadSqlite();
  db = new SQL.Database();
  return db;
}

export async function runSql(sql: string): Promise<RunResult> {
  const start = performance.now();
  const lines: string[] = [];
  try {
    const SQL = await loadSqlite();
    db ??= new SQL.Database();
    // MySQL-isms the WJEC syllabus uses, mapped onto SQLite's dialect so the
    // learner's schema executes for real rather than being pretty-printed.
    const portable = sql
      .replace(/\bINT\s+AUTO_INCREMENT\s+PRIMARY\s+KEY\b/gi, "INTEGER PRIMARY KEY AUTOINCREMENT")
      .replace(/\bAUTO_INCREMENT\b/gi, "")
      .replace(/\bUNIQUE\s+KEY\s+\w+\s*\(/gi, "UNIQUE (")
      .replace(/\bENGINE\s*=\s*\w+/gi, "")
      .replace(/\bDATETIME\b/gi, "TEXT");
    const out = db.exec(portable);
    const last = out.at(-1);
    if (last) {
      lines.push(last.columns.join(" | "));
      for (const row of last.values) lines.push(row.map((v) => String(v ?? "NULL")).join(" | "));
      return {
        ok: true,
        lines,
        table: { columns: last.columns, rows: last.values },
        ms: performance.now() - start,
      };
    }
    lines.push(`OK · ${db.getRowsModified()} row(s) modified`);
    return { ok: true, lines, table: null, ms: performance.now() - start };
  } catch (err) {
    lines.push(err instanceof Error ? err.message : String(err));
    return { ok: false, lines, ms: performance.now() - start };
  }
}

/* -------------------------------------------------------------------- php */

type PhpApi = {
  addEventListener: (t: string, cb: (e: { detail: string | number[] }) => void) => void;
  removeEventListener: (t: string, cb: (e: { detail: string | number[] }) => void) => void;
  run: (code: string) => Promise<number>;
  binary?: Promise<unknown>;
};

const loadPhp = once(async (): Promise<PhpApi> => {
  assertBrowser("PHP");
  const url = "https://cdn.jsdelivr.net/npm/php-wasm@0.1.0/PhpWeb.mjs";
  const mod = (await import(/* @vite-ignore */ url)) as {
    PhpWeb: new (o?: Record<string, unknown>) => PhpApi;
  };
  const php = new mod.PhpWeb();
  await php.binary;
  return php;
});

function decode(detail: string | number[]) {
  return typeof detail === "string" ? detail : new TextDecoder().decode(new Uint8Array(detail));
}

export async function runPhp(code: string): Promise<RunResult> {
  const start = performance.now();
  const lines: string[] = [];
  try {
    const php = await loadPhp();
    const onOut = (e: { detail: string | number[] }) => lines.push(decode(e.detail));
    php.addEventListener("output", onOut);
    php.addEventListener("error", onOut);
    const exit = await php.run(code);
    php.removeEventListener("output", onOut);
    php.removeEventListener("error", onOut);
    return { ok: exit === 0, lines: lines.join("").split("\n"), ms: performance.now() - start };
  } catch (err) {
    lines.push(err instanceof Error ? err.message : String(err));
    return { ok: false, lines, ms: performance.now() - start };
  }
}

/* ------------------------------------------------------------------ facade */

export type Engine = "python" | "sql" | "php" | "html";

export function engineFor(path: string): Engine {
  if (path.endsWith(".py")) return "python";
  if (path.endsWith(".sql")) return "sql";
  if (path.endsWith(".php")) return "php";
  return "html";
}

export async function run(engine: Engine, source: string): Promise<RunResult> {
  if (engine === "python") return runPython(source);
  if (engine === "sql") return runSql(source);
  if (engine === "php") return runPhp(source);
  return { ok: true, lines: ["rendered in the live preview pane"], ms: 0 };
}
