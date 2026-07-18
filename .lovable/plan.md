## Objetivo
Adicionar 3 camadas de proteção para a agenda da Federal (quartas 20:30 e domingos 11:34):
1. **Validação no scraping** (backend)
2. **Configuração via Admin** (sem editar código)
3. **Testes automatizados**

---

## 1. Validação automática no scraping da Federal

Arquivo: `supabase/functions/scrape-results/index.ts`

Antes de inserir/atualizar `federal_results`, validar:
- Dia da semana em BRT deve ser **quarta (3)** ou **domingo (0)**
- Janela horária permitida:
  - Quarta: entre **20:25 e 23:59**
  - Domingo: entre **11:29 e 15:00**
- Se fora da janela → log `⏭️ Federal fora da janela — persistência ignorada` e pular sem gravar.

Também aplicar no `scrape-sp` (que hoje já tem `isFederalDrawDay` desabilitado — reforçar comentário).

---

## 2. Configuração no AdminDashboard

**Nova tabela** `public.federal_schedule` (uma linha por regra):

```sql
CREATE TABLE public.federal_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weekday smallint NOT NULL,        -- 0=domingo … 6=sábado
  draw_hour smallint NOT NULL,
  draw_minute smallint NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (weekday)
);
```

Seed inicial: `(3, 20, 30)` e `(0, 11, 34)`.

**Grants + RLS**:
- `SELECT` público (`anon` + `authenticated`) — front precisa ler.
- `INSERT/UPDATE/DELETE` apenas para `has_role(auth.uid(), 'admin')`.

**UI (nova seção em `AdminDashboard.tsx`)**: cartão "Agenda da Federal" listando as regras, com editar horário, toggle "ativo", adicionar/remover dia.

**Consumo no front**:
- Novo hook `useFederalSchedule()` (React Query, cache 5 min) que retorna as regras ativas.
- `src/lib/drawSchedule.ts` ganha helpers puros (`buildFederalDrawFromRule`) usados junto com o hook.
- Componentes já centralizados (`NextDrawCountdown`, `TickerBanner`, `LiveCountdownClock`) passam a receber a agenda vinda do hook, com **fallback** para os defaults atuais (quarta 20:30 / domingo 11:34) caso a query ainda não tenha carregado — nada trava se o banco estiver indisponível.

**Backend consumindo a mesma tabela**: `scrape-results` passa a ler `federal_schedule` no início para montar a janela de validação (com o mesmo fallback).

---

## 3. Testes automatizados

Setup mínimo (se ainda não existir): vitest + jsdom conforme guia padrão.

Arquivo novo `src/lib/drawSchedule.test.ts` cobrindo:
- `getFederalDrawForWeekday(3)` retorna 20:30.
- `getFederalDrawForWeekday(0)` retorna 11:34.
- `getFederalDrawForWeekday(n)` para `n ∈ {1,2,4,5,6}` retorna `null`.
- `isFederalDrawDay` responde `true` só para quarta/domingo.
- Simular datas fixas e verificar que `getNextFederalDraw` aponta para a próxima quarta 20:30 ou domingo 11:34 corretamente.

Arquivo novo `src/hooks/useFederalSchedule.test.ts` (mock do supabase client) validando que regras desativadas são ignoradas.

---

## Detalhes técnicos

**Migração SQL** cria tabela, grants, RLS, políticas e faz o seed inicial em uma migração única.

**Edge function** lê tabela via service role (já disponível). Se a leitura falhar, usa defaults hard-coded — nunca bloqueia scraping por erro de DB.

**AdminDashboard** usa componentes shadcn existentes (`Card`, `Table`, `Input`, `Switch`, `Button`) — sem novas dependências.

**Nenhuma alteração** na exibição atual: quarta 20:30 e domingo 11:34 continuam sendo os defaults enquanto o admin não mudar nada.

---

## Ordem de entrega
1. Migração SQL (tabela + grants + RLS + seed).
2. Hook `useFederalSchedule` + integração em `drawSchedule.ts` (com fallback).
3. Refactor de `NextDrawCountdown`, `TickerBanner`, `LiveCountdownClock`.
4. UI no `AdminDashboard`.
5. Validação em `scrape-results` + redeploy.
6. Setup de testes (se necessário) + `drawSchedule.test.ts` + `useFederalSchedule.test.ts`.