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


async def _get_edificio_ou_404(edificio_id: int, db: AsyncSession) -> models.Edificio:
    query = select(models.Edificio).where(models.Edificio.id == edificio_id).options(*_edificio_relacoes())
    result = await db.execute(query)
    edificio = result.scalars().first()
    if not edificio:
        raise HTTPException(status_code=404, detail="Edifício não encontrado")
    return edificio


async def _listar_lajes_ordenadas(edificio_id: int, db: AsyncSession) -> list[models.Laje]:
    result = await db.execute(
        select(models.Laje)
        .where(models.Laje.edificio_id == edificio_id)
        .order_by(models.Laje.ordem.asc(), models.Laje.id.asc())
    )
    return result.scalars().all()


def _normalizar_ordens(lajes: list[models.Laje]) -> None:
    for idx, laje in enumerate(lajes, start=1):
        laje.ordem = idx


def _atividade_pendente(atividade: models.Atividade) -> bool:
    return atividade.status_ciclo == "Pendente"


async def _validar_laje_editavel(laje: models.Laje, db: AsyncSession) -> None:
    result = await db.execute(select(models.Atividade).where(models.Atividade.laje_id == laje.id))
    atividades = result.scalars().all()
    if any(not _atividade_pendente(a) for a in atividades):
        raise HTTPException(
            status_code=409,
            detail="Só é permitido alterar/excluir pavimentos com tarefas totalmente pendentes.",
        )


async def _criar_atividades_padrao_laje(laje_id: int, db: AsyncSession) -> None:
    for ativ in geracao_lajes.ATIVIDADES_POR_LAJE:
        db.add(models.Atividade(
            laje_id=laje_id,
            tipo_elemento=ativ["tipo_elemento"],
            subtipo=ativ["subtipo"],
            status_atual="Pendente",
            status_ciclo="Pendente",
            etapa_atual=1,
            etapa_total=ativ["etapa_total"],
        ))


async def _garantir_atividades_gerais(edificio_id: int, db: AsyncSession) -> None:
    lajes = await _listar_lajes_ordenadas(edificio_id, db)
    if not lajes:
        return
    laje_ref = next((l for l in lajes if l.tipo == "Fundacao"), lajes[0])

    for ativ in geracao_lajes.ATIVIDADES_GERAIS_EDIFICIO:
        db.add(models.Atividade(
            laje_id=laje_ref.id,
            tipo_elemento=ativ["tipo_elemento"],
            subtipo=ativ["subtipo"],
            status_atual="Pendente",
            status_ciclo="Pendente",
            etapa_atual=1,
            etapa_total=ativ["etapa_total"],
        ))

@router.get("/", response_model=List[schemas.EdificioComLajes])
async def read_edificios(include_encerrados: bool = False, db: AsyncSession = Depends(get_db)):
    # Aqui poderíamos calcular o percentual_conclusao no SQL ou retornar o objeto simples
    query = select(models.Edificio).options(*_edificio_relacoes())
    if not include_encerrados:
        query = query.where(models.Edificio.encerrado_em == None)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/estruturas")
async def read_edificios_estruturas(include_encerrados: bool = False, db: AsyncSession = Depends(get_db)):
    """Retorna todas as estruturas completas em uma única chamada (edifício > lajes > atividades)."""
    query = select(models.Edificio).options(
        selectinload(models.Edificio.construtora),
        selectinload(models.Edificio.lajes)
        .selectinload(models.Laje.atividades)
        .selectinload(models.Atividade.usuario_responsavel),
    )
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
    
    if edificio.lajes_customizadas:
        for idx, laje_input in enumerate(edificio.lajes_customizadas, start=1):
            nova_laje = models.Laje(
                edificio_id=db_edificio.id,
                tipo=laje_input.tipo,
                ordem=idx,
            )
            db.add(nova_laje)
            await db.flush()
            await _criar_atividades_padrao_laje(nova_laje.id, db)
        await _garantir_atividades_gerais(db_edificio.id, db)
    else:
        # Gerar estrutura padrão (lajes + atividades)
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


@router.post("/{edificio_id}/lajes", response_model=schemas.EdificioComLajes)
async def criar_laje(
    edificio_id: int,
    payload: schemas.LajeCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    await _get_edificio_ou_404(edificio_id, db)
    lajes = await _listar_lajes_ordenadas(edificio_id, db)

    ordem_destino = payload.ordem if payload.ordem is not None else len(lajes) + 1
    ordem_destino = max(1, min(ordem_destino, len(lajes) + 1))

    nova = models.Laje(edificio_id=edificio_id, tipo=payload.tipo, ordem=ordem_destino)
    db.add(nova)
    await db.flush()
    await _criar_atividades_padrao_laje(nova.id, db)

    lajes = await _listar_lajes_ordenadas(edificio_id, db)
    lajes.remove(nova)
    lajes.insert(ordem_destino - 1, nova)
    _normalizar_ordens(lajes)

    await db.commit()
    return await _get_edificio_ou_404(edificio_id, db)


@router.put("/{edificio_id}/lajes/{laje_id}", response_model=schemas.EdificioComLajes)
async def editar_laje(
    edificio_id: int,
    laje_id: int,
    payload: schemas.LajeUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    await _get_edificio_ou_404(edificio_id, db)
    lajes = await _listar_lajes_ordenadas(edificio_id, db)
    laje = next((l for l in lajes if l.id == laje_id), None)
    if not laje:
        raise HTTPException(status_code=404, detail="Pavimento não encontrado")

    await _validar_laje_editavel(laje, db)

    if payload.tipo is not None and payload.tipo.strip():
        laje.tipo = payload.tipo.strip()

    if payload.ordem is not None:
        nova_ordem = max(1, min(payload.ordem, len(lajes)))
        lajes.remove(laje)
        lajes.insert(nova_ordem - 1, laje)
        _normalizar_ordens(lajes)

    await db.commit()
    return await _get_edificio_ou_404(edificio_id, db)


@router.post("/{edificio_id}/lajes/{laje_id}/mover", response_model=schemas.EdificioComLajes)
async def mover_laje(
    edificio_id: int,
    laje_id: int,
    direcao: str,
    db: AsyncSession = Depends(get_db),
):
    await _get_edificio_ou_404(edificio_id, db)
    lajes = await _listar_lajes_ordenadas(edificio_id, db)
    idx = next((i for i, l in enumerate(lajes) if l.id == laje_id), -1)
    if idx < 0:
        raise HTTPException(status_code=404, detail="Pavimento não encontrado")

    laje = lajes[idx]
    await _validar_laje_editavel(laje, db)

    if direcao == "cima":
        if idx == 0:
            raise HTTPException(status_code=400, detail="Pavimento já está no topo")
        lajes[idx - 1], lajes[idx] = lajes[idx], lajes[idx - 1]
    elif direcao == "baixo":
        if idx == len(lajes) - 1:
            raise HTTPException(status_code=400, detail="Pavimento já está na base")
        lajes[idx + 1], lajes[idx] = lajes[idx], lajes[idx + 1]
    else:
        raise HTTPException(status_code=400, detail="Direção inválida. Use 'cima' ou 'baixo'.")

    _normalizar_ordens(lajes)
    await db.commit()
    return await _get_edificio_ou_404(edificio_id, db)


@router.delete("/{edificio_id}/lajes/{laje_id}", response_model=schemas.EdificioComLajes)
async def excluir_laje(
    edificio_id: int,
    laje_id: int,
    db: AsyncSession = Depends(get_db),
):
    await _get_edificio_ou_404(edificio_id, db)
    lajes = await _listar_lajes_ordenadas(edificio_id, db)
    laje = next((l for l in lajes if l.id == laje_id), None)
    if not laje:
        raise HTTPException(status_code=404, detail="Pavimento não encontrado")

    await _validar_laje_editavel(laje, db)
    await db.delete(laje)
    await db.flush()

    lajes_restantes = await _listar_lajes_ordenadas(edificio_id, db)
    _normalizar_ordens(lajes_restantes)
    await db.commit()
    return await _get_edificio_ou_404(edificio_id, db)


@router.post("/{edificio_id}/lajes/delecao-lote", response_model=schemas.EdificioComLajes)
async def excluir_lajes_em_lote(
    edificio_id: int,
    payload: schemas.LajeBulkDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    await _get_edificio_ou_404(edificio_id, db)
    if not payload.laje_ids:
        raise HTTPException(status_code=400, detail="Informe ao menos um pavimento para exclusão")

    lajes = await _listar_lajes_ordenadas(edificio_id, db)
    ids_validos = {l.id for l in lajes}
    ids_alvo = [l_id for l_id in payload.laje_ids if l_id in ids_validos]
    if not ids_alvo:
        raise HTTPException(status_code=404, detail="Nenhum pavimento válido encontrado para exclusão")

    for laje in lajes:
        if laje.id in ids_alvo:
            await _validar_laje_editavel(laje, db)

    for laje in lajes:
        if laje.id in ids_alvo:
            await db.delete(laje)

    await db.flush()
    lajes_restantes = await _listar_lajes_ordenadas(edificio_id, db)
    _normalizar_ordens(lajes_restantes)

    await db.commit()
    return await _get_edificio_ou_404(edificio_id, db)
