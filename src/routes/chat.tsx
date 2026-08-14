import { useChat } from "@ai-sdk/react";
import { createFileRoute } from "@tanstack/react-router";
import { DefaultChatTransport } from "ai";
import { useMemo, useState } from "react";

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
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { MODE_BLURB, conceptById, seed, type Decision, type PedagogyMode } from "@/lib/lampforge";
import { useStore } from "@/lib/store";

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

const STARTERS = [
  "Explain prepared statements the way you'd teach them.",
  "Build me a booking form with validation.",
  "Why did we normalise the bookings table? Show the ADR.",
  "Assess this: I used mysqli_real_escape_string to stop injection.",
];

function ChatSurface() {
  const [store, setStore] = useStore();
  const mode = store.learner.mode as PedagogyMode;
  const [input, setInput] = useState("");

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages }) => ({ body: { messages, mode } }),
      }),
    [mode],
  );

  const { messages, sendMessage, status, error } = useChat({ transport });
  const busy = status === "submitted" || status === "streaming";

  function send(text: string) {
    if (!text.trim()) return;
    void sendMessage({ text });
    setInput("");
  }

  return (
    <Page>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-h-0 flex-col">
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2">
            <ModeSwitch
              mode={mode}
              onChange={(m) => setStore((s) => ({ learner: { ...s.learner, mode: m } }))}
            />
            <p className="text-xs text-muted-foreground">{MODE_BLURB[mode]}</p>
          </div>

          <Conversation className="min-h-0 flex-1">
            <ConversationContent>
              {messages.length === 0 ? (
                <div className="space-y-3 p-2">
                  <h1 className="text-lg font-semibold">Ask, and it teaches at your level.</h1>
                  <p className="max-w-prose text-sm text-muted-foreground">
                    Every answer can arrive as an object you can inspect: a live Bootstrap component, an ADR, a concept
                    card, an assessment. Ask why it works, trace it to the code, trace it to the decision.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {STARTERS.map((s) => (
                      <Chip key={s} onClick={() => send(s)}>
                        {s}
                      </Chip>
                    ))}
                  </div>
                </div>
              ) : null}

              {messages.map((m) => (
                <Message from={m.role} key={m.id}>
                  <MessageContent>
                    {m.parts.map((part, i) => {
                      const key = `${m.id}-${i}`;
                      if (part.type === "text") return <p key={key} className="whitespace-pre-wrap">{part.text}</p>;
                      if (part.type === "reasoning")
                        return (
                          <details key={key} className="rounded-md border border-border/60 text-xs">
                            <summary className="cursor-pointer px-2 py-1 font-mono text-[11px] text-muted-foreground">
                              teaching move
                            </summary>
                            <p className="whitespace-pre-wrap p-2 text-muted-foreground">{part.text}</p>
                          </details>
                        );
                      if (part.type.startsWith("tool-")) {
                        const tp = part as unknown as { type: string; state: string; output?: unknown; input?: unknown };
                        return <ToolPart key={key} name={tp.type.replace("tool-", "")} state={tp.state} output={tp.output} />;
                      }
                      return null;
                    })}
                  </MessageContent>
                </Message>
              ))}

              {busy ? <Shimmer className="px-2 text-sm">thinking about how much to hand over…</Shimmer> : null}
              {error ? (
                <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
                  {error.message}
                </p>
              ) : null}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <div className="border-t border-border p-3">
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
              <PromptInputToolbar>
                <span className="px-2 font-mono text-[11px] text-muted-foreground">
                  tools: explain · build · adr · assess · learner
                </span>
                <PromptInputSubmit status={status} disabled={!input.trim() && !busy} />
              </PromptInputToolbar>
            </PromptInput>
          </div>
        </div>

        <aside className="min-h-0 overflow-auto border-t border-border lg:border-l lg:border-t-0">
          <SectionTitle>learner model</SectionTitle>
          <dl className="grid grid-cols-2 gap-x-2 gap-y-1 p-3 font-mono text-[11px]">
            {(
              [
                ["accuracy", `${Math.round(store.learner.accuracy * 100)}%`],
                ["median response", `${store.learner.median_response_ms}ms`],
                ["retries", store.learner.retries],
                ["hints", store.learner.hint_requests],
                ["idle", `${store.learner.idle_seconds}s`],
                ["retrievals", `${store.learner.successful_retrievals}/${store.learner.successful_retrievals + store.learner.failed_retrievals}`],
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

/* --------------------------------------------------- inline generative UI */

function ToolPart({ name, state, output }: { name: string; state: string; output?: unknown }) {
  if (state !== "output-available" || !output) {
    return (
      <div className="rounded-md border border-border/60 px-2 py-1 font-mono text-[11px] text-muted-foreground">
        {name} · {state}
      </div>
    );
  }
  const data = output as Record<string, unknown>;

  if (name === "build_experience" && data["component"]) {
    const c = data["component"] as { html: string; label: string };
    return (
      <div className="space-y-2 rounded-md border border-border p-2">
        <div className="flex items-center gap-2">
          <Chip active>experience</Chip>
          <span className="font-mono text-[11px] text-muted-foreground">{c.label}</span>
        </div>
        <p className="text-sm">{String(data["narration"] ?? "")}</p>
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
    return (
      <div className="rounded-md border border-border">
        <AdrView decision={data["decision"] as Decision} />
      </div>
    );
  }

  if (name === "explain_concept" && data["concept"]) {
    const c = data["concept"] as { id: string; title: string; summary: string; vocabulary?: string[]; common_errors?: string[]; code_example?: string };
    return (
      <div className="space-y-2 rounded-md border border-border p-2">
        <div className="flex items-center gap-2">
          <Chip active>concept</Chip>
          <span className="font-mono text-[11px] text-primary">{c.id}</span>
        </div>
        <h4 className="text-sm font-semibold">{c.title}</h4>
        <p className="text-sm text-muted-foreground">{c.summary}</p>
        {data["narration"] ? <p className="text-sm">{String(data["narration"])}</p> : null}
        <div className="flex flex-wrap gap-1">{c.vocabulary?.map((v) => <Chip key={v}>{v}</Chip>)}</div>
        {c.code_example ? <Json value={c.code_example} className="max-h-64" /> : null}
        {c.common_errors?.length ? (
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
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
          <Chip key={c.id} title={c.summary}>
            {c.title}
          </Chip>
        ))}
      </div>
    );
  }

  if (name === "assess_evidence") {
    return (
      <div className="space-y-1 rounded-md border border-border p-2">
        <Chip active>assessment</Chip>
        <Json value={output} className="max-h-64" />
      </div>
    );
  }

  if (name === "get_learner_state") {
    return (
      <div className="space-y-1 rounded-md border border-border p-2">
        <Chip active>learner state</Chip>
        <Json value={output} className="max-h-56" />
      </div>
    );
  }

  return <Json value={output} className="max-h-64" />;
}

export { seed };
