"""
Serviço de sessões — mantido para compatibilidade com endpoints legados /api/sessoes/.
O novo workflow usa services/workflow.py diretamente.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException
from datetime import datetime, timezone
import models
from services.workflow import vincula_funcionario


async def broadcast_sessoes_ativas(db: AsyncSession):
    from routers.dashboard import manager, obter_payload_sessoes_ativas
    payload = await obter_payload_sessoes_ativas(db)
    await manager.broadcast(payload)


async def iniciar_sessao(usuario_id: int, atividade_id: int, db: AsyncSession):
    """Legado: cria sessão e muda status para Fazendo/Em andamento."""
    # Verifica sessão aberta
    result = await db.execute(
        select(models.SessaoTrabalho).where(
            models.SessaoTrabalho.usuario_id == usuario_id,
            models.SessaoTrabalho.finalizado_em == None,
        ).order_by(models.SessaoTrabalho.iniciado_em.desc())
    )
    sessao_aberta = result.scalars().first()
    if sessao_aberta:
        atividade_aberta = await db.get(models.Atividade, sessao_aberta.atividade_id)
        raise HTTPException(
            status_code=409,
            detail=f"Você já tem uma sessão ativa: {atividade_aberta.tipo_elemento}"
        )

    atividade = await db.get(models.Atividade, atividade_id)
    if not atividade:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")

    if not vincula_funcionario(atividade.tipo_elemento, atividade.subtipo):
        raise HTTPException(400, "Esta atividade não aceita sessão de trabalho")

    agora = datetime.now(timezone.utc)
    nova_sessao = models.SessaoTrabalho(
        atividade_id=atividade_id,
        usuario_id=usuario_id,
        iniciado_em=agora,
    )
    db.add(nova_sessao)

    atividade.status_atual = "Fazendo"
    atividade.status_ciclo = "Em andamento"
    atividade.usuario_responsavel_id = usuario_id
    atividade.atualizado_em = agora

    await db.commit()
    await db.refresh(nova_sessao)
    await broadcast_sessoes_ativas(db)
    return nova_sessao


async def finalizar_sessao(sessao_id: int, usuario_id: int, db: AsyncSession):
    sessao = await db.get(models.SessaoTrabalho, sessao_id)
    if not sessao or sessao.usuario_id != usuario_id:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    if sessao.finalizado_em is not None:
        raise HTTPException(status_code=400, detail="Sessão já finalizada")

    agora = datetime.now(timezone.utc)
    sessao.finalizado_em = agora
    sessao.duracao_segundos = int((agora - sessao.iniciado_em).total_seconds())

    # Atualiza status da atividade para Pausada
    atividade = await db.get(models.Atividade, sessao.atividade_id)
    if atividade and atividade.status_ciclo == "Em andamento":
        atividade.status_ciclo = "Pausada"
        atividade.status_atual = "Pausado"
        atividade.atualizado_em = agora

    await db.commit()
    await broadcast_sessoes_ativas(db)
    return sessao
