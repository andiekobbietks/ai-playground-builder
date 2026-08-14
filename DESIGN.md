---
version: alpha
name: LAMPForge Workbench
description: >-
  The visual identity of LAMPForge — a pedagogical runtime for WJEC Unit 4 LAMP
  projects. One dark technical workbench shared by four surfaces: the Swagger
  playground, the MCP Inspector, the PDE and the pedagogical chat.
colors:
  background: "oklch(0.158 0.007 258.4)"
  surface: "oklch(0.195 0.011 260.7)"
  surface-raised: "oklch(0.221 0.013 258.4)"
  border: "oklch(0.288 0.016 259.8)"
  input: "oklch(0.243 0.015 261.7)"
  primary: "oklch(0.785 0.129 63.9)"
  on-primary: "oklch(0.189 0.026 77.5)"
  secondary: "oklch(0.701 0.102 236.9)"
  tertiary: "oklch(0.638 0.176 32.7)"
  foreground: "oklch(0.936 0.005 258.3)"
  muted-foreground: "oklch(0.703 0.023 259.2)"
  mode-i-do: "oklch(0.785 0.129 63.9)"
  mode-we-do: "oklch(0.745 0.127 169.9)"
  mode-you-do: "oklch(0.782 0.170 123.4)"
  method-get: "oklch(0.701 0.102 236.9)"
  method-post: "oklch(0.785 0.129 63.9)"
  destructive: "oklch(0.638 0.176 32.7)"
  success: "oklch(0.745 0.127 169.9)"
typography:
  h1:
    fontFamily: IBM Plex Sans
    fontSize: 1.75rem
    fontWeight: 600
    lineHeight: 2.125rem
    letterSpacing: -0.02em
  h2:
    fontFamily: IBM Plex Sans
    fontSize: 1.125rem
    fontWeight: 600
    lineHeight: 1.625rem
    letterSpacing: -0.01em
  body-md:
    fontFamily: IBM Plex Sans
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.375rem
  body-sm:
    fontFamily: IBM Plex Sans
    fontSize: 0.8125rem
    fontWeight: 400
    lineHeight: 1.25rem
  code:
    fontFamily: JetBrains Mono
    fontSize: 0.6875rem
    fontWeight: 400
    lineHeight: 1.125rem
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 0.6875rem
    fontWeight: 600
    lineHeight: 1rem
    letterSpacing: 0.12em
rounded:
  sm: 4px
  md: 6px
  lg: 10px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
components:
  app-shell:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.body-md}"
  rail:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.label-caps}"
    height: 48px
  rail-item-active:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 8px
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: 12px
  panel-header:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.label-caps}"
    padding: 8px
  code-surface:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.foreground}"
    typography: "{typography.code}"
    rounded: "{rounded.md}"
    padding: 12px
  input-field:
    backgroundColor: "{colors.input}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: 8px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.md}"
    padding: 8px
  button-primary-hover:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.md}"
    padding: 8px
  divider:
    backgroundColor: "{colors.border}"
    textColor: "{colors.muted-foreground}"
    height: 1px
  method-badge-get:
    backgroundColor: "{colors.background}"
    textColor: "{colors.method-get}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.sm}"
  method-badge-post:
    backgroundColor: "{colors.background}"
    textColor: "{colors.method-post}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.sm}"
  mode-badge-i-do:
    backgroundColor: "{colors.background}"
    textColor: "{colors.mode-i-do}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.sm}"
  mode-badge-we-do:
    backgroundColor: "{colors.background}"
    textColor: "{colors.mode-we-do}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.sm}"
  mode-badge-you-do:
    backgroundColor: "{colors.background}"
    textColor: "{colors.mode-you-do}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.sm}"
  status-error:
    backgroundColor: "{colors.background}"
    textColor: "{colors.destructive}"
    typography: "{typography.code}"
  status-ok:
    backgroundColor: "{colors.background}"
    textColor: "{colors.success}"
    typography: "{typography.code}"
  link-inline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
    typography: "{typography.body-sm}"
  card-adr:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: 16px
  input-border:
    backgroundColor: "{colors.input}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
  surface-tertiary-accent:
    backgroundColor: "{colors.background}"
    textColor: "{colors.tertiary}"
    typography: "{typography.body-sm}"
---

## Overview

LAMPForge is a **workbench**, not a landing page. Every screen is an instrument
panel over a single canonical model: Pydantic classes in `python/lampforge/`
projected into `openapi.json`, `schemas.json`, `seed.json` and `tools.json`.
The UI should feel like a piece of engineering equipment that happens to teach:
dense, dark, monospaced where it is machine truth, proportional where it is
human explanation.

Three rules govern every surface:

1. **Machine truth is monospaced.** Anything that came from the contract —
   paths, schema keys, JSON, tool names, SQL, PHP, file paths — is set in
   JetBrains Mono. Anything authored for a human — narration, rationale,
   ADR prose — is IBM Plex Sans.
2. **Panels, not pages.** Content lives in bordered panels with a caps label
   header. Panels tile; they do not stack into a marketing rhythm.
3. **Colour carries meaning, never decoration.** Amber is the product and the
   active state, blue is a read, teal is success/co-construction, lime is
   learner autonomy, clay is a write/destructive/consequence. No gradients,
   no purple, no glow.

## Colors

The palette is a near-neutral blue-black stack with one warm accent — a forge
lit in a dark workshop.

- **background (`oklch(0.158 0.007 258.4)`):** The workshop floor. The only
  full-bleed colour.
- **surface / surface-raised:** Panel body and panel header/code wells. The
  two-step lift replaces shadow; elevation is expressed by value, not blur.
- **border:** A single hairline value used for every division. There is one
  border colour in the system.
- **primary (amber):** The forge. Product mark, active rail item, primary
  button, `POST` verbs, and the `I DO` mode. It is the only colour allowed on
  a filled button.
- **secondary (blue):** Reads — `GET` verbs, inline links, references into the
  contract.
- **tertiary (clay):** Consequence — destructive actions, failed assertions,
  ADR "Consequences" markers.
- **mode-i-do / mode-we-do / mode-you-do:** The gradual-release triad. These
  three are reserved; never reuse them for generic accents.
- **foreground / muted-foreground:** Body text and secondary metadata. There
  is no third text tone.

## Typography

Two families, six roles. `IBM Plex Sans` for prose, `JetBrains Mono` for
machine truth. `label-caps` (mono, 0.12em tracking, uppercase) is the header
voice of every panel — it is what makes the app read as instrumentation.
Headings never exceed `h1` (1.75rem); this is an application, not a document.

## Layout

A 48px top rail, then a full-height tiled workspace. Spacing steps are
`4 / 8 / 12 / 16 / 24`; nothing between panels exceeds `xl`. Panels own their
own scroll, the page never does. Two- and three-column splits are the default;
single-column is only for the ADR reading view.

## Shapes

Radii are small and consistent: `sm` for badges and chips, `md` for controls
and code wells, `lg` for panels. Nothing is fully rounded — no pills, no
circular avatars other than the 8px status dot.

## Components

Panels are `panel` + `panel-header`. Controls are `button-primary` (one per
panel, at most), `button-ghost` for everything else, `input-field` for text
entry. JSON, code, SQL and terminal output all use `code-surface`. Verb and
mode badges are the two badge families and share `label-caps` at `rounded.sm`.

## Do's and Don'ts

- **Do** put a `label-caps` header on every panel.
- **Do** use mono for any string that also exists in the generated contract.
- **Do** express state with the reserved mode colours.
- **Don't** hardcode a colour in a component — every value is a token exposed
  as a Tailwind utility (`bg-surface`, `text-mode-we-do`).
- **Don't** introduce a second accent, a gradient, a shadow, or a purple.
- **Don't** use sans-serif for JSON or mono for narration.
