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

/**
 * A real SQLite booking database, created inside PHP over PDO. This is what
 * turns "PHP and SQL shown and reasoned about" into "PHP and SQL executed":
 * the learner's `$pdo->prepare(...)` calls hit an actual database and return
 * actual rows. The schema is the LAMP booking domain the curriculum teaches.
 */
const PHP_DB_BOOTSTRAP = [
  "<?php",
  "error_reporting(E_ALL);",
  "ini_set('display_errors', '1');",
  "try {",
  "  $pdo = new PDO('sqlite::memory:');",
  "  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);",
  "  $pdo->exec('CREATE TABLE customers (id INTEGER PRIMARY KEY, full_name TEXT NOT NULL)');",
  "  $pdo->exec('CREATE TABLE slots (id INTEGER PRIMARY KEY, starts_at TEXT NOT NULL)');",
  "  $pdo->exec('CREATE TABLE bookings (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER, slot_id INTEGER, status TEXT DEFAULT \\'pending\\')');",
  "  $pdo->exec(\"INSERT INTO customers (id, full_name) VALUES (1,'Ada Lovelace'),(2,'Grace Hopper')\");",
  "  $pdo->exec(\"INSERT INTO slots (id, starts_at) VALUES (1,'2026-09-01 09:00'),(2,'2026-09-01 10:00')\");",
  "  $pdo->exec(\"INSERT INTO bookings (customer_id, slot_id, status) VALUES (2,2,'confirmed')\");",
  "} catch (Throwable $e) {",
  "  fwrite(STDERR, 'db bootstrap failed: ' . $e->getMessage() . \"\\n\");",
  "}",
  "// Context the curriculum snippets assume when they run as a POST handler.",
  "$customerId = 1; $slotId = 1;",
  "$_SERVER['REQUEST_METHOD'] = $_SERVER['REQUEST_METHOD'] ?? 'POST';",
  "$_POST = $_POST ?: ['name' => 'Ada Lovelace', 'email' => 'ada@example.com'];",
  "?>",
].join("\n");

const PHP_DB_TRAILER = [
  "<?php",
  "// Show the effect on the database so the learner sees PHP and SQL interact.",
  "try {",
  "  echo \"\\n--- bookings after your code ran ---\\n\";",
  "  $stmt = $pdo->query('SELECT b.id, c.full_name, s.starts_at, b.status FROM bookings b JOIN customers c ON c.id = b.customer_id JOIN slots s ON s.id = b.slot_id ORDER BY b.id');",
  "  foreach ($stmt as $r) { printf(\"#%d  %-16s  %s  [%s]\\n\", $r['id'], $r['full_name'], $r['starts_at'], $r['status']); }",
  "} catch (Throwable $e) { fwrite(STDERR, 'trailer query failed: ' . $e->getMessage() . \"\\n\"); }",
].join("\n");

/** Strip a single leading `<?php`/`<?` tag so learner code can be concatenated. */
function stripOpeningTag(code: string): string {
  return code.replace(/^\s*<\?(php)?\s*/i, "");
}

export type PhpOptions = {
  /** Seed an in-memory PDO booking database and print the table after running. */
  withDb?: boolean;
};

export async function runPhp(code: string, opts: PhpOptions = {}): Promise<RunResult> {
  const start = performance.now();
  const lines: string[] = [];
  const source = opts.withDb
    ? `${PHP_DB_BOOTSTRAP}\n<?php\n${stripOpeningTag(code)}\n?>\n${PHP_DB_TRAILER}`
    : code;
  try {
    const php = await loadPhp();
    const onOut = (e: { detail: string | number[] }) => lines.push(decode(e.detail));
    php.addEventListener("output", onOut);
    php.addEventListener("error", onOut);
    const exit = await php.run(source);
    php.removeEventListener("output", onOut);
    php.removeEventListener("error", onOut);
    const text = lines.join("");
    return { ok: exit === 0, lines: text ? text.split("\n") : ["(no output)"], ms: performance.now() - start };
  } catch (err) {
    lines.push(err instanceof Error ? err.message : String(err));
    return { ok: false, lines, ms: performance.now() - start };
  }
}

/**
 * The booking schema in MySQL dialect, seeded so the curriculum's SELECT/INSERT
 * examples return rows. `runSql` maps the MySQL-isms onto SQLite for real
 * execution, so this is the same schema a WJEC learner would write.
 */
const BOOKING_SCHEMA_MYSQL = `CREATE TABLE customers (id INT AUTO_INCREMENT PRIMARY KEY, full_name VARCHAR(80) NOT NULL);
CREATE TABLE slots (id INT AUTO_INCREMENT PRIMARY KEY, starts_at DATETIME NOT NULL);
CREATE TABLE bookings (id INT AUTO_INCREMENT PRIMARY KEY, customer_id INT, slot_id INT, status VARCHAR(20) DEFAULT 'pending');
INSERT INTO customers (full_name) VALUES ('Ada Lovelace'), ('Grace Hopper');
INSERT INTO slots (starts_at) VALUES ('2026-09-01 09:00'), ('2026-09-01 10:00');
INSERT INTO bookings (customer_id, slot_id, status) VALUES (2, 2, 'confirmed');`;

/**
 * Positionally fill `?` placeholders with sample literals so a prepared
 * statement's SQL can be executed standalone for demonstration. Returns the
 * substituted SQL and whether any substitution happened.
 */
function fillPlaceholders(sql: string): { sql: string; substituted: boolean } {
  const samples = ["1", "1", "'pending'", "'2026-09-01 09:00'"];
  let i = 0;
  let substituted = false;
  const out = sql.replace(/\?/g, () => {
    substituted = true;
    return samples[i++] ?? "1";
  });
  return { sql: out, substituted };
}

/** Reset the SQLite database, seed the booking schema, then run `sql` for real. */
export async function runSqlSeeded(sql: string): Promise<RunResult> {
  await resetSql();
  const seedResult = await runSql(BOOKING_SCHEMA_MYSQL);
  if (!seedResult.ok) return seedResult;
  const { sql: filled, substituted } = fillPlaceholders(sql);
  const result = await runSql(filled);
  if (substituted) {
    result.lines = [
      "note: prepared-statement placeholders (?) filled with sample values [1, 1] for this demo run",
      ...result.lines,
    ];
  }
  return result;
}

/* ------------------------------------------------------------------ facade */

export type Engine = "python" | "sql" | "php" | "html";

export type ExperienceRun = {
  php?: RunResult | null;
  sql?: RunResult | null;
};

/**
 * Run an experience's PHP and SQL for real: PHP against a seeded PDO booking
 * database, SQL against a seeded SQLite booking schema. This is what makes the
 * chat's generative components executable rather than merely illustrative.
 */
export async function runExperience(input: { php?: string | null; sql?: string | null }): Promise<ExperienceRun> {
  const [php, sql] = await Promise.all([
    input.php ? runPhp(input.php, { withDb: true }) : Promise.resolve(null),
    input.sql ? runSqlSeeded(input.sql) : Promise.resolve(null),
  ]);
  return { php, sql };
}

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
