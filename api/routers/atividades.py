from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from database import get_db
from datetime import datetime, timezone
import models
import schemas
from services.workflow import opcoes_avanco, transicoes_validas, validar_transicao, vincula_funcionario

router = APIRouter(prefix="", tags=["Atividades"])

from sqlalchemy.orm import selectinload


def _atividade_relacoes():
    return (
        selectinload(models.Atividade.laje)
        .selectinload(models.Laje.edificio)
        .selectinload(models.Edificio.construtora),
        selectinload(models.Atividade.usuario_responsavel),
    )


def _normalizar_status_legacy(atividade: models.Atividade) -> bool:
    if atividade.status_atual == "Pausado":
        atividade.status_atual = "Fazendo"
        atividade.atualizado_em = datetime.now(timezone.utc)
        return True
    return False


def _opcoes_admin(atividade: models.Atividade) -> list[str]:
    opcoes = opcoes_avanco(atividade.tipo_elemento, atividade.subtipo, atividade.status_atual)
    if opcoes:
        return opcoes

    # No modo admin, permite finalizar direto quando o fluxo regular seria Pendente -> Fazendo -> Final.
    if atividade.status_atual == "Pendente" and vincula_funcionario(atividade.tipo_elemento, atividade.subtipo):
        finalizacoes = [
            status
            for status in transicoes_validas(atividade.tipo_elemento, atividade.subtipo, "Fazendo")
            if status != "Fazendo"
        ]
        return finalizacoes

    return []

@router.get("/", response_model=List[schemas.Atividade])
async def read_atividades(
    usuario_id: Optional[int] = None, 
    laje_id: Optional[int] = None, 
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(models.Atividade).options(*_atividade_relacoes())
    if usuario_id:
        query = query.where(models.Atividade.usuario_responsavel_id == usuario_id)
    if laje_id:
        query = query.where(models.Atividade.laje_id == laje_id)
    if status:
        query = query.where(models.Atividade.status_atual == status)
        
    result = await db.execute(query)
    atividades = result.scalars().all()

    alterou = False
    for atividade in atividades:
        alterou = _normalizar_status_legacy(atividade) or alterou

    if alterou:
        await db.commit()

    return atividades

@router.get("/{atividade_id}", response_model=schemas.Atividade)
async def read_atividade(atividade_id: int, db: AsyncSession = Depends(get_db)):
    query = select(models.Atividade).where(models.Atividade.id == atividade_id).options(*_atividade_relacoes())
    result = await db.execute(query)
    atividade = result.scalar_one_or_none()
    if not atividade:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")

    if _normalizar_status_legacy(atividade):
        await db.commit()
    return atividade

@router.put("/{atividade_id}/status", response_model=schemas.Atividade)
async def update_atividade_status(
    atividade_id: int, 
    usuario_id: int, # Quem está alterando (admin)
    status_novo: Optional[schemas.StatusAtividade] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(models.Atividade).where(models.Atividade.id == atividade_id).options(*_atividade_relacoes())
    result = await db.execute(query)
    atividade = result.scalar_one_or_none()
    if not atividade:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")

    if _normalizar_status_legacy(atividade):
        await db.commit()

    if (
        status_novo == "Fazendo"
        and vincula_funcionario(atividade.tipo_elemento, atividade.subtipo)
    ):
        raise HTTPException(
            status_code=400,
            detail="Use o Play para iniciar/retomar. A mudança para Fazendo é automática ao iniciar sessão.",
        )

    if not vincula_funcionario(atividade.tipo_elemento, atividade.subtipo):
        atividade.usuario_responsavel_id = None

    if status_novo is None:
        opcoes = opcoes_avanco(atividade.tipo_elemento, atividade.subtipo, atividade.status_atual)
        if len(opcoes) == 0:
            raise HTTPException(status_code=400, detail="Atividade sem próximo status disponível")
        if len(opcoes) > 1:
            raise HTTPException(status_code=400, detail="Seleção de próximo status é obrigatória para esta atividade")
        status_novo = opcoes[0]

    finalizacao_direta_admin = False
    if atividade.status_atual == "Pendente" and vincula_funcionario(atividade.tipo_elemento, atividade.subtipo):
        finalizacoes = [
            status
            for status in transicoes_validas(atividade.tipo_elemento, atividade.subtipo, "Fazendo")
            if status != "Fazendo"
        ]
        finalizacao_direta_admin = status_novo in finalizacoes

    if not finalizacao_direta_admin:
        validar_transicao(atividade.tipo_elemento, atividade.subtipo, atividade.status_atual, status_novo)
    
    status_anterior = atividade.status_atual
    atividade.status_atual = status_novo
    atividade.atualizado_em = datetime.now(timezone.utc)
    
    # Registrar histórico
    db.add(models.StatusHistorico(
        atividade_id=atividade.id,
        usuario_id=usuario_id,
        status_anterior=status_anterior,
        status_novo=status_novo,
        timestamp=datetime.now(timezone.utc)
    ))
    
    await db.commit()
    query = select(models.Atividade).where(models.Atividade.id == atividade_id).options(*_atividade_relacoes())
    result = await db.execute(query)
    return result.scalar_one()


@router.get("/{atividade_id}/detalhe", response_model=schemas.AtividadeDetalhe)
async def get_atividade_detalhe(atividade_id: int, db: AsyncSession = Depends(get_db)):
    query = select(models.Atividade).where(models.Atividade.id == atividade_id).options(*_atividade_relacoes())
    result = await db.execute(query)
    atividade = result.scalar_one_or_none()
    if not atividade:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")

    if _normalizar_status_legacy(atividade):
        await db.commit()

    data_sessoes = await db.execute(
        select(
            func.min(models.SessaoTrabalho.iniciado_em),
            func.max(models.SessaoTrabalho.finalizado_em),
        ).where(models.SessaoTrabalho.atividade_id == atividade_id)
    )
    iniciada_em, pausada_em = data_sessoes.one()

    sessao_ativa = await db.execute(
        select(models.SessaoTrabalho.iniciado_em).where(
            models.SessaoTrabalho.atividade_id == atividade_id,
            models.SessaoTrabalho.finalizado_em == None,
        )
    )
    em_andamento_desde = sessao_ativa.scalar_one_or_none()

    return schemas.AtividadeDetalhe(
        atividade=atividade,
        usuario_vinculado=atividade.usuario_responsavel,
        iniciada_em=iniciada_em,
        pausada_em=pausada_em,
        em_andamento_desde=em_andamento_desde,
    )


@router.get("/{atividade_id}/proximos-status", response_model=schemas.ProximosStatusAtividade)
async def get_proximos_status(atividade_id: int, modo_admin: bool = False, db: AsyncSession = Depends(get_db)):
    query = select(models.Atividade).where(models.Atividade.id == atividade_id)
    result = await db.execute(query)
    atividade = result.scalar_one_or_none()
    if not atividade:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")

    if _normalizar_status_legacy(atividade):
        await db.commit()

    opcoes = _opcoes_admin(atividade) if modo_admin else opcoes_avanco(atividade.tipo_elemento, atividade.subtipo, atividade.status_atual)
    return schemas.ProximosStatusAtividade(
        atividade_id=atividade.id,
        status_atual=atividade.status_atual,
        opcoes=opcoes,
        selecao_obrigatoria=len(opcoes) > 1,
    )

@router.get("/{atividade_id}/historico", response_model=List[schemas.StatusHistorico])
async def get_atividade_historico(atividade_id: int, db: AsyncSession = Depends(get_db)):
    query = select(models.StatusHistorico).where(models.StatusHistorico.atividade_id == atividade_id).order_by(models.StatusHistorico.timestamp.desc())
    result = await db.execute(query)
    return result.scalars().all()
