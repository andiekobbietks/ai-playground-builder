/**
 * Typed access to the generated artefacts.
 *
 * Nothing here re-declares the domain: every type is derived from the JSON
 * that `python -m lampforge.generate` emits from the Pydantic models.
 */
import openapiJson from "@/generated/openapi.json";
import schemasJson from "@/generated/schemas.json";
import seedJson from "@/generated/seed.json";
import toolsJson from "@/generated/tools.json";

export const seed = seedJson;
export const openapi = openapiJson as OpenApiDoc;
export const schemas = schemasJson as Record<string, JsonSchema>;
export const mcpTools = toolsJson as McpToolDescriptor[];

export type Seed = typeof seedJson;
export type Concept = Seed["concepts"][number];
export type Decision = Seed["decisions"][number];
export type Evidence = Seed["evidence"][number];
export type UIComponent = Seed["components"][number];
export type LearnerState = Seed["learner"];
export type Task = Seed["tasks"][number];
export type Project = Seed["projects"][number];
export type PedagogyMode = "i_do" | "we_do" | "you_do";

export type JsonSchema = {
  title?: string;
  type?: string;
  description?: string;
  properties?: Record<string, JsonSchema & { anyOf?: JsonSchema[]; $ref?: string }>;
  required?: string[];
  items?: JsonSchema;
  enum?: string[];
  $ref?: string;
  anyOf?: JsonSchema[];
  default?: unknown;
  $defs?: Record<string, JsonSchema>;
};

export type OpenApiOperation = {
  operationId: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Array<{
    name: string;
    in: string;
    required?: boolean;
    description?: string;
    schema?: JsonSchema;
  }>;
  requestBody?: {
    required?: boolean;
    content: Record<string, { schema: JsonSchema }>;
  };
  responses: Record<string, { description?: string; content?: Record<string, { schema: JsonSchema }> }>;
};

export type OpenApiDoc = {
  openapi: string;
  info: { title: string; version: string; description?: string };
  paths: Record<string, Record<string, OpenApiOperation>>;
  components?: { schemas?: Record<string, JsonSchema> };
};

export type McpToolDescriptor = {
  name: string;
  title: string;
  description: string;
  readOnly: boolean;
  inputSchema: JsonSchema;
};

export type OperationEntry = {
  method: string;
  path: string;
  op: OpenApiOperation;
  tag: string;
};

export const operations: OperationEntry[] = Object.entries(openapi.paths).flatMap(([path, methods]) =>
  Object.entries(methods).map(([method, op]) => ({
    method: method.toUpperCase(),
    path,
    op,
    tag: op.tags?.[0] ?? "other",
  })),
);

export const tags = Array.from(new Set(operations.map((o) => o.tag)));

export const MODE_LABEL: Record<PedagogyMode, string> = {
  i_do: "I DO",
  we_do: "WE DO",
  you_do: "YOU DO",
};

export const MODE_BLURB: Record<PedagogyMode, string> = {
  i_do: "The runtime models the move and narrates every decision.",
  we_do: "Co-construction: it starts, you decide the next step.",
  you_do: "You lead. It holds the criteria and answers questions only.",
};

export function conceptById(id: string): Concept | undefined {
  return seed.concepts.find((c) => c.id === id);
}

export function decisionById(id: string): Decision | undefined {
  return seed.decisions.find((d) => d.id === id);
}

export function evidenceFor(decisionId: string): Evidence[] {
  return seed.evidence.filter((e) => e.decision_id === decisionId);
}

export function decisionsForConcept(conceptId: string): Decision[] {
  return seed.decisions.filter((d) => d.concept_ids.includes(conceptId));
}

/** Resolve a `$ref` against the generated component schemas. */
export function resolveRef(ref: string, doc: OpenApiDoc = openapi): JsonSchema | undefined {
  const name = ref.split("/").pop();
  if (!name) return undefined;
  return doc.components?.schemas?.[name];
}
