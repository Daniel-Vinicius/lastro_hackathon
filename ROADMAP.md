# Radar de Captação — Roadmap

> **Como usar este arquivo:** cada **Fase** abaixo é autocontida. Em uma sessão
> nova do Claude Code: peça o **Plan (Opus)** apontando a fase, depois **execute
> (Sonnet)**. Leia primeiro as seções _Visão_, _Decisões travadas_ e _Estado
> atual_ — elas dão o contexto que toda fase assume.

---

## Visão

**Produto:** "Radar de Captação" — um painel **para o corretor/imobiliária** que
encontra proprietários anunciando o imóvel **sozinhos** ("particular"/FSBO) nos
portais, **prioriza** quem tem maior chance de aceitar colocar com a imobiliária
(score de captabilidade explicável) e gera, via IA, o **briefing de abordagem**
(por que abordar agora, qual alavanca puxar, mensagem de WhatsApp pronta e a
objeção provável).

**Quem usa / quem paga:** a imobiliária. O proprietário é tocado, mas a IA **não
conversa com ele** — ela arma o corretor.

**Pitch (1 frase):** _"A Captei te dá uma lista telefônica de proprietários. O
Radar te dá uma fila priorizada — 'esses são os mais quentes essa semana, e por
quê' — e a IA já escreve a abordagem ancorada em dado."_

**Diferencial:** não é lista plana (Captei) — é **fila priorizada + explicável +
pitch ancorado em dado**. Para a Lastro, é a evolução natural da Lais (que hoje
só "registra a captação pro time concluir").

---

## Decisões travadas (não relitigar)

| Tema | Decisão |
|---|---|
| Público | Descoberta **FSBO** (donos anunciando direto nos portais) |
| Usuário/pagante | Imobiliária/corretor |
| IA | **Claude real** (briefing pro corretor); resto **mockado** |
| IA NÃO faz | Conversar com o dono; CRM/Kanban — ficam como "extra/futuro" |
| Stack | **Next.js full-stack** (App Router, TS) + Tailwind v4 |
| Modelo | `claude-opus-4-8` (default; configurável via env `CLAUDE_MODEL`) |
| Saída estruturada | `messages.parse()` + `zodOutputFormat` |
| Dados | **Scrape-once OLX → cache JSON** + enrich; fallback sintético; **nunca** scrape ao vivo no demo |
| Core inegociável | Lista com score (Tela A) + Ficha com IA "por que abordar" (Tela B) |

---

## Estado atual (✅ já feito — NÃO refazer)

- Projeto **Next.js 16.2.9 + React 19 + Tailwind v4 + TS** scaffoldado na raiz.
- Deps instaladas: `@anthropic-ai/sdk`, `cheerio`, `zod`.
- Camada `lib/` escrita (lógica de negócio, testada só por inspeção):
  - **`lib/types.ts`** — tipos do domínio (ver _Contratos_ abaixo).
  - **`lib/score.ts`** — `avaliarLead(lead): ResultadoScore` (score determinístico
    explicável) + `contarReducoes(lead)`, `gapPreco(lead)`.
  - **`lib/data.ts`** — `buscarLeads(filtros): LeadComScore[]`,
    `buscarLeadPorId(id): LeadComScore | null`, `facetas()`. Lê
    `data/leads.json` e filtra ao vivo.
  - **`lib/anthropic.ts`** — `gerarBriefing(lead): Promise<{briefing, fonte}>`
    (Claude via parse+zod, com fallback determinístico se faltar API key).

**Ainda NÃO existe:** `data/leads.json`, API routes, telas, scraper, `.env.local`.
**O app ainda não roda end-to-end** (falta dado + API + UI).

---

## Contratos (a interface que as fases consomem — fonte da verdade: `lib/types.ts`)

```ts
Lead {
  id; proprietario; telefone; bairro; cidade; uf;
  tipo: "apartamento"|"casa"|"cobertura"|"kitnet"|"sobrado";
  transacao: "venda"|"aluguel";
  area; quartos; vagas;
  precoAtual; historicoPreco: {data,valor}[]; diasNoAnuncio;
  portais: string[]; anunciante: "particular";
  precoEstimadoMercado; fotos: string[];
  fonte: "olx-real"|"sintetico"; anuncioUrl?;
}
ResultadoScore { score:0-100; tier:"frio"|"morno"|"quente"; sinais:SinalScore[]; principaisRazoes:string[] }
LeadComScore = Lead & { avaliacao: ResultadoScore }
BriefingCaptacao { porQueAgora; comoAbordar; mensagemSugerida; objecaoProvavel }
FiltrosBusca { cidade?; bairro?; transacao?; tipo?; precoMin?; precoMax? }
```

> `data/leads.json` = **`Lead[]`** (sem `avaliacao` — o score é calculado em
> tempo de leitura por `avaliarLead`).

---

# FASES

## Fase 1 — Camada de dados (base realista) 🟢 base de tudo
**Objetivo:** existir `data/leads.json` realista para o app ter o que mostrar.

**Construir:**
- `scripts/gen-data.mjs` (Node ESM puro, rodável com `node scripts/gen-data.mjs`)
  que gera **30–50 leads** sintéticos mas **calibrados em dados BR reais** e
  grava em `data/leads.json` conforme o contrato `Lead[]`.
- Calibragem: bairros reais (ex.: SP — Moema, Vila Mariana, Pinheiros, Tatuapé,
  Santana, Itaim); preço/m² plausível por bairro; `historicoPreco` coerente com
  `diasNoAnuncio` e com as reduções; ~54% dos de venda **acima** do mercado;
  alguns com >90 dias e ≥2 reduções (sinais fortes).
- Curar **3–4 "leads-herói"** com história forte (parado há muito + 2 reduções +
  acima do mercado + vários portais) → score alto, ótimos pro demo.
- `proprietario`/`telefone` fake; `fotos` = placeholders (ex.: picsum/unsplash).

**Pronto quando:** `node scripts/gen-data.mjs` gera `data/leads.json` válido e
`buscarLeads()` retorna leads ordenados por score sem erro.

**Mockar:** tudo (dado sintético). O scrape real é a Fase 5.

---

## Fase 2 — API routes (back) 🟢
**Objetivo:** expor a lógica `lib/` via HTTP pro front consumir.

**Construir (App Router, em `app/api/`):**
- `GET /api/search` — lê filtros da query string (`cidade,bairro,transacao,tipo,
  precoMin,precoMax`), chama `buscarLeads(filtros)`, devolve `LeadComScore[]`.
  Inclua também as `facetas()` (cidades/bairros) pra alimentar os selects.
- `GET /api/lead/[id]` — `buscarLeadPorId(id)` → `LeadComScore | null` (404 se nulo).
- `POST /api/briefing` — body `{ id }` → `buscarLeadPorId` + `gerarBriefing(lead)`
  → `{ briefing, fonte }`. **Runtime `nodejs`** (usa `fs` e o SDK — não Edge).

**Pronto quando:** as 3 rotas respondem JSON correto via `curl`/navegador.

**Atenção:** rotas que tocam `fs`/SDK precisam de `export const runtime = "nodejs"`.

---

## Fase 3 — Tela A: Radar (busca + lista) 🟢 core
**Objetivo:** a tela principal — filtros + fila priorizada de leads.

**Construir (`app/page.tsx` + componentes):**
- Formulário de filtros: cidade, bairro, transação (venda/aluguel), tipo, faixa
  de preço. Ao submeter, chama `/api/search`.
- Lista de **cards de lead** ordenados por score, cada um com: bairro/tipo/área,
  preço, **badge de score + tier** (frio/morno/quente com cor), e os
  `principaisRazoes` (2–3 bullets). Card clicável → vai pra Tela B (`/lead/[id]`).
- Visual de "radar/painel": deixar claro que é fila inteligente, não lista burra.

**Pronto quando:** dá pra filtrar, ver a fila ordenada por captabilidade, e
clicar num lead pra abrir a ficha.

**Mockar:** nada novo — consome a API da Fase 2.

---

## Fase 4 — Tela B: Ficha do lead (com IA) 🟢 core
**Objetivo:** a ficha que mostra a inteligência + o briefing da IA.

**Construir (`app/lead/[id]/page.tsx` + componentes):**
- Dados do imóvel + proprietário (com aviso de que contato é mockado).
- **Gráfico de histórico de preço** — SVG/sparkline **na mão** (zero dependência
  de chart), marcando as reduções.
- **Breakdown dos sinais** (`avaliacao.sinais`): barra por sinal (pontos/máximo) +
  `detalhe` + intensidade.
- **Briefing da IA** (chama `POST /api/briefing`): `porQueAgora`, `comoAbordar`,
  **`mensagemSugerida`** (com botão "copiar"), `objecaoProvavel`. Mostrar estado
  de loading. Badge discreto quando `fonte === "fallback"` (sem API key).

**Pronto quando:** abrir um lead mostra gráfico + sinais + briefing real do Claude,
e dá pra copiar a mensagem de abordagem.

**Pré-requisito de ambiente:** criar `.env.local` com `ANTHROPIC_API_KEY=...`
(sem isso, o briefing usa o fallback determinístico — o app não quebra).

---

## Fase 5 — Scraper OLX scrape-once (upgrade pra dado real) 🟡 opcional/arriscado
**Objetivo:** trocar (parte do) dado sintético por anúncios FSBO **reais** do OLX.

**Construir:**
- `scripts/scrape-olx.mjs` (Node ESM + `cheerio`/`fetch`) que raspa **uma vez**
  resultados de busca do OLX p/ 1–2 regiões, extrai os campos do contrato `Lead`
  que der (bairro, preço, área, tipo, URL), marca `fonte: "olx-real"`, e
  **enriquece** o que não vem do anúncio (`historicoPreco`, `diasNoAnuncio`,
  reduções) calibrado nos benchmarks. Grava/funde em `data/leads.json`.
- **Fallback:** se o OLX bloquear (anti-bot/CAPTCHA), manter o sintético da Fase 1.
  O demo **nunca** depende do scrape ao vivo.

**Pronto quando:** rodar o script enche o cache com alguns leads reais; se falhar,
o app segue funcionando com o sintético.

**Risco conhecido:** OLX tem anti-bot; ZAP/Viva Real (DataDome) são piores —
focar no OLX. Não colocar scrape no caminho do demo.

---

## Fase 6 — Polish + pitch 🟢
**Objetivo:** deixar redondo pra apresentar.

**Construir:**
- **Selo/aviso LGPD** na Tela B: a `mensagemSugerida` identifica origem (anúncio
  público) + saída fácil ("é só ignorar"). Deixar isso visível como feature.
- Barra de métricas opcional no topo do Radar ("X encontrados · Y quentes").
- Ajuste visual, curar os leads-herói pro fluxo de demo ficar liso.
- `README.md`: como rodar (`npm run dev`), onde pôr a `ANTHROPIC_API_KEY`, como
  regenerar dados (`node scripts/gen-data.mjs`).
- Ensaio do fluxo: Radar → filtra → lead-herói → ficha → briefing → copiar msg.

**Pronto quando:** o fluxo de 3 min roda sem tropeço e o README explica o setup.

---

## Ordem sugerida
**1 → 2 → 3 → 4** é o caminho crítico (app funcionando end-to-end com dado
sintético + IA real). **5** é upgrade opcional de realismo. **6** é o acabamento.
Se o tempo apertar, corte a Fase 5 e o que for "opcional" na 6 — o núcleo
(1–4 + selo LGPD) é o que vende.
