import { useChat } from "@ai-sdk/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DefaultChatTransport } from "ai";
import { CheckIcon, CopyIcon, PencilRulerIcon, RefreshCcwIcon, ScanEyeIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { AdrView } from "@/routes/index";
import {
  BootstrapFrame,
  Chip,
  Json,
  ModeSwitch,
  Page,
  SectionTitle,
} from "@/components/lampforge/primitives";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputButton,
} from "@/components/ai-elements/prompt-input";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Source, Sources, SourcesContent, SourcesTrigger } from "@/components/ai-elements/sources";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { MODE_BLURB, conceptById, seed, type Decision, type PedagogyMode } from "@/lib/lampforge";
import { useFocus, useStore } from "@/lib/store";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Conversational pedagogy — LAMPForge chat" },
      {
        name: "description",
        content:
          "A streaming tutor that moves through I DO, WE DO and YOU DO, answering with live Bootstrap components, ADR cards and runnable LAMP code you can inspect and trace.",
      },
      { property: "og:title", content: "Conversational pedagogy — LAMPForge chat" },
      {
        property: "og:description",
        content: "Gradual-release teaching with inline generative UI: components, ADRs, code and learner state.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatSurface,
});

/** Suggestions are mode-aware: the tutor offers the move the mode allows. */
const SUGGESTIONS: Record<PedagogyMode, string[]> = {
  i_do: [
    "Model a prepared statement end to end and narrate every decision.",
    "Show me the booking form you would write, and why.",
    "Walk through the ADR for the bookings schema.",
    "Demonstrate server-side validation in PHP.",
  ],
  we_do: [
    "Explain prepared statements the way you'd teach them.",
    "Start a booking form with validation and hand me the next step.",
    "Why did we normalise the bookings table? Show the ADR.",
    "Give me the first half of the availability query.",
  ],
  you_do: [
    "Set me a task on injection-safe queries.",
    "Assess this: I used mysqli_real_escape_string to stop injection.",
    "Check my booking form against the success criteria.",
    "Quiz me on normalisation to 3NF.",
  ],
};

type ToolPartShape = { type: string; state: string; output?: unknown; input?: unknown; errorText?: string };

function ChatSurface() {
  const [store, setStore] = useStore();
  const [, setFocus] = useFocus();
  const mode = store.learner.mode as PedagogyMode;
  const [input, setInput] = useState("");
  const [showReasoning, setShowReasoning] = useState(true);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages }) => ({ body: { messages, mode } }),
      }),
    [mode],
  );

  const { messages, sendMessage, status, error, regenerate, stop } = useChat({ transport });
  const busy = status === "submitted" || status === "streaming";

  const send = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      void sendMessage({ text });
      setInput("");
    },
    [sendMessage],
  );

  return (
    <Page>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-h-0 flex-col">
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2">
            <ModeSwitch
              mode={mode}
              onChange={(m) => setStore((s) => ({ learner: { ...s.learner, mode: m } }))}
            />
            <p className="text-body-sm text-muted-foreground">{MODE_BLURB[mode]}</p>
          </div>

          <Conversation className="min-h-0 flex-1">
            <ConversationContent>
              {messages.length === 0 ? (
                <div className="space-y-3 p-2">
                  <h1>Ask, and it teaches at your level.</h1>
                  <p className="max-w-prose text-body-sm text-muted-foreground">
                    Every answer can arrive as an object you can inspect: a live Bootstrap component, an ADR, a concept
                    card, an assessment. Ask why it works, trace it to the code, trace it to the decision.
                  </p>
                </div>
              ) : null}

              {messages.map((m) => {
                const text = m.parts
                  .filter((p): p is { type: "text"; text: string } => p.type === "text")
                  .map((p) => p.text)
                  .join("\n\n");
                const cited = citations(m.parts as ToolPartShape[]);

                return (
                  <Message from={m.role} key={m.id}>
                    <MessageContent>
                      {cited.length > 0 ? (
                        <Sources>
                          <SourcesTrigger count={cited.length} />
                          <SourcesContent>
                            {cited.map((c) => (
                              <Source key={c.href} href={c.href} title={c.title} />
                            ))}
                          </SourcesContent>
                        </Sources>
                      ) : null}

                      {m.parts.map((part, i) => {
                        const key = `${m.id}-${i}`;
                        if (part.type === "text")
                          return <MessageResponse key={key}>{part.text}</MessageResponse>;
                        if (part.type === "reasoning" && showReasoning)
                          return (
                            <Reasoning key={key} isStreaming={busy} className="w-full">
                              <ReasoningTrigger />
                              <ReasoningContent>{part.text}</ReasoningContent>
                            </Reasoning>
                          );
                        if (part.type.startsWith("tool-")) {
                          const tp = part as unknown as ToolPartShape;
                          return (
                            <ToolPart
                              key={key}
                              name={tp.type.replace("tool-", "")}
                              state={tp.state}
                              input={tp.input}
                              output={tp.output}
                              onInspect={setFocus}
                            />
                          );
                        }
                        return null;
                      })}

                      {m.role === "assistant" && !busy ? (
                        <MessageActions>
                          <CopyAction text={text} />
                          <MessageAction label="Ask again" tooltip="Regenerate this teaching move">
                            <button type="button" onClick={() => void regenerate()} aria-label="Regenerate">
                              <RefreshCcwIcon className="size-3.5" />
                            </button>
                          </MessageAction>
                          <MessageAction label="Take to the PDE" tooltip="Continue this in the build surface">
                            <Link to="/pde" aria-label="Open in PDE">
                              <PencilRulerIcon className="size-3.5" />
                            </Link>
                          </MessageAction>
                        </MessageActions>
                      ) : null}
                    </MessageContent>
                  </Message>
                );
              })}

              {busy ? <Shimmer className="px-2 text-body-sm">thinking about how much to hand over…</Shimmer> : null}
              {error ? (
                <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-body-sm text-destructive">
                  {error.message}
                </p>
              ) : null}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <div className="space-y-2 border-t border-border p-3">
            <Suggestions>
              {SUGGESTIONS[mode].map((s) => (
                <Suggestion key={s} suggestion={s} onClick={send} />
              ))}
            </Suggestions>

            <PromptInput
              onSubmit={(msg) => send(msg.text ?? input)}
              className="rounded-lg border border-border bg-card/40"
            >
              <PromptInputBody>
                <PromptInputTextarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask for an explanation, a component, an ADR, or hand in evidence…"
                />
              </PromptInputBody>
              <PromptInputFooter>
                <PromptInputTools>
                  <PromptInputButton
                    variant={showReasoning ? "default" : "ghost"}
                    onClick={() => setShowReasoning((v) => !v)}
                  >
                    <ScanEyeIcon className="size-3.5" />
                    <span>teaching move</span>
                  </PromptInputButton>
                  <span className="label-caps px-1 text-muted-foreground">
                    tools: explain · build · adr · assess · learner
                  </span>
                </PromptInputTools>
                <PromptInputSubmit
                  status={status}
                  onClick={busy ? () => void stop() : undefined}
                  disabled={!input.trim() && !busy}
                />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>

        <aside className="min-h-0 overflow-auto border-t border-border lg:border-l lg:border-t-0">
          <SectionTitle>learner model</SectionTitle>
          <dl className="grid grid-cols-2 gap-x-2 gap-y-1 p-3 font-mono text-code">
            {(
              [
                ["accuracy", `${Math.round(store.learner.accuracy * 100)}%`],
                ["median response", `${store.learner.median_response_ms}ms`],
                ["retries", store.learner.retries],
                ["hints", store.learner.hint_requests],
                ["idle", `${store.learner.idle_seconds}s`],
                [
                  "retrievals",
                  `${store.learner.successful_retrievals}/${store.learner.successful_retrievals + store.learner.failed_retrievals}`,
                ],
                ["since exposure", `${store.learner.seconds_since_last_exposure}s`],
                ["difficulty", store.learner.task_difficulty],
              ] as Array<[string, string | number]>
            ).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
          <SectionTitle>mastered</SectionTitle>
          <div className="flex flex-wrap gap-1 p-3">
            {store.learner.mastered_concept_ids.map((id) => (
              <Chip key={id} title={conceptById(id)?.summary}>
                {conceptById(id)?.title ?? id}
              </Chip>
            ))}
          </div>
          <SectionTitle>emerging</SectionTitle>
          <div className="flex flex-wrap gap-1 p-3">
            {store.learner.emerging_concept_ids.map((id) => (
              <Chip key={id} title={conceptById(id)?.summary}>
                {conceptById(id)?.title ?? id}
              </Chip>
            ))}
          </div>
        </aside>
      </div>
    </Page>
  );
}

/* ------------------------------------------------------------- citations */

/** Every object the tutor touched becomes a traceable link into the contract. */
function citations(parts: ToolPartShape[]) {
  const out: Array<{ href: string; title: string }> = [];
  for (const p of parts) {
    if (!p.type?.startsWith("tool-") || p.state !== "output-available") continue;
    const name = p.type.replace("tool-", "");
    const data = (p.output ?? {}) as Record<string, unknown>;
    if (name === "show_adr" && data["decision"]) {
      const d = data["decision"] as Decision;
      out.push({ href: `/#adr-${d.id}`, title: `ADR ${d.id} — ${d.title}` });
    }
    if (name === "explain_concept" && data["concept"]) {
      const c = data["concept"] as { id: string; title: string };
      out.push({ href: `/#concept-${c.id}`, title: `Concept ${c.id} — ${c.title}` });
    }
    if (name === "build_experience") out.push({ href: "/#op-post-experiences", title: "POST /experiences" });
    if (name === "get_learner_state") out.push({ href: "/#op-get-learner", title: "GET /learner" });
    if (name === "assess_evidence") out.push({ href: "/#op-post-evidence", title: "POST /evidence" });
  }
  return out.filter((v, i, a) => a.findIndex((x) => x.href === v.href) === i);
}

function CopyAction({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <MessageAction label="Copy" tooltip="Copy the answer">
      <button
        type="button"
        aria-label="Copy answer"
        onClick={() => {
          void navigator.clipboard.writeText(text);
          setCopied(true);
          toast.success("Answer copied");
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
      </button>
    </MessageAction>
  );
}

/* --------------------------------------------------- inline generative UI */

function ToolPart({
  name,
  state,
  input,
  output,
  onInspect,
}: {
  name: string;
  state: string;
  input?: unknown;
  output?: unknown;
  onInspect: (f: { kind: "concept" | "decision" | "component"; id: string; label?: string }) => void;
}) {
  if (state !== "output-available" || !output) {
    return (
      <Tool defaultOpen={false}>
        <ToolHeader type={`tool-${name}` as `tool-${string}`} state={state as never} />
        <ToolContent>
          <ToolInput input={input} />
        </ToolContent>
      </Tool>
    );
  }
  const data = output as Record<string, unknown>;

  if (name === "build_experience" && data["component"]) {
    const c = data["component"] as { html: string; label: string };
    return (
      <div className="space-y-2 rounded-md border border-border p-2">
        <div className="flex items-center gap-2">
          <Chip active>experience</Chip>
          <span className="label-caps text-muted-foreground">{c.label}</span>
          <Chip onClick={() => onInspect({ kind: "component", id: c.label, label: c.label })}>inspect</Chip>
        </div>
        <p className="text-body-sm">{String(data["narration"] ?? "")}</p>
        <BootstrapFrame html={c.html} />
        {data["php"] ? <Json value={data["php"]} className="max-h-64" /> : null}
        {data["sql"] ? <Json value={data["sql"]} className="max-h-48" /> : null}
        <div className="flex flex-wrap gap-1">
          {(data["affordances"] as string[] | undefined)?.map((a) => (
            <Chip key={a}>{a}</Chip>
          ))}
        </div>
      </div>
    );
  }

  if (name === "show_adr" && data["decision"]) {
    const d = data["decision"] as Decision;
    return (
      <div className="rounded-md border border-border">
        <AdrView decision={d} />
        <div className="flex gap-1 border-t border-border p-2">
          <Chip onClick={() => onInspect({ kind: "decision", id: d.id, label: d.title })}>keep in focus</Chip>
        </div>
      </div>
    );
  }

  if (name === "explain_concept" && data["concept"]) {
    const c = data["concept"] as {
      id: string;
      title: string;
      summary: string;
      vocabulary?: string[];
      common_errors?: string[];
      code_example?: string;
    };
    return (
      <div className="space-y-2 rounded-md border border-border p-2">
        <div className="flex items-center gap-2">
          <Chip active>concept</Chip>
          <span className="label-caps text-primary">{c.id}</span>
          <Chip onClick={() => onInspect({ kind: "concept", id: c.id, label: c.title })}>keep in focus</Chip>
        </div>
        <h4>{c.title}</h4>
        <p className="text-body-sm text-muted-foreground">{c.summary}</p>
        {data["narration"] ? <MessageResponse>{String(data["narration"])}</MessageResponse> : null}
        <div className="flex flex-wrap gap-1">{c.vocabulary?.map((v) => <Chip key={v}>{v}</Chip>)}</div>
        {c.code_example ? <Json value={c.code_example} className="max-h-64" /> : null}
        {c.common_errors?.length ? (
          <ul className="list-disc space-y-0.5 pl-5 text-body-sm text-muted-foreground">
            {c.common_errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  if (name === "list_concepts" && Array.isArray(output)) {
    return (
      <div className="flex flex-wrap gap-1 rounded-md border border-border p-2">
        {(output as Array<{ id: string; title: string; summary: string }>).map((c) => (
          <Chip key={c.id} title={c.summary} onClick={() => onInspect({ kind: "concept", id: c.id, label: c.title })}>
            {c.title}
          </Chip>
        ))}
      </div>
    );
  }

  if (name === "assess_evidence" || name === "get_learner_state") {
    return (
      <Tool defaultOpen>
        <ToolHeader type={`tool-${name}` as `tool-${string}`} state="output-available" />
        <ToolContent>
          <ToolInput input={input} />
          <ToolOutput output={<Json value={output} className="max-h-64" />} errorText={undefined} />
        </ToolContent>
      </Tool>
    );
  }

  return <Json value={output} className="max-h-64" />;
}

export { seed };
