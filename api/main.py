from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
import json
from contextlib import asynccontextmanager

from routers import usuarios, atividades, sessoes, construtoras, edificios, dashboard
from database import AsyncSessionLocal


async def ensure_analytics_indexes() -> None:
    statements = [
        "CREATE INDEX IF NOT EXISTS idx_sessoes_finalizado_em ON sessoes_trabalho (finalizado_em)",
        "CREATE INDEX IF NOT EXISTS idx_sessoes_usuario_finalizado ON sessoes_trabalho (usuario_id, finalizado_em)",
        "CREATE INDEX IF NOT EXISTS idx_sessoes_atividade_finalizado ON sessoes_trabalho (atividade_id, finalizado_em)",
        "CREATE INDEX IF NOT EXISTS idx_status_hist_timestamp ON status_historico (timestamp)",
        "CREATE INDEX IF NOT EXISTS idx_status_hist_usuario_timestamp ON status_historico (usuario_id, timestamp)",
        "CREATE INDEX IF NOT EXISTS idx_status_hist_status_novo_timestamp ON status_historico (status_novo, timestamp)",
        "CREATE INDEX IF NOT EXISTS idx_atividades_status_atual ON atividades (status_atual)",
        "CREATE INDEX IF NOT EXISTS idx_atividades_usuario_status ON atividades (usuario_responsavel_id, status_atual)",
        "CREATE INDEX IF NOT EXISTS idx_lajes_edificio_id ON lajes (edificio_id)",
        "CREATE INDEX IF NOT EXISTS idx_edificios_construtora_id ON edificios (construtora_id)",
        "CREATE INDEX IF NOT EXISTS idx_vinculos_maquina_usuario_id ON vinculos_maquina (usuario_id)",
        "CREATE INDEX IF NOT EXISTS idx_vinculos_maquina_ip ON vinculos_maquina (ip)",
        "CREATE INDEX IF NOT EXISTS idx_vinculos_maquina_historico_usuario_id ON vinculos_maquina_historico (usuario_id)",
    ]

    async with AsyncSessionLocal() as session:
        for stmt in statements:
            await session.execute(text(stmt))
        await session.commit()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup - Migrations should be handled via Alembic
    try:
        await ensure_analytics_indexes()
    except Exception as err:
        print(f"Falha ao garantir indices de analytics: {err}")
    yield
    # Shutdown

app = FastAPI(
    title="Fórmula Engenharia — Sistema de Atividades",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers with exact prefixes from GEMINI.md
app.include_router(usuarios.router,     prefix="/api/usuarios",     tags=["Usuários"])
app.include_router(construtoras.router, prefix="/api/construtoras", tags=["Construtoras"])
app.include_router(edificios.router,    prefix="/api/edificios",    tags=["Edifícios"])
app.include_router(atividades.router,   prefix="/api/atividades",   tags=["Atividades"])
app.include_router(sessoes.router)
app.include_router(dashboard.router,    prefix="/api/dashboard",    tags=["Dashboard"])

from routers.dashboard import manager, obter_payload_sessoes_ativas

@app.websocket("/api/dashboard/ws/tempo-real")
async def websocket_endpoint(websocket: WebSocket):
    # 1. Aceitar imediatamente para evitar erro de handshake
    await websocket.accept()
    await dashboard.manager.connect_only(websocket) # Apenas adiciona à lista sem re-aceitar
    
    try:
        # 2. Tentar carregar dados iniciais, mas não morrer se falhar
        try:
            async with AsyncSessionLocal() as db:
                payload = await dashboard.obter_payload_sessoes_ativas(db)
                await websocket.send_json(payload)
        except Exception as db_err:
            print(f"Erro ao carregar dados iniciais WS: {db_err}")
            await websocket.send_json({"tipo": "sessoes_ativas", "dados": []})

        # 3. Loop de vida
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        dashboard.manager.disconnect(websocket)
    except Exception as e:
        print(f"Conexão WS fechada: {e}")
        try:
            dashboard.manager.disconnect(websocket)
        except:
            pass

# Root message for health check
@app.get("/")
async def root():
    return {"message": "Bem-vindo à API do Sistema de Controle de Atividades - Fórmula Engenharia"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
