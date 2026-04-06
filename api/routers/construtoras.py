from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from typing import List
from database import get_db
import models
import schemas

router = APIRouter(prefix="", tags=["Construtoras"])

@router.get("/", response_model=List[schemas.Construtora])
async def read_construtoras(db: AsyncSession = Depends(get_db)):
    query = select(models.Construtora)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/", response_model=schemas.Construtora)
async def create_construtora(construtora: schemas.ConstrutoraCreate, db: AsyncSession = Depends(get_db)):
    db_construtora = models.Construtora(**construtora.model_dump())
    db.add(db_construtora)
    await db.commit()
    await db.refresh(db_construtora)
    return db_construtora


@router.get("/{construtora_id}", response_model=schemas.Construtora)
async def read_construtora(construtora_id: int, db: AsyncSession = Depends(get_db)):
    db_construtora = await db.get(models.Construtora, construtora_id)
    if not db_construtora:
        raise HTTPException(status_code=404, detail="Construtora não encontrada")
    return db_construtora


@router.put("/{construtora_id}", response_model=schemas.Construtora)
async def update_construtora(
    construtora_id: int,
    construtora: schemas.ConstrutoraBase,
    db: AsyncSession = Depends(get_db),
):
    db_construtora = await db.get(models.Construtora, construtora_id)
    if not db_construtora:
        raise HTTPException(status_code=404, detail="Construtora não encontrada")

    db_construtora.nome = construtora.nome
    await db.commit()
    await db.refresh(db_construtora)
    return db_construtora


@router.delete("/{construtora_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_construtora(construtora_id: int, db: AsyncSession = Depends(get_db)):
    db_construtora = await db.get(models.Construtora, construtora_id)
    if not db_construtora:
        raise HTTPException(status_code=404, detail="Construtora não encontrada")

    await db.delete(db_construtora)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Não é possível excluir: existem edifícios vinculados a esta construtora",
        )

    return Response(status_code=status.HTTP_204_NO_CONTENT)
