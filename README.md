# Sistema de Controle de Atividades — Fórmula Engenharia

Sistema web para gerenciamento de atividades de obras, controle de sessões de trabalho por funcionário e acompanhamento em tempo real do progresso por edifício/laje.

---

## Visão Geral

A plataforma organiza atividades numa hierarquia **Construtora → Edifício → Laje → Atividade** e permite que funcionários registrem sessões de trabalho vinculadas à máquina (IP) que estão usando. Administradores acompanham o andamento em um dashboard em tempo real via WebSocket e exportam relatórios em Excel.

### Principais funcionalidades

- Cadastro de construtoras, edifícios, lajes e atividades
- Controle de sessões de trabalho (iniciar, pausar, finalizar)
- Vínculo automático de funcionário ↔ máquina por IP
- Dashboard em tempo real (WebSocket) com sessões ativas e progresso por edifício
- Histórico de sessões com filtros por período
- Exportação de relatórios em Excel
- Papéis distintos: **Funcionário** e **Admin**
- Dark mode com persistência em `localStorage`

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Backend | Python 3.12 · FastAPI · SQLAlchemy (async) · Alembic · PostgreSQL 16 |
| Frontend | Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 |
| Infra | Docker · Docker Compose |
| Extras | WebSockets · XlsxWriter · Recharts · Framer Motion |

---

## Estrutura do Repositório

```
.
├── api/                  # Backend FastAPI
│   ├── routers/          # Endpoints REST (usuarios, atividades, sessoes, edificios, dashboard…)
│   ├── models/           # Modelos SQLAlchemy
│   ├── services/         # Regras de negócio
│   ├── alembic/          # Migrações do banco
│   ├── schemas.py        # Schemas Pydantic
│   ├── database.py       # Configuração de conexão assíncrona
│   └── main.py           # Entrypoint da aplicação
├── frontend/             # Frontend Next.js
│   └── src/
│       ├── app/          # Rotas (dashboard, historico, admin/…)
│       ├── components/   # Componentes reutilizáveis
│       ├── context/      # Contextos React (sessão ativa, tema…)
│       ├── hooks/        # Custom hooks
│       ├── lib/          # Utilitários e cliente de API
│       └── types/        # Tipos TypeScript
├── docs/
│   └── tasks.md          # Guia de instalação e operação
├── docker-compose.yml
└── .env                  # Variáveis de ambiente (não versionado)
```

---

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) ≥ 24
- [Docker Compose](https://docs.docker.com/compose/) v2
- Git

---

## Início Rápido (desenvolvimento local)

### 1. Clone o repositório

```bash
git clone <URL_DO_REPOSITORIO>
cd sistema-controle-atividades
```

### 2. Configure as variáveis de ambiente

```bash
# Crie o arquivo .env na raiz do projeto
cat > .env << 'EOF'
DB_PASSWORD=senha_local_forte
EOF
```

> Para acessar o frontend de outras máquinas na rede, edite `docker-compose.yml` e ajuste `NEXT_PUBLIC_API_URL` para o IP do host (ex.: `http://192.168.0.10:8000`).

### 3. Suba a stack

```bash
docker compose up -d --build
```

### 4. Execute as migrações do banco

```bash
docker compose exec api alembic upgrade head
```

### 5. (Opcional) Popule dados de exemplo

```bash
docker compose exec api python /app/seed_mock_real.py
```

### 6. Acesse a aplicação

| Serviço | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API REST | http://localhost:8000 |
| Docs interativos | http://localhost:8000/docs |

---

## Endpoints da API

| Prefixo | Descrição |
|---|---|
| `GET /` | Health check |
| `/api/usuarios` | CRUD de usuários |
| `/api/construtoras` | CRUD de construtoras |
| `/api/edificios` | CRUD de edifícios e lajes |
| `/api/atividades` | CRUD e transições de status de atividades |
| `/api/sessoes` | Controle de sessões de trabalho |
| `/api/dashboard` | Dados de progresso e sessões ativas |
| `WS /api/dashboard/ws/tempo-real` | WebSocket de atualizações em tempo real |

A documentação interativa completa está disponível em `/docs` (Swagger UI) após subir a API.

---

## Regras de Negócio Principais

- Um funcionário só pode ter **1 atividade em andamento** por vez.
- Cada atividade aceita **1 vínculo ativo** por vez; roubo de vínculo só é permitido quando a tarefa está **pausada**.
- A finalização de uma atividade só é permitida na **última etapa**.
- O vínculo de máquina é feito por IP: ao fazer login em um dispositivo novo, o funcionário é associado àquele IP automaticamente.

---

## Operação e Manutenção

```bash
# Logs da API
docker compose logs -f api

# Logs do frontend
docker compose logs -f frontend

# Atualizar para nova versão
git pull
docker compose up -d --build
docker compose exec api alembic upgrade head

# Backup do banco
docker compose exec db pg_dump -U formula formula_db > backup_formula_db.sql
```

---

## Deploy em Produção (TrueNAS Scale)

Consulte o guia detalhado em [`docs/tasks.md`](docs/tasks.md), que cobre:

- Verificação de ambiente (Docker disponível no host)
- Alternativa via Apps/Kubernetes do TrueNAS quando o daemon Docker não está acessível no shell
- Checklist de go-live

---

## Desenvolvimento

### Backend

```bash
cd api
pip install -r requirements.txt
# Configurar DATABASE_URL no ambiente
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev       # servidor de desenvolvimento em http://localhost:3000
npm run build     # build de produção
npm run lint      # análise estática
```

---

## Licença

Projeto privado — Fórmula Engenharia. Todos os direitos reservados.
