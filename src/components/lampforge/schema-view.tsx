import { useState } from "react";

import { resolveRef, schemas, type JsonSchema } from "@/lib/lampforge";
import { cn } from "@/lib/utils";

function typeOf(s: JsonSchema): string {
  if (s.$ref) return s.$ref.split("/").pop() ?? "ref";
  if (s.enum) return s.enum.map((e) => `"${e}"`).join(" | ");
  if (s.anyOf) return s.anyOf.map(typeOf).filter((t) => t !== "null").join(" | ") + " | null";
  if (s.type === "array") return `${s.items ? typeOf(s.items) : "any"}[]`;
  return s.type ?? "any";
}

/** Recursive JSON Schema explorer — the Pydantic model, as the runtime sees it. */
export function SchemaView({
  schema,
  depth = 0,
  onSelectModel,
}: {
  schema: JsonSchema;
  depth?: number;
  onSelectModel?: (name: string) => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const props = schema.properties ?? {};
  const required = new Set(schema.required ?? []);

  if (!Object.keys(props).length) {
    return <div className="font-mono text-[11px] text-muted-foreground">{typeOf(schema)}</div>;
  }

  return (
    <ul className={cn("space-y-1", depth > 0 && "ml-3 border-l border-border pl-3")}>
      {Object.entries(props).map(([name, prop]) => {
        const refName = prop.$ref?.split("/").pop() ?? prop.items?.$ref?.split("/").pop();
        const nested = refName ? (schema.$defs?.[refName] ?? resolveRef(`#/$defs/${refName}`) ?? schemas[refName]) : undefined;
        const isOpen = open[name];
        return (
          <li key={name} className="font-mono text-[11px]">
            <div className="flex flex-wrap items-baseline gap-2">
              <button
                type="button"
                disabled={!nested}
                onClick={() => setOpen((o) => ({ ...o, [name]: !o[name] }))}
                className={cn("text-foreground", nested && "underline decoration-dotted underline-offset-2")}
              >
                {name}
                {required.has(name) ? <span className="text-destructive">*</span> : null}
              </button>
              <span className="text-primary/80">{typeOf(prop)}</span>
              {refName && onSelectModel ? (
                <button
                  type="button"
                  onClick={() => onSelectModel(refName)}
                  className="text-muted-foreground hover:text-primary"
                >
                  ↗ model
                </button>
              ) : null}
            </div>
            {prop.description ? (
              <p className="mt-0.5 max-w-prose font-sans text-[11px] leading-snug text-muted-foreground">
                {prop.description}
              </p>
            ) : null}
            {nested && isOpen ? <SchemaView schema={nested} depth={depth + 1} onSelectModel={onSelectModel} /> : null}
          </li>
        );
      })}
    </ul>
  );
}
