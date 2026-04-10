from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List
from database import get_db
from datetime import datetime, timezone
import models
import schemas
from services import geracao_lajes

router = APIRouter(prefix="", tags=["Edifícios"])


def _edificio_relacoes():
    return [selectinload(models.Edificio.construtora), selectinload(models.Edificio.lajes)]

@router.get("/", response_model=List[schemas.EdificioComLajes])
async def read_edificios(include_encerrados: bool = False, db: AsyncSession = Depends(get_db)):
    # Aqui poderíamos calcular o percentual_conclusao no SQL ou retornar o objeto simples
    query = select(models.Edificio).options(*_edificio_relacoes())
    if not include_encerrados:
        query = query.where(models.Edificio.encerrado_em == None)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/", response_model=schemas.EdificioComLajes)
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
    query = select(models.Edificio).where(models.Edificio.id == db_edificio.id).options(*_edificio_relacoes())
    result = await db.execute(query)
    return result.scalars().first()

@router.get("/{edificio_id}/detalhe", response_model=schemas.EdificioDetalhe)
async def get_edificio_detalhe(edificio_id: int, db: AsyncSession = Depends(get_db)):
    query = select(models.Edificio).where(models.Edificio.id == edificio_id).options(*_edificio_relacoes())
    result = await db.execute(query)
    db_edificio = result.scalars().first()
    if not db_edificio:
        raise HTTPException(status_code=404, detail="Edifício não encontrado")

    # IDs de lajes do edifício
    laje_ids_q = await db.execute(select(models.Laje.id).where(models.Laje.edificio_id == edificio_id))
    laje_ids = laje_ids_q.scalars().all()

    total_atividades = 0
    atividades_finalizadas = 0
    primeiro_inicio = None
    ultima_finalizacao = None
    tempo_por_usuario: list[schemas.TempoPorUsuario] = []

    if laje_ids:
        # Contagens de atividades
        ativ_ids_q = await db.execute(select(models.Atividade.id, models.Atividade.status_ciclo).where(models.Atividade.laje_id.in_(laje_ids)))
        ativs = ativ_ids_q.all()
        total_atividades = len(ativs)
        atividades_finalizadas = sum(1 for _, sc in ativs if sc == "Finalizada")
        ativ_ids = [a for a, _ in ativs]

        if ativ_ids:
            # Datas extremas das sessões
            datas_q = await db.execute(
                select(
                    func.min(models.SessaoTrabalho.iniciado_em),
                    func.max(models.SessaoTrabalho.finalizado_em),
                ).where(models.SessaoTrabalho.atividade_id.in_(ativ_ids))
            )
            primeiro_inicio, ultima_finalizacao = datas_q.one()

            # Tempo por usuário
            tempo_q = await db.execute(
                select(
                    models.SessaoTrabalho.usuario_id,
                    func.sum(models.SessaoTrabalho.duracao_segundos).label("total"),
                ).where(
                    models.SessaoTrabalho.atividade_id.in_(ativ_ids),
                    models.SessaoTrabalho.duracao_segundos != None,
                ).group_by(models.SessaoTrabalho.usuario_id)
            )
            rows = tempo_q.all()
            if rows:
                uid_list = [r.usuario_id for r in rows]
                usr_q = await db.execute(select(models.Usuario).where(models.Usuario.id.in_(uid_list)))
                usr_map = {u.id: u for u in usr_q.scalars().all()}
                for row in rows:
                    u = usr_map.get(row.usuario_id)
                    if u:
                        tempo_por_usuario.append(schemas.TempoPorUsuario(usuario=u, tempo_segundos=int(row.total)))

    return schemas.EdificioDetalhe(
        edificio=db_edificio,
        primeiro_inicio=primeiro_inicio,
        ultima_finalizacao=ultima_finalizacao,
        total_atividades=total_atividades,
        atividades_finalizadas=atividades_finalizadas,
        tempo_por_usuario=tempo_por_usuario,
    )


@router.get("/{edificio_id}/estrutura")
async def get_edificio_estrutura(edificio_id: int, db: AsyncSession = Depends(get_db)):
    # Retorna árvore completa: edifício > lajes > atividades
    query = select(models.Edificio).where(models.Edificio.id == edificio_id).options(
        selectinload(models.Edificio.construtora),
        selectinload(models.Edificio.lajes).selectinload(models.Laje.atividades).selectinload(models.Atividade.usuario_responsavel)
    )
    result = await db.execute(query)
    db_edificio = result.scalars().first()
    
    if not db_edificio:
        raise HTTPException(status_code=404, detail="Edifício não encontrado")
    
    return db_edificio

@router.put("/{edificio_id}", response_model=schemas.EdificioComLajes)
async def update_edificio(edificio_id: int, edificio: schemas.EdificioBase, db: AsyncSession = Depends(get_db)):
    query = select(models.Edificio).where(models.Edificio.id == edificio_id).options(*_edificio_relacoes())
    result = await db.execute(query)
    db_edificio = result.scalars().first()
    if not db_edificio:
        raise HTTPException(status_code=404, detail="Edifício não encontrado")
    
    update_data = edificio.model_dump()
    for key, value in update_data.items():
        setattr(db_edificio, key, value)
    
    await db.commit()
    query = select(models.Edificio).where(models.Edificio.id == edificio_id).options(*_edificio_relacoes())
    result = await db.execute(query)
    return result.scalars().first()


@router.delete("/{edificio_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_edificio(edificio_id: int, hard_delete: bool = False, db: AsyncSession = Depends(get_db)):
    query = select(models.Edificio).where(models.Edificio.id == edificio_id).options(*_edificio_relacoes())
    result = await db.execute(query)
    db_edificio = result.scalars().first()
    if not db_edificio:
        raise HTTPException(status_code=404, detail="Edifício não encontrado")

    if hard_delete:
        await db.delete(db_edificio)
    else:
        db_edificio.encerrado_em = datetime.now(timezone.utc)

    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
