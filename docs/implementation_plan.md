# Implementation Plan — Sistema de Controle de Atividades
## Fórmula Engenharia e Consultoria

---

## Visão Geral do Projeto

Sistema web interno (intranet) para controle de atividades e status de serviços de cálculo estrutural. Roda em servidor TrueNAS (Linux) na rede local, acessado via browser pelos ~10 PCs da empresa. Sem dependência de internet.

**Dois perfis de uso:**
- **Funcionário** — inicia e finaliza atividades com timer automático, consulta histórico pessoal.
- **Admin/Chefe** — cadastra estrutura de dados, edita status, monitora equipe em tempo real via dashboard.

---

## Stack Tecnológica

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Backend | FastAPI (Python) | Simples, rápido, WebSocket nativo |
| Frontend | Next.js + TypeScript | SSR opcional, roteamento, ecossistema React |
| Estilização | Tailwind CSS | Utilitário, fácil de manter |
| Banco | PostgreSQL | Relacional, robusto para histórico e joins |
| Tempo real | WebSocket (FastAPI) | Dashboard admin atualiza sem polling |
| Deploy | Docker Compose (TrueNAS) | Isolamento, fácil restart de serviços |

**Serviços Docker:**
```
services:
  db:        postgres:16-alpine
  api:       Python 3.12 + FastAPI + SQLAlchemy + Alembic
  frontend:  Next.js buildado, servido por Nginx
```

---

## Identificação de Usuário (Hostname)

O método adotado é o mais simples possível: **seleção manual no primeiro acesso, associação salva em `localStorage`**.

Fluxo:
1. Ao abrir o sistema pela primeira vez no PC, o usuário vê uma tela "Quem é você?" com a lista de funcionários cadastrados.
2. Ele seleciona seu nome. O sistema salva `{ usuario_id, nome }` no `localStorage` do browser.
3. Nas visitas seguintes, o sistema lê o `localStorage` e entra direto — sem login, sem senha.
4. Um botão discreto "Trocar usuário" permite resetar a associação se necessário.
5. O Admin vê de qual PC veio cada ação (registra o `usuario_id` em todas as operações).

> Sem agente de rede, sem leitura de hostname via script, sem senha. Funciona 100% no browser.

---

## Modelagem do Banco de Dados

### Tabelas principais

```sql
-- Usuários do sistema
CREATE TABLE usuarios (
    id          SERIAL PRIMARY KEY,
    nome        VARCHAR(100) NOT NULL,
    role        VARCHAR(20) NOT NULL CHECK (role IN ('funcionario', 'admin')),
    ativo       BOOLEAN DEFAULT true,
    criado_em   TIMESTAMPTZ DEFAULT NOW()
);

-- Clientes construtoras
CREATE TABLE construtoras (
    id        SERIAL PRIMARY KEY,
    nome      VARCHAR(150) NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Edifícios/prédios vinculados a construtoras
CREATE TABLE edificios (
    id             SERIAL PRIMARY KEY,
    construtora_id INTEGER REFERENCES construtoras(id),
    nome           VARCHAR(150) NOT NULL,
    descricao      TEXT,
    criado_em      TIMESTAMPTZ DEFAULT NOW(),
    encerrado_em   TIMESTAMPTZ
);

-- Lajes de cada edifício
-- tipo: 'Fundacao' | 'Laje_N' (N = número inteiro) | 'FundCX' | 'TampaCX'
CREATE TABLE lajes (
    id          SERIAL PRIMARY KEY,
    edificio_id INTEGER REFERENCES edificios(id),
    tipo        VARCHAR(30) NOT NULL,
    ordem       INTEGER NOT NULL,     -- para ordenação correta na UI
    criado_em   TIMESTAMPTZ DEFAULT NOW()
);

-- Atividades geradas dentro de cada laje
CREATE TABLE atividades (
    id                      SERIAL PRIMARY KEY,
    laje_id                 INTEGER REFERENCES lajes(id),
    tipo_elemento           VARCHAR(30) NOT NULL,
    -- tipo_elemento: 'Vigas' | 'Lajes' | 'GrelhaRefinada' | 'Cortinas' |
    --                'Rampa' | 'Escada' | 'BlocosFundacao'
    subtipo                 VARCHAR(20),
    -- subtipo: 'Rascunho' | 'Formato' | NULL (para elementos livres)
    status_atual            VARCHAR(40) NOT NULL,
    usuario_responsavel_id  INTEGER REFERENCES usuarios(id),
    criado_em               TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em           TIMESTAMPTZ DEFAULT NOW()
);

-- Histórico de cada mudança de status
CREATE TABLE status_historico (
    id              SERIAL PRIMARY KEY,
    atividade_id    INTEGER REFERENCES atividades(id),
    usuario_id      INTEGER REFERENCES usuarios(id),
    status_anterior VARCHAR(40),
    status_novo     VARCHAR(40) NOT NULL,
    timestamp       TIMESTAMPTZ DEFAULT NOW()
);

-- Sessões de trabalho (o timer)
CREATE TABLE sessoes_trabalho (
    id               SERIAL PRIMARY KEY,
    atividade_id     INTEGER REFERENCES atividades(id),
    usuario_id       INTEGER REFERENCES usuarios(id),
    iniciado_em      TIMESTAMPTZ DEFAULT NOW(),
    finalizado_em    TIMESTAMPTZ,
    duracao_segundos INTEGER     -- preenchido ao finalizar
);
```

### Regras de status por tipo de atividade

| Elemento | Subtipo | Status possíveis | Vincula funcionário? |
|-------|----------|-----------------|---|
| Vigas | Rascunho | Gerado → Impresso → **Montada** (pronto para imprimir) | Não |
| Vigas | Formato | Fazendo → Ok | Sim |
| Lajes | Rascunho | Fazendo → Ok | Sim |
| Lajes | Formato | Fazendo → Atendendo comentários | Sim |
| Grelha refinada | — | Fazendo → Ok | Sim |
| Cortinas | — | Fazendo → Ok | Sim |
| Rampa | — | Fazendo → Ok | Sim |
| Escada | — | Fazendo → Ok | Sim |
| Blocos de fundação | — | Fazendo → Ok | Sim |

> Vigas > Rascunho é o único subtipo sem vínculo de funcionário — apenas registra o estado físico do documento.

### Restrição de sessão única

Um funcionário **não pode ter duas sessões abertas simultaneamente**. Ao clicar "Iniciar" em uma nova atividade, o sistema verifica se existe uma `sessao_trabalho` com `finalizado_em IS NULL` para aquele `usuario_id`. Se existir, bloqueia a ação e exibe uma mensagem indicando qual atividade já está em andamento.

```sql
-- Constraint verificada antes de INSERT em sessoes_trabalho
SELECT COUNT(*) FROM sessoes_trabalho
WHERE usuario_id = :uid AND finalizado_em IS NULL;
-- Se > 0, rejeitar com erro 409
```

---

## Auto-geração de Lajes e Atividades

O admin informa apenas o **número de lajes pavimento-tipo**. O sistema gera automaticamente toda a estrutura.

**Exemplo: edifício com 3 pavimentos-tipo**

Lajes geradas (em ordem): Fundação, Laje 1, Laje 2, Laje 3, FundCX, TampaCX

Para cada laje, são criadas automaticamente as atividades:
- Vigas > Rascunho (status inicial: "Gerado")
- Vigas > Formato (status inicial: "Fazendo")
- Lajes > Rascunho (status inicial: "Fazendo")
- Lajes > Formato (status inicial: "Fazendo")
- Grelha refinada (status inicial: "Fazendo")
- Cortinas (status inicial: "Fazendo")
- Rampa (status inicial: "Fazendo")
- Escada (status inicial: "Fazendo")
- Blocos de fundação (status inicial: "Fazendo")

O endpoint responsável:
```
POST /api/edificios
Body: { construtora_id, nome, descricao, num_pavimentos }
```

---

## Endpoints da API

### Autenticação / Usuários
```
GET  /api/usuarios                   → lista todos (para tela de seleção)
POST /api/usuarios                   → cadastra novo (admin)
PUT  /api/usuarios/{id}              → edita (admin)
```

### Estrutura
```
GET  /api/construtoras
POST /api/construtoras
GET  /api/edificios
POST /api/edificios                  → cria edifício + gera lajes/atividades
GET  /api/edificios/{id}/lajes       → estrutura completa com atividades
```

### Atividades
```
GET  /api/atividades?usuario_id=     → atividades do funcionário
PUT  /api/atividades/{id}/status     → atualiza status (registra histórico)
GET  /api/atividades/{id}/historico
```

### Sessões de trabalho (timer)
```
POST /api/sessoes                    → inicia sessão (verifica sessão aberta)
PUT  /api/sessoes/{id}/finalizar     → encerra sessão, calcula duração
GET  /api/sessoes?usuario_id=        → histórico de sessões
```

### Dashboard (admin)
```
GET  /api/dashboard/tempo-real       → WebSocket — atividades abertas agora
GET  /api/dashboard/progresso        → % conclusão por edifício
GET  /api/dashboard/produtividade    → tempo por funcionário/atividade (filtros)
```

---

## Módulos do Frontend

### Tela de seleção de usuário (primeiro acesso)
- Lista de funcionários ativos em cards
- Confirmação com modal "Você é [Nome]?"
- Salva `usuario_id` e `nome` no `localStorage`
- Redireciona para tela principal

### Tela principal — Funcionário
- Cards de atividades em andamento (status "Fazendo" com ele vinculado)
- Lista de atividades disponíveis para iniciar (status inicial, sem responsável)
- Timer visível em tempo real para a sessão ativa
- Botão "Finalizar atividade" avança o status
- Aba "Meu histórico" — lista de sessões com tempo acumulado por prédio

### Painel Admin — Cadastro
- Formulário de novo edifício com campo `num_pavimentos` → botão "Gerar estrutura"
- Visualização em árvore: Construtora > Edifício > Laje > Atividades
- Edição inline de qualquer status com log automático
- CRUD de usuários com toggle ativo/inativo

### Painel Admin — Dashboard
- Card de "Atividades em andamento agora" (atualização via WebSocket)
- Gráfico de barras: progresso de conclusão por edifício (Recharts)
- Gráfico de linhas: horas trabalhadas por funcionário ao longo do tempo
- Tabela filtrada por: funcionário, edifício, período, status
- Exportação para Excel via endpoint dedicado (`xlsxwriter` no backend)

---

## Estilização e Identidade Visual

O sistema deve refletir a identidade da **Fórmula Engenharia** — empresa técnica, séria, com presença visual definida.

**Paleta de cores** (extraída do logo):
```css
:root {
  --verde-formula:     #5a8a4a;   /* verde principal — ações, botões primários */
  --verde-escuro:      #3b6d11;   /* hover, estados ativos */
  --verde-claro:       #eaf3de;   /* fundos de cards de sucesso, badges */
  --cinza-formula:     #6b6b6b;   /* textos secundários, bordas */
  --cinza-escuro:      #2c2c2a;   /* textos primários, headings */
  --cinza-claro:       #f1efe8;   /* background geral das páginas */
  --branco:            #ffffff;   /* cards, painéis */
  --alerta-amarelo:    #ba7517;   /* status "Atendendo comentários" */
  --status-fazendo:    #185fa5;   /* badge azul para "Fazendo" */
}
```

**Tipografia:**
- Headings: `'Barlow Condensed', sans-serif` — caráter técnico-industrial, remete a plantas e documentação de engenharia
- Body: `'Inter', sans-serif` — legibilidade em telas, tamanhos menores para tabelas densas
- Monospace (timestamps, IDs): `'JetBrains Mono', monospace`

**Componentes de status** — badges coloridos por estado:
- `Fazendo` → fundo `--status-fazendo` (azul)
- `Ok` → fundo `--verde-claro`, texto `--verde-escuro`
- `Atendendo comentários` → fundo amarelo-âmbar
- `Gerado / Impresso / Montada` → escala de cinza progressiva

**Timer ativo** — exibir em destaque com fundo `--verde-formula` e contagem crescente em `JetBrains Mono`. Funciona como âncora visual para o funcionário saber que tem algo em andamento.

**Logo** — incluir no header em SVG ou PNG com fundo transparente. Sidebar esquerda com fundo `--cinza-escuro` e texto branco, navegação com hover em `--verde-formula`.

**Responsividade** — os PCs são desktops, então o layout prioritário é `≥ 1280px`. Mobile não é requisito, mas manter legível em `≥ 768px` por boa prática.

---

## Estrutura de Diretórios

```
formula-sistema/
├── docker-compose.yml
├── api/
│   ├── Dockerfile
│   ├── main.py
│   ├── models/          # SQLAlchemy ORM
│   ├── schemas/         # Pydantic
│   ├── routers/         # usuarios, edificios, atividades, sessoes, dashboard
│   ├── services/        # lógica de negócio (geração de lajes, timer, etc.)
│   └── database.py
├── frontend/
│   ├── Dockerfile
│   ├── next.config.ts
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx              # seleção de usuário
│   │   │   ├── dashboard/            # telas do funcionário
│   │   │   └── admin/                # painel admin
│   │   ├── components/
│   │   │   ├── StatusBadge.tsx
│   │   │   ├── TimerAtivo.tsx
│   │   │   ├── ArvoreEstrutura.tsx
│   │   │   └── GraficoProgresso.tsx
│   │   ├── hooks/
│   │   │   ├── useUsuarioLocal.ts    # lê/grava localStorage
│   │   │   └── useSessaoAtiva.ts
│   │   └── lib/
│   │       └── api.ts                # wrapper fetch para a API
│   └── public/
│       └── logo-formula.png
└── nginx/
    └── default.conf
```

---

## Fases de Desenvolvimento

### Fase 1 — Core funcional
- Schema SQL + migrations (Alembic)
- Tela de seleção de usuário com `localStorage`
- Endpoints de atividades e sessões
- Timer com restrição de sessão única
- Tela do funcionário: iniciar, pausar, finalizar, histórico

### Fase 2 — Admin e estrutura
- CRUD de usuários, construtoras, edifícios
- Auto-geração de lajes e atividades a partir de `num_pavimentos`
- Edição de status com log automático
- Visualização em árvore da estrutura completa

### Fase 3 — Dashboard
- WebSocket para atividades em tempo real
- Gráficos de progresso e produtividade (Recharts)
- Filtros por funcionário, prédio, período
- Exportação Excel

### Fase 4 — Estilização e entrega
- Implementação completa do design system (paleta Fórmula, tipografia, badges)
- Logo e identidade visual em todas as telas
- Ajustes finais com base no uso real pelos funcionários
- Documentação de uso para o admin

---

## Observações Finais

- Todos os campos de tempo devem usar `TIMESTAMPTZ` (com timezone) para evitar ambiguidades.
- O campo `duracao_segundos` em `sessoes_trabalho` é calculado e gravado ao `finalizar` — nunca inferido em tempo real para não perder dados se o browser fechar.
- A exportação Excel deve respeitar os mesmos filtros do dashboard para consistência.
- Novos tipos de elemento ou status podem ser adicionados futuramente via enum no banco — projetar os enums como extensíveis desde o início.
