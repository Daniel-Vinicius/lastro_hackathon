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
npm run db:push   # push Drizzle schema to Neon (needs NEON_POSTGRES_CONNECTION_STRING)
npm run db:reset  # wipe all Neon tables (no repopulate) — run before a clean re-scrape
npm run db:studio # open Drizzle Studio
npm run scrape:cnm  # scrape real Chaves na Mão leads → upsert into Neon
npm run scrape:spi  # scrape real SP Imóvel leads → upsert into Neon
npm run ingest:olx  # ingest data/olx-mock.json (the ONLY non-real data) into Neon
npm run export:leads # snapshot the honest DB → data/leads.json (offline fallback)
```

**Honest-data invariant:** the only non-real data in the system lives in
`data/olx-mock.json` (OLX blocks scraping). The real scrapers never fabricate
owner/phone/price-history/pulverização — they store only what the portal exposes.
Populate the DB with: `db:reset` → `scrape:cnm` → `scrape:spi` → `ingest:olx`.

There is no test runner — `lib/` is validated by inspection. Type-check via
`npx tsc --noEmit` (strict mode is on).

## Environment

- `ANTHROPIC_API_KEY` in `.env.local` enables the real Claude briefing.
  **Without it the app still works** — `gerarBriefing` falls back to a
  deterministic briefing (`fonte: "fallback"`). Never make the demo hard-depend
  on the API.
- `CLAUDE_MODEL` overrides the model (default `claude-haiku-4-5`; e.g. set
  `claude-opus-4-8` for higher quality).
- `NEON_POSTGRES_CONNECTION_STRING` — Neon Postgres connection string. Without it,
  `lib/data.ts` falls back to `data/leads.json`. Key name is exactly this — not `DATABASE_URL`.

## Architecture

The business logic lives in `lib/` and is the stable foundation; the data file,
API routes, and UI are built on top of it.

- **`lib/types.ts`** — domain contracts. `Lead` is the raw record;
  `LeadComScore = Lead & { avaliacao: ResultadoScore }` is what the search API
  returns. `data/leads.json` holds `Lead[]` **without** scores — scores are
  computed at read time, never stored. `Lead.fonte` is `"sintetico" | "chavesnamao-real" | "spimovel-real"`.
  `FiltrosBusca.bairros` is `string[]` (multi-select), not a single string.
  `Cortes` holds `{ morno, quente }` score thresholds (editable on the Critérios page).
- **`lib/score.ts`** — `avaliarLead(lead)` produces a **deterministic, explainable**
  0–100 captability score. Critically, the score does *not* come from the LLM (it
  must be stable for the demo); Claude only explains the *why*. Four weighted
  signals sum to 100: days listed (30), price reductions (25), gap vs. market
  price (25), portal spread / "pulverização" (20). Each signal carries a
  human-readable `detalhe` ready for the UI. Tiers: `quente` ≥66, `morno` ≥40,
  else `frio`. Exports `PESOS`, `CORTES_PADRAO`, `contarReducoes`, `gapPreco`.
- **`lib/data.ts`** — reads `data/leads.json` once (module-level cache), filters
  live by `FiltrosBusca`, and returns leads sorted by score. `buscarLeads`,
  `buscarLeadPorId`, `facetas()`. Filtering is accent/case-insensitive (`norm`).
  Touches `fs` → any route using it must run on the Node runtime, not Edge.
  Future: will query Neon when `NEON_POSTGRES_CONNECTION_STRING` is set.
- **`lib/anthropic.ts`** — `gerarBriefing(lead)` calls Claude via
  `client.messages.parse()` with `zodOutputFormat(BriefingSchema)` for structured
  output (`BriefingCaptacao`: porQueAgora / comoAbordar / mensagemSugerida /
  objecaoProvavel). In-memory cache keyed by `lead.id` (avoids redundant API calls
  within a server process). Returns `{ briefing, fonte }` where `fonte` is
  `"claude"` or `"fallback"`. The `mensagemSugerida` is LGPD-aware by design
  (cites the public listing, offers an easy opt-out).
- **`lib/format.ts`** — UI helpers: `brl`, `area`, `tipoLabel`, `tierLabel`,
  `tierBadge`, `tierRail`, `intensidadeBar`, `linkWhatsApp` (builds WhatsApp
  deeplink `https://wa.me/55<digits>?text=<encoded>`).
- **`lib/useCortes.ts`** — React hook that reads/writes tier cut-off thresholds
  from `localStorage` (key `radar.cortes`). Used by Tela A and the Critérios page
  to re-bucket leads client-side without a server round-trip.
- **`lib/db/schema.ts`** — Drizzle schema for Neon: `properties`, `listings`,
  `price_observations`, `lead_status`. Not yet wired into `lib/data.ts` (Sessão 2).
- **`lib/db/index.ts`** — Neon serverless client. Exports `db` (null when env
  absent) and `hasDb`. All callers must guard on `hasDb`.

### Scripts

- **`scripts/scrape-chavesnamao.mjs`** — fetches real listings from Chaves na Mão
  (JSON-LD `application/ld+json`), reads real `datePosted`, and upserts into Neon via
  `lib/db/ingest`. No fabricated owner/phone/price-history.
- **`scripts/scrape-spimovel.mjs`** — same for SP Imóvel (SP-only); no `datePosted`,
  so `firstSeen = now` (T0).
- **`scripts/ingest-olx-mock.mjs`** — ingests `data/olx-mock.json` (the only non-real
  data) into Neon; 3 entries bridge onto real CNM/SP properties via fingerprint to
  reveal owner contact, 2 are isolated FSBOs.
- **`scripts/reset-db.mjs`** — wipes all tables (no repopulate); run before a clean
  re-scrape.
- **`scripts/_scrape-utils.mjs`** — shared real-only helpers: `fetchHtml`,
  `parseLdJson`, `pm2PorBairro`, `median`, `TIPOS_VALIDOS`, `sleep`, `UA`.

### Conventions

- Path alias `@/*` maps to the repo root (e.g. `import { buscarLeads } from "@/lib/data"`).
- Route handlers that use `lib/data` or the Anthropic SDK need
  `export const runtime = "nodejs"`.
- Domain identifiers and user-facing copy are Portuguese; keep that consistent.

## Current state

**Sessão 1 (Blocos A–D) completa. App roda end-to-end.**

- **`lib/`** complete: `types.ts`, `score.ts`, `data.ts`, `anthropic.ts`,
  `format.ts`, `useCortes.ts`, `db/schema.ts`, `db/index.ts`.
- **Neon DB** populated by the real scrapers (`chavesnamao-real` / `spimovel-real`,
  no fabricated fields) + `data/olx-mock.json` (`olx-mock`, the only non-real data).
- **`data/leads.json`** is the offline fallback, regenerated from the honest DB via
  `npm run export:leads` — it mirrors the DB (only `olx-mock` carries non-real data).
  Re-run `export:leads` after repopulating the DB to keep the fallback in sync.
- **`scripts/`**: `scrape-chavesnamao.mjs`, `scrape-spimovel.mjs`,
  `ingest-olx-mock.mjs`, `reset-db.mjs`, `export-leads.mjs`, `_scrape-utils.mjs`.
- **API** (`app/api/`): `GET /search`, `GET /lead/[id]`, `POST /briefing`.
- **Tela A** (`app/page.tsx` + `RadarShell`/`FiltroForm`/`ListaLeads`/`LeadCard`/
  `ScoreBadge`): filtros multi-bairro + fila priorizada + barra de métricas.
- **Tela B** (`app/lead/[id]/page.tsx` + `BreakdownSinais`/`BriefingPanel`/
  `GraficoPreco`): ficha completa + briefing IA + botão WhatsApp deeplink.
- **Tela D** (`app/criterios/page.tsx` + `CriteriosPanel`): sinais/pesos read-only +
  cortes editáveis com preview de distribuição ao vivo (persiste em `localStorage`).
- **`drizzle.config.ts`** present; `lib/db/` schema defined but `lib/data.ts` still
  reads from JSON — Neon integration is **Sessão 2 (Bloco F)**.

**Sessão 2 (Blocos F–H) — NÃO iniciada:**
- `lib/data.ts` lendo do Neon (Bloco F)
- Scrapers com upsert/dedup no banco (Bloco G)
- `data/olx-mock.json` + `scripts/ingest-olx-mock.mjs` (Bloco G)
- Rotas e UI de lead status — contatado/negociando/descartado (Bloco H)
