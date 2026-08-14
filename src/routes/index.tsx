import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { useRef, type ReactNode } from "react";

import { TopRail } from "@/components/lampforge/primitives";
import { seed } from "@/lib/lampforge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LAMPForge — a browser-native studio for teaching the LAMP stack" },
      {
        name: "description",
        content:
          "LAMPForge runs CPython, SQLite and PHP on WebAssembly next to a contract playground, an MCP inspector and a conversational pedagogy engine — one composable studio for WJEC Unit 4.",
      },
      { property: "og:title", content: "LAMPForge — the pedagogical studio for LAMP" },
      {
        property: "og:description",
        content:
          "Four composable surfaces: playground, inspector, PDE and chat. Real runtimes, one canonical contract.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

/* ------------------------------------------------------------- primitives */

function useProgress(target: React.RefObject<HTMLElement | null>) {
  const { scrollYProgress } = useScroll({ target, offset: ["start end", "end start"] });
  return useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });
}

function Parallax({
  children,
  distance = 60,
  className,
}: {
  children: ReactNode;
  distance?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const p = useProgress(ref);
  const reduce = useReducedMotion();
  const y = useTransform(p, [0, 1], [distance, -distance]);
  return (
    <motion.div ref={ref} style={reduce ? {} : { y }} className={className}>
      {children}
    </motion.div>
  );
}

function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-15%" }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------- hero */

function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const reduce = useReducedMotion();
  const gridY = useTransform(scrollYProgress, [0, 1], ["0%", "35%"]);
  const glowY = useTransform(scrollYProgress, [0, 1], ["0%", "60%"]);
  const titleY = useTransform(scrollYProgress, [0, 1], ["0%", "-25%"]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section ref={ref} className="relative flex min-h-[92vh] items-center overflow-hidden">
      <motion.div
        aria-hidden
        style={reduce ? {} : { y: gridY }}
        className="pointer-events-none absolute inset-0 -z-20 opacity-[0.18] [background-image:linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] [background-size:48px_48px]"
      />
      <motion.div
        aria-hidden
        style={reduce ? {} : { y: glowY }}
        className="pointer-events-none absolute left-1/2 top-[-18%] -z-10 size-[42rem] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]"
      />
      <motion.div style={reduce ? {} : { y: titleY, opacity: fade }} className="mx-auto max-w-4xl px-6">
        <p className="mb-5 font-mono text-[11px] uppercase tracking-[0.35em] text-primary">
          WJEC Unit 4 · Linux · Apache · MySQL · PHP
        </p>
        <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl">
          A studio where the <span className="text-primary">runtime teaches</span> and the code is real.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          LAMPForge is one composable product with four surfaces. Nothing is mocked: CPython, SQLite and PHP
          execute in your browser on WebAssembly, the contract is generated from Pydantic models, and the
          assistant is bound to a gradual-release teaching rule instead of an autocomplete reflex.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            to="/pde"
            className="rounded-md bg-primary px-5 py-2.5 font-mono text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
          >
            open the PDE
          </Link>
          <Link
            to="/chat"
            className="rounded-md border border-border px-5 py-2.5 font-mono text-sm text-foreground transition-colors hover:border-primary/60 hover:text-primary"
          >
            talk to the runtime
          </Link>
          <span className="font-mono text-[11px] text-muted-foreground">
            {seed.concepts.length} concepts · {seed.decisions.length} decision records
          </span>
        </div>
      </motion.div>
      <motion.div
        aria-hidden
        style={reduce ? {} : { opacity: fade }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 font-mono text-[11px] text-muted-foreground"
      >
        scroll — the product explains itself
      </motion.div>
    </section>
  );
}

/* ------------------------------------------------------- scrollytelling */

type Chapter = {
  id: string;
  kicker: string;
  title: string;
  body: string;
  to: "/pde" | "/chat" | "/playground" | "/inspect";
  cta: string;
  beats: { label: string; detail: string }[];
};

const CHAPTERS: Chapter[] = [
  {
    id: "pde",
    kicker: "surface one",
    title: "The PDE runs your code, not a video of your code.",
    to: "/pde",
    cta: "open the PDE",
    body: "CodeMirror for editing, Pyodide for CPython, sql.js for a real SQLite database, php-wasm for the interpreter itself, and a sandboxed Bootstrap frame for the artefact. The terminal prints stdout from those runtimes — there is no fake trace anywhere in the surface.",
    beats: [
      { label: "pedagogy.py", detail: "CPython 3.12 · Pyodide" },
      { label: "schema.sql", detail: "SQLite 3 · sql.js" },
      { label: "create_booking.php", detail: "PHP 8 · php-wasm" },
      { label: "index.html", detail: "Bootstrap 5 · sandboxed frame" },
    ],
  },
  {
    id: "chat",
    kicker: "surface two",
    title: "Conversation that holds a teaching contract.",
    to: "/chat",
    cta: "open chat",
    body: "Streaming through the Vercel AI SDK, with every teaching move expressed as a tool call: explain a concept, build an experience, show the decision record, assess the evidence. The mode — I do, we do, you do — changes what the model is permitted to hand you.",
    beats: [
      { label: "explain_concept", detail: "renders a concept card" },
      { label: "build_experience", detail: "renders live Bootstrap + PHP + SQL" },
      { label: "show_adr", detail: "renders the decision and its evidence" },
      { label: "assess_evidence", detail: "moves the learner model" },
    ],
  },
  {
    id: "playground",
    kicker: "surface three",
    title: "A contract you can run, read and trace.",
    to: "/playground",
    cta: "open the playground",
    body: "The OpenAPI document and JSON Schemas are generated from Pydantic models, so the playground is never out of date with the runtime. Every response links back to the architectural decision that produced its shape.",
    beats: [
      { label: "operations", detail: "executed against the live edge API" },
      { label: "schemas", detail: "recursive Pydantic-authored explorer" },
      { label: "decisions", detail: "ADR + evidence for each contract" },
      { label: "/inspect", detail: "the same tools over MCP JSON-RPC" },
    ],
  },
];

function ChapterBlock({ chapter, index }: { chapter: Chapter; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const reduce = useReducedMotion();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });
  const barScale = useTransform(progress, [0.15, 0.85], [0, 1]);

  return (
    <section ref={ref} className="relative border-t border-border/60 py-28">
      <div className="mx-auto grid max-w-6xl gap-14 px-6 lg:grid-cols-2 lg:items-start">
        <div className={cn("lg:sticky lg:top-24", index % 2 === 1 && "lg:order-2")}>
          <Reveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary">{chapter.kicker}</p>
            <h2 className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              {chapter.title}
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground">{chapter.body}</p>
            <Link
              to={chapter.to}
              className="mt-7 inline-block rounded-md border border-primary/50 px-4 py-2 font-mono text-xs text-primary transition-colors hover:bg-primary/10"
            >
              {chapter.cta} →
            </Link>
            <motion.div
              aria-hidden
              style={reduce ? {} : { scaleX: barScale }}
              className="mt-8 h-px origin-left bg-primary/70"
            />
          </Reveal>
        </div>

        <Parallax distance={index % 2 === 0 ? 48 : 32} className="space-y-3">
          {chapter.beats.map((b, i) => (
            <Reveal key={b.label} delay={i * 0.08}>
              <div className="flex items-center justify-between rounded-lg border border-border bg-card/60 px-4 py-3 backdrop-blur transition-colors hover:border-primary/50">
                <span className="font-mono text-sm text-foreground">{b.label}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{b.detail}</span>
              </div>
            </Reveal>
          ))}
        </Parallax>
      </div>
    </section>
  );
}

function Composability() {
  return (
    <section className="border-t border-border/60 py-28">
      <div className="mx-auto max-w-5xl px-6">
        <Reveal>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary">composability</p>
          <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            One model. Four projections. No drift.
          </h2>
        </Reveal>
        <Parallax distance={30} className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { t: "Pydantic models", d: "Concepts, decisions, evidence, experiences and the learner state." },
            { t: "Generated contract", d: "OpenAPI + JSON Schema emitted into the app at build time." },
            { t: "Edge runtime", d: "A one-for-one TypeScript mirror serving HTTP and MCP JSON-RPC." },
            { t: "WASM runtimes", d: "CPython, SQLite and PHP executing in the learner's own browser." },
          ].map((c, i) => (
            <Reveal key={c.t} delay={i * 0.07}>
              <div className="h-full rounded-lg border border-border bg-card/50 p-5">
                <h3 className="font-mono text-sm text-primary">{c.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.d}</p>
              </div>
            </Reveal>
          ))}
        </Parallax>
      </div>
    </section>
  );
}

function Landing() {
  const { scrollYProgress } = useScroll();
  const bar = useSpring(scrollYProgress, { stiffness: 140, damping: 30 });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopRail />
      <motion.div
        aria-hidden
        style={{ scaleX: bar }}
        className="fixed left-0 top-12 z-50 h-0.5 w-full origin-left bg-primary"
      />
      <main>
        <Hero />
        {CHAPTERS.map((c, i) => (
          <ChapterBlock key={c.id} chapter={c} index={i} />
        ))}
        <Composability />
        <footer className="border-t border-border/60 py-16 text-center">
          <p className="font-mono text-[11px] text-muted-foreground">
            LAMPForge — inspectable, manipulable, traceable. Built for WJEC Unit 4.
          </p>
        </footer>
      </main>
    </div>
  );
}
