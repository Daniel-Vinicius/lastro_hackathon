# Radar de Captação — Roadmap

> **Como usar este arquivo:** o núcleo (Fases 1–4) **e a Sessão 1 (blocos A–E)**
> estão **prontos**. O que resta é a **Sessão 2 — banco real + dedup** (blocos
> F→H). Leia _Visão_, _Decisões travadas_ e a seção **Sessão 2** antes de mexer.

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
| Público | **Donos sem exclusividade** — mesmo imóvel pulverizado em vários anunciantes (imobiliárias e/ou particular). O recorte FSBO puro vira um *subcaso* (quando há listing particular com contato direto). _Revisado na Sessão 2._ |
| Usuário/pagante | Imobiliária/corretor |
| IA | **Claude real** (briefing pro corretor); resto **mockado** |
| IA NÃO faz | Conversar com o dono; CRM/Kanban — ficam como "extra/futuro" |
| Stack | **Next.js 16.2.9 full-stack** (App Router, TS) + Tailwind v4 |
| Modelo | `claude-opus-4-8` (default; configurável via env `CLAUDE_MODEL`) |
| Saída estruturada | `messages.parse()` + `zodOutputFormat` |
| Score | **Determinístico em `lib/score.ts`** — nunca sai do LLM (estabilidade no demo) |
| **Alvo de scrape** | Primário **Chaves na Mão**, secundário **SP Imóvel** (passaram em `fetch` simples). OLX/Viva Real/ZAP/ImovelWeb bloqueiam (403 + captcha/Cloudflare/DataDome) → descartados |
| Dados | **Real-only**: `leads.json` = scrape de Chaves na Mão + SP Imóvel (enriquecido); `gen-data.mjs` vira só fallback. **Nunca** scrape ao vivo no demo |
| Dado real vs. enriquecido | REAL: preço, área, bairro, tipo, foto, link. ENRIQUECIDO: histórico/dias/reduções. **Portais = só o portal verificado** (sem pulverização inventada); o "calor" é atribuído pelo **gap real** vs. mediana do bairro |
| Core inegociável | Lista com score (Tela A) + Ficha com IA "por que abordar" (Tela B) |
| **Persistência (Sessão 2)** | **Neon (Postgres) + Drizzle**. `data/leads.json` vira **seed/fallback**. `lib/data.ts` passa a ler do banco mantendo o **mesmo contrato `LeadComScore`** (UI e `score.ts` não mudam) |
| **Identidade do imóvel (Sessão 2)** | Mesmo portal → chave `(portal, portal_listing_id)`. Cross-portal → **fingerprint fuzzy** (geo + área + quartos, foto/CEP se houver). Habilita pulverização **real** e tracking longitudinal |
| **Contato (Sessão 2)** | **Acabou nome/telefone fake.** Contato do dono só aparece se houver **listing particular** (ex.: OLX). Sem ele, a UI diz **"vinculado à Imobiliária X"** (nome real se raspável, senão "imobiliária") |
| **Pulverização = sinal-herói (Sessão 2)** | Redefinida como **nº de anunciantes distintos** (portais × imobiliárias) do mesmo imóvel — medida real de "sem exclusividade". Era sempre 0; passa a valer pontos de verdade |
| **Mock OLX (Sessão 2)** | OLX bloqueia fetch → entra **`data/olx-mock.json` (~5 imóveis particulares)** desenhado pra **cruzar** geo/área/quartos com leads reais. Demonstra a **ponte cross-portal**: anúncio-imobiliária ↔ anúncio-FSBO revela o dono. Rotulado como mock (honestidade) |

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
| **Chaves na Mão** | HTTP 200 (1 MB) | HTML + **8 blocos `application/ld+json`** com `Apartment`/`Offer` completos (~15 anúncios/página): preço, área, endereço, foto, geo já estruturados | ✅ **Alvo primário** (menos parsing) |
| **SP Imóvel** | HTTP 200 (584 KB) | server-rendered; `ItemList` ld+json (23 anúncios) + slug super-estruturado (tipo/transação/quartos/vagas/área/bairro/id). **Preço/foto** só no card HTML. **SP-only** (casa com a calibração) | ✅ **Secundário/fallback** |
| OLX | HTTP 403 + captcha | desafio anti-bot | ❌ precisaria headless/proxy |
| Viva Real / ZAP | HTTP 403 + captcha | DataDome | ❌ pior ainda |
| ImovelWeb | HTTP 403 + Cloudflare | desafio Cloudflare (grupo Navent) | ❌ precisaria headless/proxy |

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

# SESSÃO 1 — incrementos A–E (✅ FEITA)

> Ordem confirmada: **A → B → C → D → E**. Ganhos baratos primeiro (bancam melhoria
> mesmo se tudo falhar), scraper com **time-box rígido** (sintético é a rede),
> críterios e polish de baixo risco. Se o scraper estourar 2h: **corta** — o app
> segue redondo. **Resultado:** A–D entregues; scrapers reais (Chaves na Mão + SP
> Imóvel) no ar, `leads.json` = 30 leads reais.

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
- Estender união `fonte` em `lib/types.ts` (`"chavesnamao-real"`, e `"spimovel-real"` se entrar o secundário).
- **Secundário (se sobrar tempo / se o primário render pouco):** `scripts/scrape-spimovel.mjs`
  — parseia o `ItemList` ld+json + slug (tipo/quartos/vagas/área/bairro) e puxa
  preço/foto do card HTML. SP-only, casa com a calibração de R$/m².
- **Fallback:** se vier 403/captcha/Cloudflare, logar e sair sem tocar no JSON existente.

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

# SESSÃO 2 — Banco real + dedup (F → H)

> **Tese da sessão:** o que separa "dado sintético" de "dado real" **não é
> scraping, é tempo + identidade**. Três dos quatro sinais do score ficam reais
> assim que existe um banco que **deduplica** e **guarda observações ao longo do
> tempo**. O Neon+Drizzle não é "onde guardar" — é o que **torna o score honesto**.
>
> **Escopo travado:** F → H. O mecanismo de upsert/observação (G) já deixa o
> diff-temporal pronto, mas a *demo ao vivo* dele fica como stretch (ex-bloco I).

## Por que cada sinal fica (ou não) real

| Sinal | Pts | Antes | Depois da Sessão 2 |
|---|---|---|---|
| **Gap vs. mercado** | 25 | 🟡 semi-real | igual (preço real ÷ mediana derivada) |
| **Pulverização** | 20 | 🔴 sempre 0 | 🟢 **real** — nº de anunciantes distintos do mesmo imóvel (via dedup) |
| **Dias no anúncio** | 30 | 🔴 fabricado (ex.: cnm-42593585 = 143d) | 🟢 **real** via `datePosted` da CNM (o mesmo anúncio = **26d** reais). Exige **fetch da página de detalhe** por anúncio |
| **Reduções** | 25 | 🔴 fabricado | ⚪ **começa em 0 pra todos** (nenhum portal expõe histórico de snapshot). Vira real via `price_observations` do T0+. **Demonstrado no demo** via mudança de preço no mock OLX |

> **Honestidade:** "100% real" no dia 1 é inviável p/ séries temporais. O ganho
> concreto: **acaba toda fakery** (nome/telefone/portais inventados), **dias vira
> real** (datePosted), **pulverização vira real** (dedup), **contato vira
> real-ou-honesto**. Sobra **só reduções** dependendo do tempo — e começa em 0,
> sem fingir. **Placar: 3 dos 4 sinais reais no dia 1.**

### Freebies verificados (checks de rede, 14/06)

| Check | Veredito | Consequência |
|---|---|---|
| SP Imóvel `valor-historico` = histórico? | ❌ **NÃO** | É só o **preço atual** (o visível vem mascarado em R$ 1,00). Um valor, sem datas → sem reduções reais |
| CNM `datePosted`? | ✅ **SIM** | `RealEstateListing.datePosted` na **página de detalhe** → `diasNoAnuncio` **real**. Custo: 1 fetch/anúncio (o scraper SP Imóvel já faz isso) |
| CNM nome da imobiliária? | ⚠️ **parcial** | `offeredBy` no offer da busca + `CRECI` no HTML. Nome exato precisa de 1 parse a mais; fallback "imobiliária (CRECI …)" |
| CNM geo/CEP/endereço? | ✅ **bônus** | offer da busca traz `geo` (lat/lng) **+ CEP + rua e número** → dedup quase determinístico |

> ⚠️ **Caveat do `datePosted`:** reseta se a imobiliária republica → pode
> **subestimar** o tempo real de encalhe. É honesto ("anunciado neste portal há
> Xd"), mas não é "no mercado há Xd". SP Imóvel **não** tem `datePosted` → seus
> leads só ganham `dias` real do `first_seen` (T0+); no dia 1 ficam sem.

## Arquitetura (Neon + Drizzle)
```
properties          ← o imóvel canônico (deduplicado)
  id, fingerprint, bairro, cidade, uf, lat, lng,
  tipo, transacao, area, quartos, vagas,
  precoEstimadoMercado, first_seen, last_seen

listings            ← uma linha por aparição em anunciante/portal
  id, property_id→, portal, portal_listing_id (unique p/ portal),
  url, anunciante_tipo ('imobiliaria'|'particular'), anunciante_nome,
  proprietario, telefone,        -- só preenchidos quando particular
  active, first_seen, last_seen

price_observations  ← append-only (a série temporal real)
  id, listing_id→, observed_at, price

lead_status         ← ações do corretor (esconde/dá contexto na fila)
  property_id→, status ('novo'|'contatado'|'negociando'|'descartado'|'vendido'),
  note, updated_at
```

**Projeção `Lead` (o que a UI consome, derivado de `properties`):**
- `diasNoAnuncio` = hoje − `min(first_seen)` (ou `datePosted`)
- `reduções` = quedas em `price_observations` ordenado
- `pulverizacao` = nº de anunciantes distintos com listing ativa
- `proprietario`/`telefone` → **opcionais**: só se houver listing `particular`
- novo: `anunciantes: string[]` (imobiliárias) + `temContatoDireto: boolean`

**Dedup:** mesmo portal → `(portal, portal_listing_id)` (trivial, dá o
longitudinal de graça). Cross-portal / mesmo-imóvel-vários-anunciantes → score de
similaridade. **CNM já traz CEP + rua + número → chave quase determinística**;
fallback `geo (lat/lng) + área + quartos` (SP Imóvel não tem CEP). Acima do limiar,
funde no mesmo `property_id`. _Verificado 14/06: CNM expõe geo+CEP+endereço no offer da busca._

## Bloco F — Migração Neon + Drizzle · ~1:00 · risco médio
**Objetivo:** Postgres real por baixo, sem tocar UI nem `score.ts`.
- **Projeto Neon já criado**; conexão em `.env` na var **`NEON_POSTGRES_CONNECTION_STRING`**
  (ver `.env.example`). _Não é `DATABASE_URL`._
- `drizzle.config.ts` + `lib/db/schema.ts` (4 tabelas acima) + `lib/db/index.ts`
  (cliente Neon serverless `@neondatabase/serverless` + `drizzle-orm`).
- `npx drizzle-kit push` p/ criar o schema no Neon. _(Opcional: `npx neonctl@latest init`
  — setup assistido por IA; usar só se ajudar, não obrigatório.)_
- `lib/data.ts` passa a consultar o banco e **montar a projeção `Lead`** — mesma
  assinatura de `buscarLeads`/`buscarLeadPorId`/`facetas`. Fallback p/ `leads.json`
  se a env ausente (não quebra o demo).
- Seed: script que lê `data/leads.json` → popula `properties`/`listings`/`price_observations`.

**Pronto quando:** o app roda lendo do Neon; sem a env, cai no JSON.

## Bloco G — Scraper vira upsert + dedup · ~1:00–1:30 · risco médio **(a carne)**
**Objetivo:** ingestão idempotente com identidade real → pulverização real.
- `_scrape-utils.mjs`: trocar `mergeAndWrite` (rewrite do JSON) por **upsert no banco**:
  - acha/cria `property` via dedup (mesmo-portal por ID; cross-portal por fingerprint);
  - upsert do `listing` (`first_seen`/`last_seen`/`active`);
  - **append** em `price_observations` se o preço mudou desde a última observação.
- **Parar de inventar:** sem `proprietario`/`telefone` fake; sem `portais` fake;
  **sem reduções fabricadas** (`price_observations` começa com 1 observação = preço atual).
  `anunciante` = imobiliária (nome via `offeredBy`/CRECI, senão "imobiliária").
- **`diasNoAnuncio` real (CNM):** o scraper da CNM passa a **baixar a página de
  detalhe** de cada anúncio p/ ler `RealEstateListing.datePosted` (espelha o SP
  Imóvel, que já faz fetch de detalhe). SP Imóvel não tem data → `first_seen` no T0.
- **Mock OLX:** `data/olx-mock.json` com ~5 imóveis `particular` (com contato real),
  desenhados pra cruzar geo/CEP/área com leads reais. `scripts/ingest-olx-mock.mjs`
  roda pelo mesmo caminho de upsert → o dedup **funde** com a property da imobiliária
  → a ficha ganha contato direto do dono. Rotular `fonte: "olx-mock"`.
  - **Demo de reduções:** ≥1 imóvel do mock tem **2 observações** (preço anterior →
    preço menor) → mostra a feature de reduções/histórico funcionando, honestamente.

**Pronto quando:** re-rodar um scraper não duplica imóvel (atualiza preço/observação);
imóvel pulverizado mostra N anunciantes; property cruzada com o mock OLX expõe o dono
e exibe a queda de preço.

## Bloco H — Lead status (marcar utilizado) · ~0:45 · risco baixo
**Objetivo:** fila não repete quem o corretor já trabalhou.
- Rotas: `POST /lead/[id]/status` (grava em `lead_status`).
- `buscarLeads`: por padrão esconde `descartado`/`vendido` (ou mostra esmaecido
  com badge); `novo`/`contatado`/`negociando` ficam na fila com selo.
- UI: na ficha (Tela B), botões "Marcar contatado / Em negociação / Descartar /
  Vendido"; o badge aparece no `LeadCard` da Tela A.

**Pronto quando:** marcar "contatado" persiste e reflete na fila ao recarregar.

## Riscos & cortes (Sessão 2)
- **Overlap cross-portal pode ser baixo** (CnM × SP Imóvel são listas distintas).
  Mitiga: (1) pulverização conta **anunciantes** dentro do próprio portal também;
  (2) o **mock OLX** garante ≥3 properties "bridge" pro demo.
- **Nome da imobiliária pode não vir no JSON-LD** → fallback "vinculado a uma
  imobiliária" (sem nome). Ainda honesto.
- Se F estourar tempo: o fallback p/ `leads.json` mantém o app de pé; H e o mock
  OLX são os de maior retorno visual → priorizar sobre dedup cross-portal perfeito.
- **Ex-bloco I (diff-temporal ao vivo)** = stretch: 2º pass com preço mutado →
  score sobe na hora. O mecanismo (G) já suporta; só falta o roteiro de demo.

---

## Verificação (após cada bloco e no fim)
`npx tsc --noEmit` (strict) · `npm run lint` · `npm run build` · fluxo manual.

## Se o tempo apertar (Sessão 2)
Prioridade por retorno visual: **H** (lead status) + **mock OLX** (revela o dono,
prova a ponte) são o que mais vende no pitch. **F** (banco) é a base — se estourar,
o fallback p/ `leads.json` segura o app. **Dedup cross-portal perfeito** é o
primeiro a cortar (o mock OLX já dá o momento "achamos o dono"). Núcleo + A–E +
banco + status é entrega redonda.
