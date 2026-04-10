from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from database import get_db
from datetime import datetime, timezone
import models
import schemas
from services import workflow

router = APIRouter(prefix="", tags=["Atividades"])


# ── Carregamento padrão ────────────────────────────────────────────────────

def _atividade_relacoes():
    return (
        selectinload(models.Atividade.laje)
        .selectinload(models.Laje.edificio)
        .selectinload(models.Edificio.construtora),
        selectinload(models.Atividade.usuario_responsavel),
    )


async def _get_atividade_ou_404(atividade_id: int, db: AsyncSession) -> models.Atividade:
    result = await db.execute(
        select(models.Atividade)
        .where(models.Atividade.id == atividade_id)
        .options(*_atividade_relacoes())
    )
    atividade = result.scalar_one_or_none()
    if not atividade:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")
    return atividade


async def _broadcast():
    try:
        from routers.dashboard import manager, obter_payload_sessoes_ativas
        from database import AsyncSessionLocal
        async with AsyncSessionLocal() as db2:
            payload = await obter_payload_sessoes_ativas(db2)
            await manager.broadcast(payload)
    except Exception:
        pass


# ── Endpoints de leitura ───────────────────────────────────────────────────

@router.get("/", response_model=List[schemas.Atividade])
async def read_atividades(
    usuario_id: Optional[int] = None,
    laje_id: Optional[int] = None,
    status: Optional[str] = None,
    status_ciclo: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(models.Atividade).options(*_atividade_relacoes())
    if usuario_id:
        query = query.where(models.Atividade.usuario_responsavel_id == usuario_id)
    if laje_id:
        query = query.where(models.Atividade.laje_id == laje_id)
    if status:
        query = query.where(models.Atividade.status_atual == status)
    if status_ciclo:
        query = query.where(models.Atividade.status_ciclo == status_ciclo)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{atividade_id}", response_model=schemas.Atividade)
async def read_atividade(atividade_id: int, db: AsyncSession = Depends(get_db)):
    return await _get_atividade_ou_404(atividade_id, db)


@router.get("/{atividade_id}/detalhe", response_model=schemas.AtividadeDetalhe)
async def get_atividade_detalhe(atividade_id: int, db: AsyncSession = Depends(get_db)):
    atividade = await _get_atividade_ou_404(atividade_id, db)

    data_sessoes = await db.execute(
        select(
            func.min(models.SessaoTrabalho.iniciado_em),
            func.max(models.SessaoTrabalho.finalizado_em),
        ).where(models.SessaoTrabalho.atividade_id == atividade_id)
    )
    iniciada_em, finalizada_em = data_sessoes.one()

    sessao_ativa = await db.execute(
        select(models.SessaoTrabalho.iniciado_em).where(
            models.SessaoTrabalho.atividade_id == atividade_id,
            models.SessaoTrabalho.finalizado_em == None,
        ).order_by(models.SessaoTrabalho.iniciado_em.desc())
    )
    em_andamento_desde = sessao_ativa.scalars().first()

    # Tempo total por usuário
    rows_tempo = await db.execute(
        select(
            models.SessaoTrabalho.usuario_id,
            func.sum(models.SessaoTrabalho.duracao_segundos).label('total'),
        ).where(
            models.SessaoTrabalho.atividade_id == atividade_id,
            models.SessaoTrabalho.duracao_segundos != None,
        ).group_by(models.SessaoTrabalho.usuario_id)
    )
    tempo_raw = rows_tempo.all()

    tempo_por_usuario = []
    if tempo_raw:
        usuario_ids = [r.usuario_id for r in tempo_raw]
        res_usuarios = await db.execute(
            select(models.Usuario).where(models.Usuario.id.in_(usuario_ids))
        )
        usuarios_map = {u.id: u for u in res_usuarios.scalars().all()}
        for row in tempo_raw:
            usuario = usuarios_map.get(row.usuario_id)
            if usuario:
                tempo_por_usuario.append(
                    schemas.TempoPorUsuario(usuario=usuario, tempo_segundos=int(row.total))
                )

    return schemas.AtividadeDetalhe(
        atividade=atividade,
        usuario_vinculado=atividade.usuario_responsavel,
        iniciada_em=iniciada_em,
        finalizada_em=finalizada_em,
        em_andamento_desde=em_andamento_desde,
        tempo_por_usuario=tempo_por_usuario,
    )


@router.get("/{atividade_id}/acoes", response_model=schemas.AcoesDisponiveis)
async def get_acoes_disponiveis(
    atividade_id: int,
    usuario_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Retorna as ações permitidas para o usuário no estado atual da atividade."""
    atividade = await _get_atividade_ou_404(atividade_id, db)

    sessao_aberta = await workflow._sessao_ativa_usuario(usuario_id, db)
    tem_outra = sessao_aberta is not None and sessao_aberta.atividade_id != atividade_id

    acoes = workflow.acoes_disponiveis(atividade, usuario_id, tem_outra)
    return schemas.AcoesDisponiveis(
        atividade_id=atividade_id,
        status_ciclo=atividade.status_ciclo,
        etapa_atual=atividade.etapa_atual,
        etapa_total=atividade.etapa_total,
        acoes=acoes,
    )


@router.get("/{atividade_id}/historico", response_model=List[schemas.StatusHistorico])
async def get_atividade_historico(atividade_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.StatusHistorico)
        .where(models.StatusHistorico.atividade_id == atividade_id)
        .order_by(models.StatusHistorico.timestamp.desc())
    )
    return result.scalars().all()


# ── Endpoints de ação (novo modelo) ───────────────────────────────────────

@router.post("/{atividade_id}/iniciar", response_model=schemas.Atividade)
async def iniciar_atividade(
    atividade_id: int,
    usuario_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Inicia uma tarefa Pendente, vinculando o funcionário e abrindo sessão."""
    atividade = await _get_atividade_ou_404(atividade_id, db)
    await workflow.iniciar(atividade, usuario_id, db)
    await db.commit()
    await _broadcast()
    return await _get_atividade_ou_404(atividade_id, db)


@router.post("/{atividade_id}/pausar", response_model=schemas.Atividade)
async def pausar_atividade(
    atividade_id: int,
    usuario_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Pausa uma tarefa Em andamento, fechando a sessão ativa."""
    atividade = await _get_atividade_ou_404(atividade_id, db)
    await workflow.pausar(atividade, usuario_id, db)
    await db.commit()
    await _broadcast()
    return await _get_atividade_ou_404(atividade_id, db)


@router.post("/{atividade_id}/retomar", response_model=schemas.Atividade)
async def retomar_atividade(
    atividade_id: int,
    usuario_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Retoma uma tarefa Pausada, abrindo nova sessão (roubo de vínculo permitido)."""
    atividade = await _get_atividade_ou_404(atividade_id, db)
    await workflow.retomar(atividade, usuario_id, db)
    await db.commit()
    await _broadcast()
    return await _get_atividade_ou_404(atividade_id, db)


@router.post("/{atividade_id}/avancar-etapa", response_model=schemas.Atividade)
async def avancar_etapa_atividade(
    atividade_id: int,
    usuario_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Avança para a próxima etapa (requer Pausada ou Em andamento pelo próprio vinculado)."""
    atividade = await _get_atividade_ou_404(atividade_id, db)
    await workflow.avancar_etapa(atividade, usuario_id, db)
    await db.commit()
    return await _get_atividade_ou_404(atividade_id, db)


@router.post("/{atividade_id}/finalizar", response_model=schemas.Atividade)
async def finalizar_atividade(
    atividade_id: int,
    usuario_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Finaliza uma tarefa na última etapa."""
    atividade = await _get_atividade_ou_404(atividade_id, db)
    await workflow.finalizar(atividade, usuario_id, db)
    await db.commit()
    await _broadcast()
    return await _get_atividade_ou_404(atividade_id, db)


# ── Endpoints legados (compatibilidade admin) ──────────────────────────────

@router.get("/{atividade_id}/proximos-status", response_model=schemas.ProximosStatusAtividade)
async def get_proximos_status(
    atividade_id: int,
    modo_admin: bool = False,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models.Atividade).where(models.Atividade.id == atividade_id)
    )
    atividade = result.scalar_one_or_none()
    if not atividade:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")

    opcoes = workflow.opcoes_avanco(atividade.tipo_elemento, atividade.subtipo, atividade.status_atual)

    if modo_admin and not opcoes and atividade.status_atual == "Pendente" and workflow.vincula_funcionario(atividade.tipo_elemento, atividade.subtipo):
        opcoes = [
            s for s in workflow.transicoes_validas(atividade.tipo_elemento, atividade.subtipo, "Fazendo")
            if s != "Fazendo"
        ]

    return schemas.ProximosStatusAtividade(
        atividade_id=atividade.id,
        status_atual=atividade.status_atual,
        opcoes=opcoes,
        selecao_obrigatoria=len(opcoes) > 1,
    )


@router.put("/{atividade_id}/status", response_model=schemas.Atividade)
async def update_atividade_status(
    atividade_id: int,
    usuario_id: int,
    status_novo: Optional[schemas.StatusAtividade] = None,
    db: AsyncSession = Depends(get_db),
):
    """Legado: transição direta de status (admin). Prefira os endpoints de ação."""
    atividade = await _get_atividade_ou_404(atividade_id, db)

    if status_novo == "Fazendo" and workflow.vincula_funcionario(atividade.tipo_elemento, atividade.subtipo):
        raise HTTPException(400, "Use POST /iniciar ou /retomar para mudar para Em andamento.")

    if status_novo is None:
        opcoes = workflow.opcoes_avanco(atividade.tipo_elemento, atividade.subtipo, atividade.status_atual)
        if not opcoes:
            raise HTTPException(400, "Atividade sem próximo status disponível")
        if len(opcoes) > 1:
            raise HTTPException(400, "Seleção de próximo status é obrigatória")
        status_novo = opcoes[0]

    workflow.validar_transicao(atividade.tipo_elemento, atividade.subtipo, atividade.status_atual, status_novo)

    status_anterior = atividade.status_atual
    atividade.status_atual = status_novo
    atividade.atualizado_em = datetime.now(timezone.utc)

    # Sincroniza status_ciclo com legado
    mapa = {
        "Pendente": "Pendente",
        "Fazendo": "Em andamento",
        "Pausado": "Pausada",
        "Ok": "Finalizada", "Montada": "Finalizada",
        "Atendendo comentarios": "Finalizada",
        "Gerado": "Finalizada", "Impresso": "Finalizada",
    }
    atividade.status_ciclo = mapa.get(status_novo, atividade.status_ciclo)

    db.add(models.StatusHistorico(
        atividade_id=atividade.id,
        usuario_id=usuario_id,
        acao="admin_override",
        status_anterior=status_anterior,
        status_novo=status_novo,
        etapa_anterior=atividade.etapa_atual,
        etapa_nova=atividade.etapa_atual,
        timestamp=datetime.now(timezone.utc),
    ))

    await db.commit()
    return await _get_atividade_ou_404(atividade_id, db)
