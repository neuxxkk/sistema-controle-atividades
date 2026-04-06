from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from database import get_db
import models
import schemas
from services import sessao_service
from sqlalchemy.orm import selectinload

# Usando o prefixo completo de uma vez para evitar erro de montagem no FastAPI
router = APIRouter(prefix="/api/sessoes", tags=["Sessões"])


def _sessao_relacoes():
    return (
        selectinload(models.SessaoTrabalho.usuario),
        selectinload(models.SessaoTrabalho.atividade)
        .selectinload(models.Atividade.laje)
        .selectinload(models.Laje.edificio)
        .selectinload(models.Edificio.construtora),
    )

@router.get("/status-atual", response_model=Optional[schemas.SessaoTrabalho])
async def get_sessao_ativa(usuario_id: int, db: AsyncSession = Depends(get_db)):
    query = select(models.SessaoTrabalho).options(*_sessao_relacoes()).where(
        models.SessaoTrabalho.usuario_id == usuario_id,
        models.SessaoTrabalho.finalizado_em == None
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()

@router.post("/", response_model=schemas.SessaoTrabalho)
async def iniciar_sessao(sessao: schemas.SessaoTrabalhoCreate, db: AsyncSession = Depends(get_db)):
    nova_sessao = await sessao_service.iniciar_sessao(
        usuario_id=sessao.usuario_id, 
        atividade_id=sessao.atividade_id, 
        db=db
    )

    query = select(models.SessaoTrabalho).options(*_sessao_relacoes()).where(models.SessaoTrabalho.id == nova_sessao.id)
    result = await db.execute(query)
    return result.scalar_one()

@router.put("/{sessao_id}/finalizar", response_model=schemas.SessaoTrabalho)
async def finalizar_sessao(sessao_id: int, usuario_id: int, db: AsyncSession = Depends(get_db)):
    sessao_finalizada = await sessao_service.finalizar_sessao(
        sessao_id=sessao_id, 
        usuario_id=usuario_id, 
        db=db
    )

    query = select(models.SessaoTrabalho).options(*_sessao_relacoes()).where(models.SessaoTrabalho.id == sessao_finalizada.id)
    result = await db.execute(query)
    return result.scalar_one()


@router.put("/{sessao_id}/pausar", response_model=schemas.SessaoTrabalho)
async def pausar_sessao(sessao_id: int, usuario_id: int, db: AsyncSession = Depends(get_db)):
    sessao_pausada = await sessao_service.finalizar_sessao(
        sessao_id=sessao_id,
        usuario_id=usuario_id,
        db=db
    )

    query = select(models.SessaoTrabalho).options(*_sessao_relacoes()).where(models.SessaoTrabalho.id == sessao_pausada.id)
    result = await db.execute(query)
    return result.scalar_one()

@router.get("/", response_model=List[schemas.SessaoTrabalho])
async def read_sessoes(usuario_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    query = select(models.SessaoTrabalho).options(*_sessao_relacoes())
    if usuario_id:
        query = query.where(models.SessaoTrabalho.usuario_id == usuario_id)
    
    result = await db.execute(query.order_by(models.SessaoTrabalho.iniciado_em.desc()))
    return result.scalars().all()
