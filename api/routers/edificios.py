from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from database import get_db
from datetime import datetime, timezone
import models
import schemas
from services import geracao_lajes

router = APIRouter(prefix="", tags=["Edifícios"])


def _edificio_relacoes():
    return selectinload(models.Edificio.construtora)

@router.get("/", response_model=List[schemas.Edificio])
async def read_edificios(include_encerrados: bool = False, db: AsyncSession = Depends(get_db)):
    # Aqui poderíamos calcular o percentual_conclusao no SQL ou retornar o objeto simples
    query = select(models.Edificio).options(_edificio_relacoes())
    if not include_encerrados:
        query = query.where(models.Edificio.encerrado_em == None)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/", response_model=schemas.Edificio)
async def create_edificio(edificio: schemas.EdificioCreate, db: AsyncSession = Depends(get_db)):
    # Criar edifício
    db_edificio = models.Edificio(
        construtora_id=edificio.construtora_id,
        nome=edificio.nome,
        descricao=edificio.descricao
    )
    db.add(db_edificio)
    await db.flush() # Para obter o ID
    
    # Gerar estrutura (lajes + atividades)
    await geracao_lajes.criar_estrutura_edificio(
        edificio_id=db_edificio.id, 
        num_pavimentos=edificio.num_pavimentos, 
        db=db
    )
    
    await db.commit()
    query = select(models.Edificio).where(models.Edificio.id == db_edificio.id).options(_edificio_relacoes())
    result = await db.execute(query)
    return result.scalar_one()

@router.get("/{edificio_id}/estrutura")
async def get_edificio_estrutura(edificio_id: int, db: AsyncSession = Depends(get_db)):
    # Retorna árvore completa: edifício > lajes > atividades
    query = select(models.Edificio).where(models.Edificio.id == edificio_id).options(
        selectinload(models.Edificio.lajes).selectinload(models.Laje.atividades)
    )
    result = await db.execute(query)
    db_edificio = result.scalar_one_or_none()
    
    if not db_edificio:
        raise HTTPException(status_code=404, detail="Edifício não encontrado")
    
    return db_edificio

@router.put("/{edificio_id}", response_model=schemas.Edificio)
async def update_edificio(edificio_id: int, edificio: schemas.EdificioBase, db: AsyncSession = Depends(get_db)):
    query = select(models.Edificio).where(models.Edificio.id == edificio_id).options(_edificio_relacoes())
    result = await db.execute(query)
    db_edificio = result.scalar_one_or_none()
    if not db_edificio:
        raise HTTPException(status_code=404, detail="Edifício não encontrado")
    
    update_data = edificio.model_dump()
    for key, value in update_data.items():
        setattr(db_edificio, key, value)
    
    await db.commit()
    query = select(models.Edificio).where(models.Edificio.id == edificio_id).options(_edificio_relacoes())
    result = await db.execute(query)
    return result.scalar_one()


@router.delete("/{edificio_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_edificio(edificio_id: int, hard_delete: bool = False, db: AsyncSession = Depends(get_db)):
    query = select(models.Edificio).where(models.Edificio.id == edificio_id).options(_edificio_relacoes())
    result = await db.execute(query)
    db_edificio = result.scalar_one_or_none()
    if not db_edificio:
        raise HTTPException(status_code=404, detail="Edifício não encontrado")

    if hard_delete:
        await db.delete(db_edificio)
    else:
        db_edificio.encerrado_em = datetime.now(timezone.utc)

    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
