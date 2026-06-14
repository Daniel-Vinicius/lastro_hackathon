# Radar de Captação — Roadmap

> **Como usar este arquivo:** o núcleo (Fases 1–4) está **pronto**. O que resta é
> a **sessão de incrementos de hoje** (blocos A–E, orçados em horas). Leia _Visão_,
> _Decisões travadas_ e _Estado atual_ antes de mexer em qualquer coisa.

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
pitch ancorado em dado**.

---

## Decisões travadas (não relitigar)

| Tema | Decisão |
|---|---|
| Público | Descoberta **FSBO** (donos anunciando direto nos portais) |
| Usuário/pagante | Imobiliária/corretor |
| IA | **Claude real** (briefing pro corretor); resto **mockado** |
| IA NÃO faz | Conversar com o dono; CRM/Kanban — ficam como "extra/futuro" |
| Stack | **Next.js 16.2.9 full-stack** (App Router, TS) + Tailwind v4 |
| Modelo | `claude-opus-4-8` (default; configurável via env `CLAUDE_MODEL`) |
| Saída estruturada | `messages.parse()` + `zodOutputFormat` |
| Score | **Determinístico em `lib/score.ts`** — nunca sai do LLM (estabilidade no demo) |
| **Alvo de scrape** | **Chaves na Mão** (único que passou em `fetch` simples). OLX/Viva Real/ZAP bloqueiam (403 + captcha) → descartados |
| Dados | **Scrape-once → funde no cache JSON** + enriquece; base sintética sempre presente; **nunca** scrape ao vivo no demo |
| Core inegociável | Lista com score (Tela A) + Ficha com IA "por que abordar" (Tela B) |

---

## Estado atual (✅ feito — NÃO refazer)

- Projeto **Next.js 16.2.9 + React 19 + Tailwind v4 + TS** + deps (`@anthropic-ai/sdk`, `cheerio`, `zod`).
- **`lib/`** completo: `types.ts`, `score.ts` (`avaliarLead` + `contarReducoes`/`gapPreco`),
  `data.ts` (`buscarLeads`/`buscarLeadPorId`/`facetas`), `anthropic.ts`
  (`gerarBriefing` com fallback), `format.ts` (helpers de UI).
- **`scripts/gen-data.mjs`** → gera **40 leads** sintéticos calibrados (4 heróis +
  perfis quente/morno/frio, venda+aluguel). `data/leads.json` populado.
- **API** (`app/api/`): `GET /search`, `GET /lead/[id]`, `POST /briefing` (runtime nodejs).
- **Tela A** (`app/page.tsx` + `RadarShell`/`FiltroForm`/`ListaLeads`/`LeadCard`/`ScoreBadge`):
  filtros + fila priorizada + barra de métricas ("X leads · Y quentes").
- **Tela B** (`app/lead/[id]`): dados + fotos + gráfico SVG de preço (`GraficoPreco`)
  + breakdown de sinais (`BreakdownSinais`) + briefing IA com copiar (`BriefingPanel`).
- **O app roda end-to-end** com dado sintético + IA (real se houver `.env.local`,
  senão fallback determinístico — não quebra).

**Ainda NÃO existe:** `.env.local` (briefing roda no fallback até criar), scraper
real, cache de briefing, página de critérios, botão WhatsApp.

---

## Contratos (fonte da verdade: `lib/types.ts`)

```ts
Lead {
  id; proprietario; telefone; bairro; cidade; uf;
  tipo: "apartamento"|"casa"|"cobertura"|"kitnet"|"sobrado";
  transacao: "venda"|"aluguel";
  area; quartos; vagas;
  precoAtual; historicoPreco: {data,valor}[]; diasNoAnuncio;
  portais: string[]; anunciante: "particular";
  precoEstimadoMercado; fotos: string[];
  fonte: "sintetico"|"chavesnamao-real"; anuncioUrl?;   // ← união estendida no bloco C
}
ResultadoScore { score:0-100; tier:"frio"|"morno"|"quente"; sinais:SinalScore[]; principaisRazoes:string[] }
LeadComScore = Lead & { avaliacao: ResultadoScore }
BriefingCaptacao { porQueAgora; comoAbordar; mensagemSugerida; objecaoProvavel }
FiltrosBusca { cidade?; bairro?; transacao?; tipo?; precoMin?; precoMax? }
```

> `data/leads.json` = **`Lead[]`** (sem `avaliacao` — score calculado em tempo de
> leitura por `avaliarLead`). Tiers: `quente` ≥66, `morno` ≥40, senão `frio`.

---

## 🔎 Análise de scraping (sondagem real — `fetch` simples, hoje)

| Portal | Resposta | O que volta | Veredito |
|---|---|---|---|
| **Chaves na Mão** | HTTP 200 (1 MB) | HTML completo + **8 blocos `application/ld+json`**, ~15 anúncios/página | ✅ **Alvo** |
| OLX | HTTP 403 + captcha | desafio anti-bot | ❌ precisaria headless/proxy |
| Viva Real / ZAP | HTTP 403 + captcha | DataDome | ❌ pior ainda |

**Campos por origem** (mapeados de um anúncio real do Chaves na Mão):

- **Real (do scrape):** bairro, cidade, uf, tipo, área, quartos, **precoAtual**,
  **fotos (URL real)**, **anuncioUrl**, lat/long, descrição.
- **Derivável do lote raspado:** `precoEstimadoMercado` = mediana de R$/m² por bairro.
- **Construído/enriquecido (sintético):** `historicoPreco` ⚠️ (nenhum snapshot
  expõe), `diasNoAnuncio`, reduções, `portais` (pulverização), `anunciante`
  (Chaves na Mão é majoritariamente imobiliária → classificação enriquecida),
  `proprietario`, `telefone` (fake por LGPD).

> **Por que o histórico é sempre construído:** dias-no-anúncio (30) + reduções (25)
> = **55 dos 100 pontos** do score vêm de séries temporais que _nenhum_ scrape de
> snapshot único tem. O scrape entrega a **camada tangível real** (foto + preço +
> bairro + link); os sinais temporais são enriquecidos — independente do portal.

**Tensão FSBO assumida:** o OLX é _o_ portal de particular (e é o bloqueado); o
Chaves na Mão é raspável mas é quase tudo imobiliária. Solução **híbrida honesta**:
heróis sintéticos seguem como núcleo da narrativa do score; alguns leads reais do
Chaves na Mão entram com foto/link reais (badge "dado real") provando o pipeline.

---

# SESSÃO DE HOJE — incrementos (15h → 20h úteis; 20–21h reserva de entrega)

> Ordem confirmada: **A → B → C → D → E**. Ganhos baratos primeiro (bancam melhoria
> mesmo se tudo falhar), scraper com **time-box rígido** (sintético é a rede),
> críterios e polish de baixo risco. Se o scraper estourar 2h: **corta** — o app
> segue redondo.

## Bloco A — Botão WhatsApp + quick wins de UI · ~0:30 · risco 0
**Objetivo:** fechar o loop visível da abordagem.
- `BriefingPanel` recebe `telefone` como prop (vindo da ficha) e ganha botão
  **"Chamar no WhatsApp"** ao lado do "Copiar": deeplink
  `https://wa.me/55<digitos>?text=<mensagemSugerida codificada>`.
- Pequenos ajustes visuais de leitura.

**Pronto quando:** clicar abre o WhatsApp com a mensagem sugerida já preenchida.

## Bloco B — Cache do briefing · ~0:30 · risco baixo
**Objetivo:** não regerar o briefing (e não gastar API) a cada visita à ficha.
- `Map` module-level em `lib/anthropic.ts` chaveado por `lead.id` (lead é estático).
  `gerarBriefing` consulta/grava o cache antes de chamar o Claude.
- (Opcional) persistir em `data/.briefing-cache.json` p/ sobreviver a restart.

**Pronto quando:** 2ª visita à mesma ficha volta instantânea, sem nova chamada.

## Bloco C — Scraper Chaves na Mão · ~2:00 **(TIME-BOX)** · risco médio
**Objetivo:** trocar parte do dado por anúncios reais (foto + link reais).
- `scripts/scrape-chavesnamao.mjs` (Node ESM + `fetch`, `cheerio` se preciso):
  raspa 1–2 páginas de busca, parseia os blocos `application/ld+json`, extrai os
  campos reais, **enriquece** o resto espelhando a lógica de `gen-data.mjs`
  (`buildHistorico`, dimensões), calcula `precoEstimadoMercado` pela mediana do
  lote, marca `fonte: "chavesnamao-real"` + `anuncioUrl` + `fotos` reais.
- **Funde** em `data/leads.json` de forma idempotente (remove `chavesnamao-real`
  anteriores, mantém sintéticos, reanexa). Isso É o "fluxo de carga" — sem UI de
  import (import ao vivo é proibido pela decisão travada).
- Estender união `fonte` em `lib/types.ts`.
- **Fallback:** se vier 403/captcha, logar e sair sem tocar no JSON existente.

**Pronto quando:** rodar o script enche o cache com leads reais; se falhar, o app
segue com o sintético.

## Bloco D — Página de critérios · ~1:00 · risco baixo
**Objetivo:** transparência + controle do score (explicabilidade ao vivo).
- Rota `app/criterios/page.tsx`: mostra os **4 sinais e pesos read-only**
  (dias 30 · reduções 25 · gap 25 · pulverização 20) com explicação.
- **Cortes quente/morno/frio editáveis** (sliders) com **preview de distribuição
  ao vivo** — re-classifica 100% no client a partir do `score` numérico que cada
  lead já traz. Persiste em `localStorage`.
- Radar (`RadarShell`) lê os cortes do `localStorage` e **re-buckets** a lista
  (cor do tier + contagem de quentes). Link "Critérios" no cabeçalho do Radar.
- Pesos **read-only** (editar peso exigiria recompute no servidor — fora de escopo).

**Pronto quando:** arrastar os cortes reordena/recolore os tiers na hora.

## Bloco E — Polish + pitch · ~0:45 · risco baixo
- Badge **"dado real"** + "Ver anúncio original ↗" nos leads `chavesnamao-real`.
- Selo/nota **LGPD** visível na ficha (mensagem cita anúncio público + saída fácil).
- `README` atualizado (rodar, `.env.local`, `gen-data`, `scrape-chavesnamao`).
- Ensaio do fluxo: Radar → filtra → herói → ficha → briefing → WhatsApp; e
  Critérios → arrasta corte → fila reordena.

**Pronto quando:** o fluxo de 3 min roda sem tropeço.

---

## Verificação (após cada bloco e no fim)
`npx tsc --noEmit` (strict) · `npm run lint` · `npm run build` · fluxo manual.

## Se o tempo apertar
Corte na ordem: **C** (scraper — sintético cobre) → preview ao vivo do **D** →
opcionais do **E**. Núcleo + A + B + cortes editáveis é o que vende.
