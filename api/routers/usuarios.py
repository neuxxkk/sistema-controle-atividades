from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from database import get_db
import models
import schemas

router = APIRouter(prefix="", tags=["Usuários"])

@router.get("/", response_model=List[schemas.Usuario])
async def read_usuarios(
    skip: int = 0, 
    limit: int = 100, 
    somente_ativos: bool = False,
    db: AsyncSession = Depends(get_db)
):
    query = select(models.Usuario)
    if somente_ativos:
        query = query.where(models.Usuario.ativo == True)
        
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()

@router.post("/", response_model=schemas.Usuario)
async def create_usuario(usuario: schemas.UsuarioCreate, db: AsyncSession = Depends(get_db)):
    db_usuario = models.Usuario(**usuario.model_dump())
    db.add(db_usuario)
    await db.commit()
    await db.refresh(db_usuario)
    return db_usuario

@router.put("/{usuario_id}", response_model=schemas.Usuario)
async def update_usuario(usuario_id: int, usuario: schemas.UsuarioCreate, db: AsyncSession = Depends(get_db)):
    db_usuario = await db.get(models.Usuario, usuario_id)
    if not db_usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    update_data = usuario.model_dump()
    for key, value in update_data.items():
        setattr(db_usuario, key, value)
    
    await db.commit()
    await db.refresh(db_usuario)
    return db_usuario


@router.delete("/{usuario_id}")
async def delete_usuario(usuario_id: int, db: AsyncSession = Depends(get_db)):
    db_usuario = await db.get(models.Usuario, usuario_id)
    if not db_usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    await db.delete(db_usuario)
    await db.commit()
    return {"ok": True}
