from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from fastapi import HTTPException
from datetime import datetime, timezone
import models
from services.workflow import vincula_funcionario, validar_transicao

async def broadcast_sessoes_ativas(db: AsyncSession):
    from routers.dashboard import manager, obter_payload_sessoes_ativas
    payload = await obter_payload_sessoes_ativas(db)
    await manager.broadcast(payload)

async def iniciar_sessao(usuario_id: int, atividade_id: int, db: AsyncSession):
    query = select(models.SessaoTrabalho).where(
        models.SessaoTrabalho.usuario_id == usuario_id,
        models.SessaoTrabalho.finalizado_em == None
    ).order_by(models.SessaoTrabalho.iniciado_em.desc())
    result = await db.execute(query)
    sessao_aberta = result.scalars().first()

    if sessao_aberta:
        atividade = await db.get(models.Atividade, sessao_aberta.atividade_id)
        raise HTTPException(
            status_code=409,
            detail=f"Você já tem uma sessão ativa: {atividade.tipo_elemento} · {atividade.subtipo or ''}"
        )

    atividade = await db.get(models.Atividade, atividade_id)
    if not atividade:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")

    if not vincula_funcionario(atividade.tipo_elemento, atividade.subtipo):
        raise HTTPException(
            status_code=400,
            detail="Esta atividade não aceita vínculo de funcionário e não pode ter sessão de trabalho",
        )

    if atividade.status_atual == "Pausado":
        novo_status = "Fazendo"
    elif atividade.status_atual in ("Pendente", "Fazendo"):
        novo_status = "Fazendo"
    else:
        validar_transicao(atividade.tipo_elemento, atividade.subtipo, atividade.status_atual, "Fazendo")
        novo_status = "Fazendo"

    nova_sessao = models.SessaoTrabalho(
        atividade_id=atividade_id,
        usuario_id=usuario_id,
        iniciado_em=datetime.now(timezone.utc)
    )
    db.add(nova_sessao)

    await db.execute(
        update(models.Atividade)
        .where(models.Atividade.id == atividade_id)
        .values(
            status_atual=novo_status,
            usuario_responsavel_id=usuario_id,
            atualizado_em=datetime.now(timezone.utc)
        )
    )

    await db.commit()
    await db.refresh(nova_sessao)
    
    # Notificar via WebSocket
    await broadcast_sessoes_ativas(db)
    
    return nova_sessao

async def finalizar_sessao(sessao_id: int, usuario_id: int, db: AsyncSession):
    sessao = await db.get(models.SessaoTrabalho, sessao_id)

    if not sessao or sessao.usuario_id != usuario_id:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")

    if sessao.finalizado_em is not None:
        raise HTTPException(status_code=400, detail="Sessão já finalizada")

    agora = datetime.now(timezone.utc)
    duracao = int((agora - sessao.iniciado_em).total_seconds())

    sessao.finalizado_em = agora
    sessao.duracao_segundos = duracao

    await db.commit()
    
    # Notificar via WebSocket
    await broadcast_sessoes_ativas(db)
    
    return sessao
