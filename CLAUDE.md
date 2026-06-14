# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> **Next.js 16.2.9** — this version has breaking changes vs. older releases. APIs,
> conventions, and file structure may differ from training data. Check
> `node_modules/next/dist/docs/` before writing App Router / route-handler code.

## What this is

**Radar de Captação** — a hackathon prototype (Lastro) for a panel that helps a
real-estate agency find owners selling property *themselves* (FSBO / "particular")
on listing portals, ranks them by how likely they are to accept agency
representation (an explainable "captability" score), and uses Claude to generate a
per-lead **approach briefing** for the agent. The AI never talks to the owner — it
arms the agent.

`ROADMAP.md` is the source of truth for scope, locked decisions, and build phases.
**Read it before planning any feature.** Everything (UI text, domain) is in
Brazilian Portuguese.

## Commands

```bash
npm run dev      # dev server at http://localhost:3000
npm run build    # production build
npm run start    # serve production build
npm run lint     # eslint (flat config, next/core-web-vitals + typescript)
```

There is no test runner — `lib/` is validated by inspection. Type-check via
`npx tsc --noEmit` (strict mode is on).

## Environment

- `ANTHROPIC_API_KEY` in `.env.local` enables the real Claude briefing.
  **Without it the app still works** — `gerarBriefing` falls back to a
  deterministic briefing (`fonte: "fallback"`). Never make the demo hard-depend
  on the API.
- `CLAUDE_MODEL` overrides the model (default `claude-opus-4-8`; e.g. set
  `claude-haiku-4-5` for faster/cheaper demo runs).

## Architecture

The business logic lives in `lib/` and is the stable foundation; the data file,
API routes, and UI are built on top of it.

- **`lib/types.ts`** — domain contracts. `Lead` is the raw record;
  `LeadComScore = Lead & { avaliacao: ResultadoScore }` is what the search API
  returns. `data/leads.json` holds `Lead[]` **without** scores — scores are
  computed at read time, never stored.
- **`lib/score.ts`** — `avaliarLead(lead)` produces a **deterministic, explainable**
  0–100 captability score. Critically, the score does *not* come from the LLM (it
  must be stable for the demo); Claude only explains the *why*. Four weighted
  signals sum to 100: days listed (30), price reductions (25), gap vs. market
  price (25), portal spread / "pulverização" (20). Each signal carries a
  human-readable `detalhe` ready for the UI. Tiers: `quente` ≥66, `morno` ≥40,
  else `frio`.
- **`lib/data.ts`** — reads `data/leads.json` once (module-level cache), filters
  live by `FiltrosBusca`, and returns leads sorted by score. `buscarLeads`,
  `buscarLeadPorId`, `facetas()`. Filtering is accent/case-insensitive (`norm`).
  Touches `fs` → any route using it must run on the Node runtime, not Edge.
- **`lib/anthropic.ts`** — `gerarBriefing(lead)` calls Claude via
  `client.messages.parse()` with `zodOutputFormat(BriefingSchema)` for structured
  output (`BriefingCaptacao`: porQueAgora / comoAbordar / mensagemSugerida /
  objecaoProvavel). Returns `{ briefing, fonte }` where `fonte` is `"claude"` or
  `"fallback"`. The `mensagemSugerida` is LGPD-aware by design (cites the public
  listing, offers an easy opt-out).

### Conventions

- Path alias `@/*` maps to the repo root (e.g. `import { buscarLeads } from "@/lib/data"`).
- Route handlers that use `lib/data` or the Anthropic SDK need
  `export const runtime = "nodejs"`.
- Domain identifiers and user-facing copy are Portuguese; keep that consistent.

## Current state (as of init)

`lib/` is complete. **Not yet built:** `data/leads.json`, `scripts/gen-data.mjs`,
`app/api/` routes, and the real UI (`app/page.tsx` is still the create-next-app
default). The app does not yet run end-to-end. See ROADMAP phases 1–4 for the
critical path (data → API → Radar list → lead detail).
