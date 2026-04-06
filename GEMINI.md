# GEMINI CLI — INSTRUÇÕES DE IMPLEMENTAÇÃO
## Sistema de Controle de Atividades · Fórmula Engenharia e Consultoria

---

## LEIA ANTES DE EXECUTAR QUALQUER COISA

Você está implementando um sistema web interno (intranet) para uma empresa de cálculo estrutural de pequeno porte (~10 usuários). O sistema roda em um servidor TrueNAS com Linux na rede local. Não há acesso à internet nos clientes. Não há autenticação com senha — identificação é feita via `localStorage` no browser.

Toda decisão de implementação deve priorizar, nesta ordem:
1. **Corretude funcional** — o timer não pode perder dados, o status não pode ser corrompido.
2. **Simplicidade de manutenção** — código que um dev júnior consiga entender e alterar.
3. **Fidelidade visual** — o sistema deve parecer profissional e refletir a identidade da Fórmula.

Quando tiver dúvida entre duas abordagens, escolha a mais simples que resolve o problema.

---

## CONTEXTO DO PROJETO

### O que o sistema faz

**Funcionário** abre o sistema, seleciona uma atividade (ex: "Vigas — Formato · Laje 3 · Ed. Sol Nascente"), clica em Iniciar. O timer começa. Quando termina, clica em Finalizar. O tempo é registrado e o status avança automaticamente.

**Admin** cadastra edifícios (o sistema gera todas as lajes e atividades automaticamente), edita qualquer status manualmente, e acompanha em tempo real quem está fazendo o quê via dashboard.

### Restrição crítica

**Um funcionário não pode ter duas sessões abertas simultaneamente.** Antes de qualquer `INSERT` em `sessoes_trabalho`, verificar se existe sessão com `finalizado_em IS NULL` para aquele `usuario_id`. Se existir, retornar HTTP 409 com mensagem identificando a atividade em andamento.

### Identificação de usuário

Sem senha. Sem agente. Sem leitura de hostname. No primeiro acesso ao browser, o usuário seleciona seu nome em uma lista de cards. O sistema salva `{ usuario_id, nome }` no `localStorage`. Nas visitas seguintes, lê o `localStorage` e entra direto. Botão "Trocar usuário" no rodapé da sidebar reseta o `localStorage` e volta para a tela de seleção.

---

## STACK

| Camada | Tecnologia | Versão |
|---|---|---|
| Backend | FastAPI + Python | 3.12+ |
| ORM | SQLAlchemy (async) + Alembic | latest |
| Banco | PostgreSQL | 16-alpine |
| Frontend | Next.js + TypeScript | 14+ (App Router) |
| Estilização | Tailwind CSS | 3.x |
| Ícones | lucide-react | latest |
| Gráficos | Recharts | latest |
| Tempo real | WebSocket nativo FastAPI | — |
| Deploy | Docker Compose | — |
| Servidor estático | Nginx | alpine |

---

## ESTRUTURA DE ARQUIVOS — CRIAR EXATAMENTE ASSIM

```
formula-sistema/
├── docker-compose.yml
├── .env.example
├── api/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py
│   ├── database.py
│   ├── models/
│   │   ├── __init__.py
│   │   ├── usuario.py
│   │   ├── construtora.py
│   │   ├── edificio.py
│   │   ├── laje.py
│   │   ├── atividade.py
│   │   ├── status_historico.py
│   │   └── sessao_trabalho.py
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── usuario.py
│   │   ├── edificio.py
│   │   ├── atividade.py
│   │   └── sessao.py
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── usuarios.py
│   │   ├── construtoras.py
│   │   ├── edificios.py
│   │   ├── atividades.py
│   │   ├── sessoes.py
│   │   └── dashboard.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── geracao_lajes.py    ← lógica de auto-geração
│   │   └── sessao_service.py   ← regra de sessão única
│   └── alembic/
│       ├── env.py
│       └── versions/
├── frontend/
│   ├── Dockerfile
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── public/
│   │   └── logo-formula.png
│   └── src/
│       ├── app/
│       │   ├── globals.css
│       │   ├── layout.tsx
│       │   ├── page.tsx               ← seleção de usuário
│       │   ├── dashboard/
│       │   │   └── page.tsx
│       │   ├── historico/
│       │   │   └── page.tsx
│       │   └── admin/
│       │       ├── page.tsx
│       │       ├── edificios/
│       │       │   └── page.tsx
│       │       └── usuarios/
│       │           └── page.tsx
│       ├── components/
│       │   ├── ui/
│       │   │   ├── Badge.tsx
│       │   │   ├── Button.tsx
│       │   │   ├── Card.tsx
│       │   │   ├── Modal.tsx
│       │   │   ├── Toast.tsx
│       │   │   ├── Input.tsx
│       │   │   ├── Table.tsx
│       │   │   └── EmptyState.tsx
│       │   ├── layout/
│       │   │   ├── Sidebar.tsx
│       │   │   ├── PageHeader.tsx
│       │   │   └── TimerBanner.tsx
│       │   ├── atividades/
│       │   │   ├── CardAtividade.tsx
│       │   │   └── ListaAtividades.tsx
│       │   ├── admin/
│       │   │   ├── ArvoreEstrutura.tsx
│       │   │   ├── ModalNovoEdificio.tsx
│       │   │   └── GraficoProgresso.tsx
│       │   └── usuario/
│       │       └── CardSelecao.tsx
│       ├── contexts/
│       │   └── SessaoContext.tsx      ← estado global do timer
│       ├── hooks/
│       │   ├── useUsuarioLocal.ts
│       │   ├── useSessaoAtiva.ts
│       │   ├── useTimer.ts
│       │   └── useWebSocket.ts
│       ├── lib/
│       │   ├── api.ts
│       │   ├── constants.ts
│       │   └── formatters.ts
│       └── types/
│           └── index.ts
└── nginx/
    └── default.conf
```

---

## BANCO DE DADOS — SCHEMA COMPLETO

Execute as migrations via Alembic. O schema SQL de referência:

```sql
CREATE TABLE usuarios (
    id        SERIAL PRIMARY KEY,
    nome      VARCHAR(100) NOT NULL,
    role      VARCHAR(20)  NOT NULL CHECK (role IN ('funcionario', 'admin')),
    ativo     BOOLEAN DEFAULT true,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE construtoras (
    id        SERIAL PRIMARY KEY,
    nome      VARCHAR(150) NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE edificios (
    id             SERIAL PRIMARY KEY,
    construtora_id INTEGER REFERENCES construtoras(id) ON DELETE RESTRICT,
    nome           VARCHAR(150) NOT NULL,
    descricao      TEXT,
    criado_em      TIMESTAMPTZ DEFAULT NOW(),
    encerrado_em   TIMESTAMPTZ
);

CREATE TABLE lajes (
    id          SERIAL PRIMARY KEY,
    edificio_id INTEGER REFERENCES edificios(id) ON DELETE CASCADE,
    tipo        VARCHAR(30) NOT NULL,
    ordem       INTEGER NOT NULL,
    criado_em   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE atividades (
    id                     SERIAL PRIMARY KEY,
    laje_id                INTEGER REFERENCES lajes(id) ON DELETE CASCADE,
    tipo_elemento          VARCHAR(30) NOT NULL,
    subtipo                VARCHAR(20),
    status_atual           VARCHAR(40) NOT NULL,
    usuario_responsavel_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    criado_em              TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE status_historico (
    id              SERIAL PRIMARY KEY,
    atividade_id    INTEGER REFERENCES atividades(id) ON DELETE CASCADE,
    usuario_id      INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    status_anterior VARCHAR(40),
    status_novo     VARCHAR(40) NOT NULL,
    timestamp       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sessoes_trabalho (
    id               SERIAL PRIMARY KEY,
    atividade_id     INTEGER REFERENCES atividades(id) ON DELETE CASCADE,
    usuario_id       INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    iniciado_em      TIMESTAMPTZ DEFAULT NOW(),
    finalizado_em    TIMESTAMPTZ,
    duracao_segundos INTEGER
);

-- Índices para performance
CREATE INDEX idx_sessoes_usuario_aberta ON sessoes_trabalho(usuario_id)
    WHERE finalizado_em IS NULL;
CREATE INDEX idx_atividades_laje ON atividades(laje_id);
CREATE INDEX idx_lajes_edificio ON lajes(edificio_id);
CREATE INDEX idx_historico_atividade ON status_historico(atividade_id);
```

### Regras de status por tipo

| tipo_elemento | subtipo | Progressão de status |
|---|---|---|
| Vigas | Rascunho | `Gerado` → `Impresso` → `Montada` |
| Vigas | Formato | `Fazendo` → `Ok` |
| Lajes | Rascunho | `Fazendo` → `Ok` |
| Lajes | Formato | `Fazendo` → `Atendendo comentarios` |
| GrelhaRefinada | null | `Fazendo` → `Ok` |
| Cortinas | null | `Fazendo` → `Ok` |
| Rampa | null | `Fazendo` → `Ok` |
| Escada | null | `Fazendo` → `Ok` |
| BlocosFundacao | null | `Fazendo` → `Ok` |

Vigas/Rascunho não vincula `usuario_responsavel_id` — apenas registra estado físico do documento.

Implementar a progressão como mapeamento em `constants.ts` (frontend) e `services/` (backend). Nunca hardcode inline.

---

## SERVIÇO DE AUTO-GERAÇÃO DE LAJES (`services/geracao_lajes.py`)

Dado `num_pavimentos: int`, gerar lajes na seguinte ordem:

```python
def gerar_lajes(num_pavimentos: int) -> list[dict]:
    lajes = []
    ordem = 1

    lajes.append({"tipo": "Fundacao", "ordem": ordem}); ordem += 1

    for n in range(1, num_pavimentos + 1):
        lajes.append({"tipo": f"Laje_{n}", "ordem": ordem}); ordem += 1

    lajes.append({"tipo": "FundCX", "ordem": ordem}); ordem += 1
    lajes.append({"tipo": "TampaCX", "ordem": ordem})

    return lajes
```

Para cada laje criada, inserir as seguintes atividades:

```python
ATIVIDADES_PADRAO = [
    {"tipo_elemento": "Vigas",          "subtipo": "Rascunho", "status_inicial": "Gerado"},
    {"tipo_elemento": "Vigas",          "subtipo": "Formato",  "status_inicial": "Fazendo"},
    {"tipo_elemento": "Lajes",          "subtipo": "Rascunho", "status_inicial": "Fazendo"},
    {"tipo_elemento": "Lajes",          "subtipo": "Formato",  "status_inicial": "Fazendo"},
    {"tipo_elemento": "GrelhaRefinada", "subtipo": None,       "status_inicial": "Fazendo"},
    {"tipo_elemento": "Cortinas",       "subtipo": None,       "status_inicial": "Fazendo"},
    {"tipo_elemento": "Rampa",          "subtipo": None,       "status_inicial": "Fazendo"},
    {"tipo_elemento": "Escada",         "subtipo": None,       "status_inicial": "Fazendo"},
    {"tipo_elemento": "BlocosFundacao", "subtipo": None,       "status_inicial": "Fazendo"},
]
```

Tudo isso em uma única transação de banco. Se qualquer insert falhar, fazer rollback completo.

---

## SERVIÇO DE SESSÃO (`services/sessao_service.py`)

```python
async def iniciar_sessao(usuario_id: int, atividade_id: int, db: AsyncSession):
    # 1. Verificar sessão aberta
    sessao_aberta = await db.execute(
        select(SessaoTrabalho)
        .where(SessaoTrabalho.usuario_id == usuario_id)
        .where(SessaoTrabalho.finalizado_em == None)
    )
    sessao = sessao_aberta.scalar_one_or_none()

    if sessao:
        # Buscar nome da atividade para mensagem de erro
        atividade = await db.get(Atividade, sessao.atividade_id)
        raise HTTPException(
            status_code=409,
            detail=f"Você já tem uma sessão ativa: {atividade.tipo_elemento} · {atividade.subtipo or ''}"
        )

    # 2. Criar sessão
    nova_sessao = SessaoTrabalho(
        atividade_id=atividade_id,
        usuario_id=usuario_id,
        iniciado_em=datetime.now(timezone.utc)
    )
    db.add(nova_sessao)

    # 3. Atualizar status da atividade para "Fazendo" + vincular usuário
    await db.execute(
        update(Atividade)
        .where(Atividade.id == atividade_id)
        .values(
            status_atual="Fazendo",
            usuario_responsavel_id=usuario_id,
            atualizado_em=datetime.now(timezone.utc)
        )
    )

    await db.commit()
    return nova_sessao

async def finalizar_sessao(sessao_id: int, usuario_id: int, db: AsyncSession):
    sessao = await db.get(SessaoTrabalho, sessao_id)

    if not sessao or sessao.usuario_id != usuario_id:
        raise HTTPException(status_code=404)

    if sessao.finalizado_em is not None:
        raise HTTPException(status_code=400, detail="Sessão já finalizada")

    agora = datetime.now(timezone.utc)
    duracao = int((agora - sessao.iniciado_em).total_seconds())

    sessao.finalizado_em = agora
    sessao.duracao_segundos = duracao

    # Avançar status da atividade
    atividade = await db.get(Atividade, sessao.atividade_id)
    proximo_status = obter_proximo_status(atividade.tipo_elemento, atividade.subtipo, atividade.status_atual)

    status_anterior = atividade.status_atual
    atividade.status_atual = proximo_status
    atividade.atualizado_em = agora

    # Registrar no histórico
    db.add(StatusHistorico(
        atividade_id=atividade.id,
        usuario_id=usuario_id,
        status_anterior=status_anterior,
        status_novo=proximo_status,
        timestamp=agora
    ))

    await db.commit()
    return sessao
```

---

## ENDPOINTS DA API

### Configuração base (`main.py`)

```python
app = FastAPI(title="Fórmula Engenharia — Sistema de Atividades")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://frontend:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(usuarios.router,     prefix="/api/usuarios",     tags=["Usuários"])
app.include_router(construtoras.router, prefix="/api/construtoras", tags=["Construtoras"])
app.include_router(edificios.router,    prefix="/api/edificios",    tags=["Edifícios"])
app.include_router(atividades.router,   prefix="/api/atividades",   tags=["Atividades"])
app.include_router(sessoes.router,      prefix="/api/sessoes",      tags=["Sessões"])
app.include_router(dashboard.router,    prefix="/api/dashboard",    tags=["Dashboard"])
```

### Endpoints por roteador

**`/api/usuarios`**
```
GET  /           → lista todos os usuários ativos (para tela de seleção)
POST /           → cria usuário (admin)
PUT  /{id}       → edita nome, role, ativo (admin)
```

**`/api/construtoras`**
```
GET  /           → lista construtoras
POST /           → cria construtora
```

**`/api/edificios`**
```
GET  /                    → lista edifícios com % de conclusão calculado
POST /                    → cria edifício + gera lajes + gera atividades (transação)
GET  /{id}/estrutura      → retorna árvore completa: edifício > lajes > atividades
PUT  /{id}                → edita nome, descrição, encerrado_em
```

**`/api/atividades`**
```
GET  /                    → atividades (query params: usuario_id, laje_id, status)
PUT  /{id}/status         → admin edita status manualmente (registra histórico)
GET  /{id}/historico      → histórico de mudanças de status
```

**`/api/sessoes`**
```
POST /                    → inicia sessão (verifica sessão única, 409 se aberta)
PUT  /{id}/finalizar      → encerra sessão + calcula duração + avança status
GET  /                    → histórico de sessões (query params: usuario_id, de, ate)
GET  /ativa?usuario_id=   → retorna sessão aberta atual ou null
```

**`/api/dashboard`**
```
GET  /progresso           → % conclusão por edifício, tempo total, nº funcionários
GET  /produtividade       → tempo por funcionário, filtros por período e edifício
GET  /ws/tempo-real       → WebSocket — broadcast de atualizações em tempo real
```

### WebSocket (`/api/dashboard/ws/tempo-real`)

O WebSocket mantém uma lista de conexões abertas. Sempre que uma sessão é iniciada ou finalizada, o `sessao_service` dispara um broadcast com o estado atual de todas as sessões abertas:

```python
# Estrutura do payload broadcast
{
  "tipo": "sessoes_ativas",
  "dados": [
    {
      "usuario_id": 1,
      "usuario_nome": "João",
      "atividade_id": 42,
      "atividade_descricao": "Vigas — Formato",
      "edificio_nome": "Ed. Sol Nascente",
      "laje_tipo": "Laje_3",
      "iniciado_em": "2024-01-15T09:23:00Z"
    }
  ]
}
```

---

## FRONTEND — TIPOS (`src/types/index.ts`)

```typescript
export type Role = 'funcionario' | 'admin'

export interface Usuario {
  id: number
  nome: string
  role: Role
  ativo: boolean
  criado_em: string
}

export type TipoElemento =
  | 'Vigas' | 'Lajes' | 'GrelhaRefinada'
  | 'Cortinas' | 'Rampa' | 'Escada' | 'BlocosFundacao'

export type Subtipo = 'Rascunho' | 'Formato' | null

export type StatusAtividade =
  | 'Gerado' | 'Impresso' | 'Montada'
  | 'Fazendo' | 'Ok' | 'Atendendo comentarios'

export interface Atividade {
  id: number
  laje_id: number
  tipo_elemento: TipoElemento
  subtipo: Subtipo
  status_atual: StatusAtividade
  usuario_responsavel_id: number | null
  criado_em: string
  atualizado_em: string
}

export interface Laje {
  id: number
  edificio_id: number
  tipo: string
  ordem: number
  atividades: Atividade[]
}

export interface Edificio {
  id: number
  construtora_id: number
  construtora_nome: string
  nome: string
  descricao: string | null
  criado_em: string
  encerrado_em: string | null
  percentual_conclusao: number
}

export interface SessaoTrabalho {
  id: number
  atividade_id: number
  usuario_id: number
  iniciado_em: string
  finalizado_em: string | null
  duracao_segundos: number | null
}

export interface UsuarioLocal {
  usuario_id: number
  nome: string
  role: Role
}
```

---

## FRONTEND — CONSTANTES (`src/lib/constants.ts`)

```typescript
export const PROGRESSAO_STATUS: Record<string, Record<string, string>> = {
  'Vigas-Rascunho':  { 'Gerado': 'Impresso', 'Impresso': 'Montada' },
  'Vigas-Formato':   { 'Fazendo': 'Ok' },
  'Lajes-Rascunho':  { 'Fazendo': 'Ok' },
  'Lajes-Formato':   { 'Fazendo': 'Atendendo comentarios' },
  'GrelhaRefinada':  { 'Fazendo': 'Ok' },
  'Cortinas':        { 'Fazendo': 'Ok' },
  'Rampa':           { 'Fazendo': 'Ok' },
  'Escada':          { 'Fazendo': 'Ok' },
  'BlocosFundacao':  { 'Fazendo': 'Ok' },
}

export function obterProximoStatus(
  tipoElemento: string,
  subtipo: string | null,
  statusAtual: string
): string | null {
  const chave = subtipo ? `${tipoElemento}-${subtipo}` : tipoElemento
  return PROGRESSAO_STATUS[chave]?.[statusAtual] ?? null
}

export function formatarTipoElemento(tipo: string, subtipo: string | null): string {
  const nomes: Record<string, string> = {
    Vigas: 'Vigas', Lajes: 'Lajes',
    GrelhaRefinada: 'Grelha refinada', Cortinas: 'Cortinas',
    Rampa: 'Rampa', Escada: 'Escada', BlocosFundacao: 'Blocos de fundação',
  }
  const base = nomes[tipo] ?? tipo
  return subtipo ? `${base} — ${subtipo}` : base
}

export function formatarLaje(tipo: string): string {
  if (tipo === 'Fundacao') return 'Fundação'
  if (tipo === 'FundCX')   return 'FundCX'
  if (tipo === 'TampaCX')  return 'TampaCX'
  const match = tipo.match(/^Laje_(\d+)$/)
  if (match) return `Laje ${match[1]}`
  return tipo
}

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
```

---

## FRONTEND — API WRAPPER (`src/lib/api.ts`)

```typescript
import { API_BASE } from './constants'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!res.ok) {
    const erro = await res.json().catch(() => ({ detail: 'Erro desconhecido' }))
    throw new Error(erro.detail ?? `HTTP ${res.status}`)
  }

  return res.json() as Promise<T>
}

export const api = {
  get:    <T>(path: string)                  => request<T>(path),
  post:   <T>(path: string, body: unknown)   => request<T>(path, { method: 'POST',  body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown)   => request<T>(path, { method: 'PUT',   body: JSON.stringify(body) }),
  delete: <T>(path: string)                  => request<T>(path, { method: 'DELETE' }),
}
```

---

## FRONTEND — HOOK `useUsuarioLocal` (`src/hooks/useUsuarioLocal.ts`)

```typescript
import { useState, useEffect } from 'react'
import type { UsuarioLocal } from '@/types'

const STORAGE_KEY = 'formula_usuario'

export function useUsuarioLocal() {
  const [usuario, setUsuario] = useState<UsuarioLocal | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    const salvo = localStorage.getItem(STORAGE_KEY)
    if (salvo) {
      try { setUsuario(JSON.parse(salvo)) } catch { localStorage.removeItem(STORAGE_KEY) }
    }
    setCarregando(false)
  }, [])

  function salvarUsuario(u: UsuarioLocal) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
    setUsuario(u)
  }

  function limparUsuario() {
    localStorage.removeItem(STORAGE_KEY)
    setUsuario(null)
  }

  return { usuario, carregando, salvarUsuario, limparUsuario }
}
```

---

## FRONTEND — HOOK `useTimer` (`src/hooks/useTimer.ts`)

```typescript
import { useState, useEffect, useRef } from 'react'

export function useTimer(iniciado_em: string | null) {
  const [segundos, setSegundos] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!iniciado_em) {
      setSegundos(0)
      return
    }

    const calcular = () => {
      const diff = Math.floor((Date.now() - new Date(iniciado_em).getTime()) / 1000)
      setSegundos(Math.max(0, diff))
    }

    calcular()
    intervalRef.current = setInterval(calcular, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [iniciado_em])

  return segundos
}
```

---

## FRONTEND — FORMATTER (`src/lib/formatters.ts`)

```typescript
export function formatarDuracao(segundos: number): string {
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  const s = segundos % 60
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':')
}

export function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export function formatarDataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  })
}
```

---

## FRONTEND — DESIGN SYSTEM (`src/app/globals.css`)

Inserir no início do arquivo, após os imports do Tailwind:

```css
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700&family=DM+Sans:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  /* Verdes — marca Fórmula */
  --verde-principal:       #5a8a4a;
  --verde-hover:           #3b6d11;
  --verde-claro:           #eaf3de;
  --verde-texto:           #27500a;

  /* Cinzas */
  --cinza-900:             #1e1e1c;
  --cinza-800:             #2c2c2a;
  --cinza-600:             #6b6b6b;
  --cinza-300:             #b4b2a9;
  --cinza-100:             #f1efe8;
  --cinza-50:              #f8f7f4;
  --branco:                #ffffff;

  /* Status */
  --status-fazendo-bg:     #e6f1fb;
  --status-fazendo-text:   #185fa5;
  --status-ok-bg:          #eaf3de;
  --status-ok-text:        #27500a;
  --status-atend-bg:       #faeeda;
  --status-atend-text:     #854f0b;
  --status-gerado-bg:      #f1efe8;
  --status-gerado-text:    #5f5e5a;
  --status-impresso-bg:    #d3d1c7;
  --status-impresso-text:  #2c2c2a;
  --status-montada-bg:     #2c2c2a;
  --status-montada-text:   #f1efe8;

  /* Feedback */
  --erro:                  #e24b4a;
  --aviso:                 #ba7517;
  --sucesso:               #3b6d11;
}

[data-theme="dark"] {
  --cinza-100:  #1e1e1c;
  --cinza-50:   #2c2c2a;
  --branco:     #1e1e1c;
  --cinza-800:  #f1efe8;
  --cinza-600:  #b4b2a9;
  --cinza-300:  #444441;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'DM Sans', sans-serif;
  font-size: 15px;
  color: var(--cinza-800);
  background: var(--cinza-100);
  -webkit-font-smoothing: antialiased;
}

/* Focus visible global */
:focus-visible {
  outline: 2px solid var(--verde-principal);
  outline-offset: 2px;
}

/* Animações globais */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}

@keyframes slide-up {
  from { transform: translateY(12px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}

@keyframes slide-down {
  from { transform: translateY(-100%); opacity: 0; }
  to   { transform: translateY(0);     opacity: 1; }
}

@keyframes fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes toast-in {
  from { transform: translateX(20px); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## FRONTEND — COMPONENTE `StatusBadge` (`src/components/ui/Badge.tsx`)

```tsx
import type { StatusAtividade } from '@/types'

const VARIANTES: Record<StatusAtividade, { bg: string; text: string; dot: boolean; label: string }> = {
  'Fazendo':               { bg: 'var(--status-fazendo-bg)',  text: 'var(--status-fazendo-text)',  dot: true,  label: 'Fazendo' },
  'Ok':                    { bg: 'var(--status-ok-bg)',       text: 'var(--status-ok-text)',       dot: false, label: 'Ok' },
  'Atendendo comentarios': { bg: 'var(--status-atend-bg)',    text: 'var(--status-atend-text)',    dot: false, label: 'Atendendo comentários' },
  'Gerado':                { bg: 'var(--status-gerado-bg)',   text: 'var(--status-gerado-text)',   dot: false, label: 'Gerado' },
  'Impresso':              { bg: 'var(--status-impresso-bg)', text: 'var(--status-impresso-text)', dot: false, label: 'Impresso' },
  'Montada':               { bg: 'var(--status-montada-bg)',  text: 'var(--status-montada-text)',  dot: false, label: 'Montada — pronto para imprimir' },
}

interface Props {
  status: StatusAtividade
  onClick?: () => void
}

export function StatusBadge({ status, onClick }: Props) {
  const v = VARIANTES[status]
  return (
    <span
      onClick={onClick}
      aria-label={`Status: ${v.label}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        background: v.bg, color: v.text,
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: '12px', fontWeight: 600,
        letterSpacing: '0.07em', textTransform: 'uppercase',
        padding: '3px 8px', borderRadius: '3px',
        cursor: onClick ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
      }}
    >
      {v.dot && (
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'currentColor',
          animation: 'pulse 1.8s ease-in-out infinite',
          flexShrink: 0,
        }} />
      )}
      {status === 'Ok' && '✓ '}
      {v.label}
    </span>
  )
}
```

---

## FRONTEND — COMPONENTE `TimerBanner` (`src/components/layout/TimerBanner.tsx`)

```tsx
'use client'
import { useTimer } from '@/hooks/useTimer'
import { formatarDuracao, formatarTipoElemento } from '@/lib/formatters'
import type { SessaoTrabalho, Atividade } from '@/types'

interface Props {
  sessao: SessaoTrabalho
  atividade: Atividade
  edificioNome: string
  lajeTipo: string
  onFinalizar: () => void
}

export function TimerBanner({ sessao, atividade, edificioNome, lajeTipo, onFinalizar }: Props) {
  const segundos = useTimer(sessao.iniciado_em)

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 10,
      background: 'var(--verde-principal)', color: '#fff',
      padding: '12px 32px',
      display: 'flex', alignItems: 'center', gap: '16px',
      fontFamily: "'Barlow Condensed', sans-serif",
      fontSize: '15px', fontWeight: 500, letterSpacing: '0.04em',
      animation: 'slide-down 250ms ease',
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%', background: '#fff', flexShrink: 0,
        animation: 'pulse 1.8s ease-in-out infinite',
      }} />
      <span>Em andamento</span>
      <span style={{ color: 'rgba(255,255,255,0.75)' }}>
        {formatarTipoElemento(atividade.tipo_elemento, atividade.subtipo)}
        {' · '}{lajeTipo}{' · '}{edificioNome}
      </span>
      <span style={{
        marginLeft: 'auto',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '22px', fontWeight: 500,
      }}
        aria-live="polite"
        aria-label={`Tempo decorrido: ${formatarDuracao(segundos)}`}
      >
        {formatarDuracao(segundos)}
      </span>
      <button
        onClick={onFinalizar}
        style={{
          background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
          color: '#fff', borderRadius: '4px', padding: '6px 16px',
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px',
          fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        Finalizar
      </button>
    </div>
  )
}
```

---

## FRONTEND — LAYOUT GERAL (`src/app/layout.tsx`)

```tsx
import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/layout/Sidebar'
import { SessaoProvider } from '@/contexts/SessaoContext'

export const metadata: Metadata = {
  title: 'Fórmula Engenharia — Atividades',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <SessaoProvider>
          <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            <Sidebar />
            <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {children}
            </main>
          </div>
        </SessaoProvider>
      </body>
    </html>
  )
}
```

A página raiz `/` (`src/app/page.tsx`) verifica o `localStorage`:
- Se `formula_usuario` existir → redireciona para `/dashboard` (funcionário) ou `/admin` (admin)
- Se não existir → renderiza a tela de seleção de usuário

---

## DOCKER COMPOSE

```yaml
version: '3.9'

services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: formula_db
      POSTGRES_USER: formula
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U formula -d formula_db"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build: ./api
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql+asyncpg://formula:${DB_PASSWORD}@db:5432/formula_db
    ports:
      - "8000:8000"
    depends_on:
      db:
        condition: service_healthy

  frontend:
    build: ./frontend
    restart: unless-stopped
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000
    ports:
      - "3000:3000"
    depends_on:
      - api

volumes:
  pgdata:
```

**`.env.example`:**
```
DB_PASSWORD=troque_esta_senha
```

---

## NGINX (`nginx/default.conf`)

Usado apenas se o frontend for servido como export estático:

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api {
    proxy_pass http://api:8000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }
}
```

---

## ORDEM DE EXECUÇÃO — FASE 1 (Core funcional)

Execute nesta sequência. Não avance para o próximo item sem o anterior funcionando e testável.

```
1.  [X] Criar estrutura de diretórios completa
2.  [X] docker-compose.yml + .env.example
3.  [X] api/database.py (conexão async + sessão)
4.  [X] api/models/ (todos os 7 models SQLAlchemy)
5.  [X] Alembic init + primeira migration (criar todas as tabelas)
6.  [X] docker compose up db → verificar conexão
7.  [X] api/services/geracao_lajes.py
8.  [X] api/services/sessao_service.py
9.  [X] api/routers/usuarios.py (GET / e POST /)
10. [X] api/routers/construtoras.py
11. [X] api/routers/edificios.py (POST / com geração automática)
12. [X] api/routers/sessoes.py (POST / e PUT /{id}/finalizar)
13. [X] docker compose up api → testar endpoints com curl
14. [X] frontend/src/app/globals.css (variáveis + fontes + animações)
15. [X] src/types/index.ts
16. [X] src/lib/constants.ts + formatters.ts + api.ts
17. [X] src/hooks/useUsuarioLocal.ts + useTimer.ts
18. [X] src/contexts/SessaoContext.tsx
19. [X] src/app/page.tsx (tela de seleção de usuário)
20. [X] src/components/ui/Badge.tsx (StatusBadge)
21. [X] src/components/layout/Sidebar.tsx
22. [X] src/components/layout/TimerBanner.tsx
23. [X] src/components/atividades/CardAtividade.tsx
24. [X] src/app/dashboard/page.tsx (tela principal do funcionário)
25. [X] docker compose up → teste end-to-end: selecionar usuário → iniciar → timer → finalizar
```

---

## ORDEM DE EXECUÇÃO — FASE 2 (Admin e estrutura)

```
26. [X] api/routers/atividades.py (PUT /{id}/status com histórico)
27. [X] api/routers/edificios.py (GET /{id}/estrutura — árvore completa)
28. [ ] src/components/admin/ArvoreEstrutura.tsx
29. [X] src/components/admin/ModalNovoEdificio.tsx (estilos e funcionalidade)
30. [X] src/app/admin/edificios/page.tsx
31. [X] src/app/admin/usuarios/page.tsx
32. [X] Guardar role no localStorage e usar para roteamento (via UsuarioContext)
```

---

## ORDEM DE EXECUÇÃO — FASE 3 (Dashboard)

```
33. [X] api/routers/dashboard.py (GET /progresso, GET /produtividade)
34. [X] api/routers/dashboard.py (WebSocket /ws/tempo-real movido para main.py)
35. [X] src/hooks/useWebSocket.ts
36. [ ] src/components/admin/GraficoProgresso.tsx (Recharts)
37. [ ] src/app/admin/page.tsx (dashboard completo)
38. [ ] src/app/historico/page.tsx (histórico do funcionário com totais)
```

---

## ORDEM DE EXECUÇÃO — FASE 4 (Polimento visual)

```
39. [X] Aplicar Barlow Condensed em todos os headings e labels uppercase
40. [X] Revisar todos os componentes: usar variáveis CSS, não cores hardcoded
41. [X] Adicionar animações de entrada (Framer Motion no Modal)
42. [X] Estados vazios em todas as listas (Filtros no Dashboard)
43. [ ] aria-label em botões icon-only
44. [X] Modal com estilos inline puros e centralizado
45. [ ] Toast (componente + ToastProvider + useToast hook)
46. [ ] Testar dark mode toggle
47. [ ] Logo da Fórmula na sidebar (logo-formula.png, 180px largura)
48. [X] Revisão final: contraste, espaçamentos múltiplos de 4px, fontes corretas
```

---

## REGRAS DE QUALIDADE — NÃO NEGOCIÁVEIS

- **Nunca usar `any` no TypeScript.** Se não souber o tipo, usar `unknown` e narrowing.
- **Nunca hardcodar strings de status.** Sempre usar as constantes de `constants.ts`.
- **Nunca calcular duração no frontend para salvar.** `duracao_segundos` é sempre calculado e gravado pelo backend no momento do `finalizar`.
- **Nunca usar cores hex diretamente no JSX/TSX.** Sempre usar variáveis CSS via `style={{ color: 'var(--cinza-800)' }}` ou classes Tailwind mapeadas para as variáveis.
- **Todo INSERT em `sessoes_trabalho` passa pelo `sessao_service.iniciar_sessao`.** Nunca inserir direto no router.
- **Todo campo de tempo usa `TIMESTAMPTZ`.** Nunca `TIMESTAMP` sem timezone.
- **Toda mudança de status registra em `status_historico`.** Sem exceção, incluindo edições manuais do admin.
- **O campo `duracao_segundos` nunca pode ser null em uma sessão finalizada.** Calcular e gravar atomicamente no `finalizar`.
