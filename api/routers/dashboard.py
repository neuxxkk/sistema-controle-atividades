from fastapi import APIRouter, Depends, HTTPException, WebSocket
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from database import get_db
import models
from datetime import date, datetime, time, timedelta, timezone
from time import monotonic

router = APIRouter(prefix="", tags=["Dashboard"])

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    async def connect_only(self, websocket: WebSocket):
        if websocket not in self.active_connections:
            self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass

manager = ConnectionManager()

# Cache curto para consultas analiticas repetidas com os mesmos filtros.
ANALYTICS_CACHE_TTL_SECONDS = 45
_analytics_cache: dict[str, tuple[float, dict]] = {}


def _cache_key(prefix: str, **params) -> str:
    ordered = sorted(params.items(), key=lambda item: item[0])
    serializado = "|".join(f"{k}={v}" for k, v in ordered)
    return f"{prefix}|{serializado}"


def _cache_get(chave: str) -> dict | None:
    entry = _analytics_cache.get(chave)
    if not entry:
        return None

    created_at, payload = entry
    if monotonic() - created_at > ANALYTICS_CACHE_TTL_SECONDS:
        _analytics_cache.pop(chave, None)
        return None

    return payload


def _cache_set(chave: str, payload: dict) -> dict:
    _analytics_cache[chave] = (monotonic(), payload)
    return payload


def _normalizar_periodo(
    data_inicio: date | None,
    data_fim: date | None,
) -> tuple[datetime, datetime, date, date]:
    hoje = datetime.now(timezone.utc).date()
    inicio_data = data_inicio or (hoje - timedelta(days=29))
    fim_data = data_fim or hoje

    if inicio_data > fim_data:
        raise HTTPException(status_code=400, detail="data_inicio não pode ser maior que data_fim")

    inicio_dt = datetime.combine(inicio_data, time.min, tzinfo=timezone.utc)
    # intervalo fechado em dias: [inicio, fim 23:59:59]
    fim_dt = datetime.combine(fim_data + timedelta(days=1), time.min, tzinfo=timezone.utc)
    return inicio_dt, fim_dt, inicio_data, fim_data


def _bucket_periodo(instante: datetime, granularidade: str) -> str:
    if granularidade == "dia":
        return instante.date().isoformat()
    if granularidade == "semana":
        inicio_semana = instante.date() - timedelta(days=instante.weekday())
        return inicio_semana.isoformat()
    if granularidade == "mes":
        return f"{instante.year:04d}-{instante.month:02d}"
    raise HTTPException(status_code=400, detail="granularidade deve ser dia, semana ou mes")


def _validar_paginacao(limit: int, offset: int) -> None:
    if limit < 1 or limit > 200:
        raise HTTPException(status_code=400, detail="limit deve estar entre 1 e 200")
    if offset < 0:
        raise HTTPException(status_code=400, detail="offset deve ser maior ou igual a 0")


def _filtros_resposta(data_inicio: date, data_fim: date, usuario_id: int | None) -> dict:
    return {
        "data_inicio": data_inicio.isoformat(),
        "data_fim": data_fim.isoformat(),
        "usuario_id": usuario_id,
    }

@router.get("/progresso")
async def get_progresso(db: AsyncSession = Depends(get_db)):
    query = select(models.Edificio)
    result = await db.execute(query)
    edificios = result.scalars().all()
    
    resultado = []
    for ed in edificios:
        lajes_query = select(models.Laje.id).where(models.Laje.edificio_id == ed.id)
        lajes_result = await db.execute(lajes_query)
        laje_ids = lajes_result.scalars().all()
        
        if not laje_ids:
            resultado.append({"id": ed.id, "nome": ed.nome, "percentual_conclusao": 0})
            continue
            
        total_query = select(func.count(models.Atividade.id)).where(models.Atividade.laje_id.in_(laje_ids))
        total = (await db.execute(total_query)).scalar()
        
        concluidas_query = select(func.count(models.Atividade.id)).where(
            models.Atividade.laje_id.in_(laje_ids),
            models.Atividade.status_atual.in_(["Ok", "Montada"])
        )
        concluidas = (await db.execute(concluidas_query)).scalar()
        
        percentual = (concluidas / total * 100) if total > 0 else 0
        resultado.append({"id": ed.id, "nome": ed.nome, "percentual_conclusao": round(percentual, 1)})
        
    return resultado

@router.get("/produtividade")
async def get_produtividade(db: AsyncSession = Depends(get_db)):
    # Tempo total por funcionário nos últimos 30 dias
    trinta_dias_atras = datetime.now(timezone.utc) - timedelta(days=30)
    
    query = (
        select(models.Usuario.nome, func.sum(models.SessaoTrabalho.duracao_segundos))
        .join(models.SessaoTrabalho)
        .where(models.SessaoTrabalho.finalizado_em != None)
        .where(models.SessaoTrabalho.iniciado_em >= trinta_dias_atras)
        .group_by(models.Usuario.nome)
    )
    
    result = await db.execute(query)
    return [
        {"usuario": nome, "horas": round(segundos / 3600, 1) if segundos else 0} 
        for nome, segundos in result.all()
    ]


@router.get("/horas-trabalhadas")
async def get_horas_trabalhadas(
    granularidade: str = "dia",
    data_inicio: date | None = None,
    data_fim: date | None = None,
    usuario_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    cache_key = _cache_key(
        "horas_trabalhadas",
        granularidade=granularidade,
        data_inicio=data_inicio,
        data_fim=data_fim,
        usuario_id=usuario_id,
    )
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    inicio_dt, fim_dt, inicio_data, fim_data = _normalizar_periodo(data_inicio, data_fim)

    if granularidade not in {"dia", "semana", "mes"}:
        raise HTTPException(status_code=400, detail="granularidade deve ser dia, semana ou mes")

    query = (
        select(
            models.SessaoTrabalho.usuario_id,
            models.Usuario.nome,
            models.SessaoTrabalho.finalizado_em,
            models.SessaoTrabalho.duracao_segundos,
        )
        .join(models.Usuario, models.Usuario.id == models.SessaoTrabalho.usuario_id)
        .where(models.SessaoTrabalho.finalizado_em != None)
        .where(models.SessaoTrabalho.finalizado_em >= inicio_dt)
        .where(models.SessaoTrabalho.finalizado_em < fim_dt)
    )

    if usuario_id is not None:
        query = query.where(models.SessaoTrabalho.usuario_id == usuario_id)

    result = await db.execute(query)
    linhas = result.all()

    serie_segundos: dict[str, int] = {}
    usuario_segundos: dict[int, dict[str, int | str]] = {}
    total_segundos = 0

    for uid, nome, finalizado_em, duracao in linhas:
        if not finalizado_em:
            continue

        duracao_seg = int(duracao or 0)
        total_segundos += duracao_seg

        instante_utc = finalizado_em.astimezone(timezone.utc)
        bucket = _bucket_periodo(instante_utc, granularidade)
        serie_segundos[bucket] = serie_segundos.get(bucket, 0) + duracao_seg

        if uid not in usuario_segundos:
            usuario_segundos[uid] = {"usuario_id": uid, "usuario_nome": nome, "segundos": 0}
        usuario_segundos[uid]["segundos"] = int(usuario_segundos[uid]["segundos"]) + duracao_seg

    dias_periodo = max((fim_data - inicio_data).days + 1, 1)

    serie = [
        {
            "periodo": periodo,
            "horas": round(segundos / 3600, 2),
        }
        for periodo, segundos in sorted(serie_segundos.items(), key=lambda x: x[0])
    ]

    por_usuario = [
        {
            "usuario_id": int(dados["usuario_id"]),
            "usuario_nome": str(dados["usuario_nome"]),
            "horas": round(int(dados["segundos"]) / 3600, 2),
        }
        for dados in sorted(usuario_segundos.values(), key=lambda x: int(x["segundos"]), reverse=True)
    ]

    payload = {
        "filtros": {
            "granularidade": granularidade,
            "data_inicio": inicio_data.isoformat(),
            "data_fim": fim_data.isoformat(),
            "usuario_id": usuario_id,
        },
        "resumo": {
            "total_horas": round(total_segundos / 3600, 2),
            "media_horas_dia": round((total_segundos / 3600) / dias_periodo, 2),
            "total_sessoes": len(linhas),
            "dias_periodo": dias_periodo,
        },
        "serie": serie,
        "por_usuario": por_usuario,
    }
    return _cache_set(cache_key, payload)


@router.get("/kpis-executivo")
async def get_kpis_executivo(
    data_inicio: date | None = None,
    data_fim: date | None = None,
    usuario_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    cache_key = _cache_key(
        "kpis_executivo",
        data_inicio=data_inicio,
        data_fim=data_fim,
        usuario_id=usuario_id,
    )
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    inicio_dt, fim_dt, inicio_data, fim_data = _normalizar_periodo(data_inicio, data_fim)

    # Throughput: atividades que chegaram aos status finais no período.
    throughput_query = (
        select(models.StatusHistorico.atividade_id, models.StatusHistorico.timestamp)
        .where(models.StatusHistorico.timestamp >= inicio_dt)
        .where(models.StatusHistorico.timestamp < fim_dt)
        .where(models.StatusHistorico.status_novo.in_(["Ok", "Montada", "Atendendo comentarios"]))
    )
    if usuario_id is not None:
        throughput_query = throughput_query.where(models.StatusHistorico.usuario_id == usuario_id)

    throughput_result = await db.execute(throughput_query)
    throughput_linhas = throughput_result.all()
    atividades_concluidas_ids = {atividade_id for atividade_id, _ in throughput_linhas}
    throughput = len(atividades_concluidas_ids)

    # Atividades em andamento (WIP): Fazendo com sessão ativa e Fazendo sem sessão ativa.
    em_andamento_query = select(models.Atividade.id).where(models.Atividade.status_atual == "Fazendo")
    if usuario_id is not None:
        em_andamento_query = em_andamento_query.where(models.Atividade.usuario_responsavel_id == usuario_id)
    em_andamento_result = await db.execute(em_andamento_query)
    em_andamento_ids = set(em_andamento_result.scalars().all())

    ativas_query = (
        select(models.SessaoTrabalho.atividade_id)
        .where(models.SessaoTrabalho.finalizado_em == None)
    )
    if usuario_id is not None:
        ativas_query = ativas_query.where(models.SessaoTrabalho.usuario_id == usuario_id)
    ativas_result = await db.execute(ativas_query)
    ativas_ids = set(ativas_result.scalars().all())

    fazendo_ativo = len(em_andamento_ids.intersection(ativas_ids))
    fazendo_inativo = max(len(em_andamento_ids) - fazendo_ativo, 0)

    payload = {
        "filtros": _filtros_resposta(inicio_data, fim_data, usuario_id),
        "kpis": {
            "throughput_concluidas": throughput,
            "fazendo_com_sessao_ativa": fazendo_ativo,
            "fazendo_sem_sessao_ativa": fazendo_inativo,
        },
    }
    return _cache_set(cache_key, payload)


@router.get("/horas-por-tarefa")
async def get_horas_por_tarefa(
    data_inicio: date | None = None,
    data_fim: date | None = None,
    usuario_id: int | None = None,
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    cache_key = _cache_key(
        "horas_por_tarefa",
        data_inicio=data_inicio,
        data_fim=data_fim,
        usuario_id=usuario_id,
        limit=limit,
        offset=offset,
    )
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    _validar_paginacao(limit, offset)
    inicio_dt, fim_dt, inicio_data, fim_data = _normalizar_periodo(data_inicio, data_fim)

    base_query = (
        select(
            models.SessaoTrabalho.usuario_id,
            models.Usuario.nome,
            models.SessaoTrabalho.atividade_id,
            models.Atividade.tipo_elemento,
            models.Atividade.subtipo,
            models.Laje.tipo,
            models.Edificio.nome,
            func.sum(models.SessaoTrabalho.duracao_segundos),
            func.count(models.SessaoTrabalho.id),
        )
        .join(models.Usuario, models.Usuario.id == models.SessaoTrabalho.usuario_id)
        .join(models.Atividade, models.Atividade.id == models.SessaoTrabalho.atividade_id)
        .join(models.Laje, models.Laje.id == models.Atividade.laje_id)
        .join(models.Edificio, models.Edificio.id == models.Laje.edificio_id)
        .where(models.SessaoTrabalho.finalizado_em != None)
        .where(models.SessaoTrabalho.duracao_segundos != None)
        .where(models.SessaoTrabalho.duracao_segundos > 0)
        .where(models.SessaoTrabalho.finalizado_em >= inicio_dt)
        .where(models.SessaoTrabalho.finalizado_em < fim_dt)
    )

    if usuario_id is not None:
        base_query = base_query.where(models.SessaoTrabalho.usuario_id == usuario_id)

    query = (
        base_query.group_by(
            models.SessaoTrabalho.usuario_id,
            models.Usuario.nome,
            models.SessaoTrabalho.atividade_id,
            models.Atividade.tipo_elemento,
            models.Atividade.subtipo,
            models.Laje.tipo,
            models.Edificio.nome,
        )
        .order_by(func.sum(models.SessaoTrabalho.duracao_segundos).desc())
        .offset(offset)
        .limit(limit + 1)
    )

    result = await db.execute(query)
    linhas = result.all()
    has_more = len(linhas) > limit
    linhas = linhas[:limit]

    itens = [
        {
            "usuario_id": uid,
            "usuario_nome": usuario_nome,
            "atividade_id": atividade_id,
            "tarefa": f"{tipo}{f' - {subtipo}' if subtipo else ''}",
            "laje": laje_tipo,
            "edificio": edificio_nome,
            "horas": round((total_seg or 0) / 3600, 2),
            "total_sessoes": int(total_sessoes or 0),
        }
        for uid, usuario_nome, atividade_id, tipo, subtipo, laje_tipo, edificio_nome, total_seg, total_sessoes in linhas
    ]

    payload = {
        "filtros": _filtros_resposta(inicio_data, fim_data, usuario_id),
        "itens": itens,
        "meta": {"limit": limit, "offset": offset, "total_itens": len(itens), "has_more": has_more},
    }
    return _cache_set(cache_key, payload)


@router.get("/tempo-medio/edificios")
async def get_tempo_medio_por_edificio(
    data_inicio: date | None = None,
    data_fim: date | None = None,
    usuario_id: int | None = None,
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    cache_key = _cache_key(
        "tempo_medio_edificios",
        data_inicio=data_inicio,
        data_fim=data_fim,
        usuario_id=usuario_id,
        limit=limit,
        offset=offset,
    )
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    _validar_paginacao(limit, offset)
    inicio_dt, fim_dt, inicio_data, fim_data = _normalizar_periodo(data_inicio, data_fim)

    base_query = (
        select(
            models.Edificio.id,
            models.Edificio.nome,
            func.avg(models.SessaoTrabalho.duracao_segundos),
            func.sum(models.SessaoTrabalho.duracao_segundos),
            func.count(models.SessaoTrabalho.id),
        )
        .join(models.Laje, models.Laje.edificio_id == models.Edificio.id)
        .join(models.Atividade, models.Atividade.laje_id == models.Laje.id)
        .join(models.SessaoTrabalho, models.SessaoTrabalho.atividade_id == models.Atividade.id)
        .where(models.SessaoTrabalho.finalizado_em != None)
        .where(models.SessaoTrabalho.duracao_segundos != None)
        .where(models.SessaoTrabalho.duracao_segundos > 0)
        .where(models.SessaoTrabalho.finalizado_em >= inicio_dt)
        .where(models.SessaoTrabalho.finalizado_em < fim_dt)
    )

    if usuario_id is not None:
        base_query = base_query.where(models.SessaoTrabalho.usuario_id == usuario_id)

    query = (
        base_query.group_by(models.Edificio.id, models.Edificio.nome)
        .order_by(func.avg(models.SessaoTrabalho.duracao_segundos).desc())
        .offset(offset)
        .limit(limit + 1)
    )

    result = await db.execute(query)
    linhas = result.all()
    has_more = len(linhas) > limit
    linhas = linhas[:limit]

    itens = [
        {
            "edificio_id": eid,
            "edificio_nome": nome,
            "tempo_medio_horas": round((avg_seg or 0) / 3600, 2),
            "total_horas": round((sum_seg or 0) / 3600, 2),
            "total_sessoes": int(total_sessoes or 0),
        }
        for eid, nome, avg_seg, sum_seg, total_sessoes in linhas
    ]

    payload = {
        "filtros": _filtros_resposta(inicio_data, fim_data, usuario_id),
        "itens": itens,
        "meta": {"limit": limit, "offset": offset, "total_itens": len(itens), "has_more": has_more},
    }
    return _cache_set(cache_key, payload)


@router.get("/tempo-medio/tipos")
async def get_tempo_medio_por_tipo(
    data_inicio: date | None = None,
    data_fim: date | None = None,
    usuario_id: int | None = None,
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    cache_key = _cache_key(
        "tempo_medio_tipos",
        data_inicio=data_inicio,
        data_fim=data_fim,
        usuario_id=usuario_id,
        limit=limit,
        offset=offset,
    )
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    _validar_paginacao(limit, offset)
    inicio_dt, fim_dt, inicio_data, fim_data = _normalizar_periodo(data_inicio, data_fim)

    base_query = (
        select(
            models.Atividade.tipo_elemento,
            models.Atividade.subtipo,
            func.avg(models.SessaoTrabalho.duracao_segundos),
            func.sum(models.SessaoTrabalho.duracao_segundos),
            func.count(models.SessaoTrabalho.id),
        )
        .join(models.SessaoTrabalho, models.SessaoTrabalho.atividade_id == models.Atividade.id)
        .where(models.SessaoTrabalho.finalizado_em != None)
        .where(models.SessaoTrabalho.duracao_segundos != None)
        .where(models.SessaoTrabalho.duracao_segundos > 0)
        .where(models.SessaoTrabalho.finalizado_em >= inicio_dt)
        .where(models.SessaoTrabalho.finalizado_em < fim_dt)
    )

    if usuario_id is not None:
        base_query = base_query.where(models.SessaoTrabalho.usuario_id == usuario_id)

    query = (
        base_query.group_by(models.Atividade.tipo_elemento, models.Atividade.subtipo)
        .order_by(func.avg(models.SessaoTrabalho.duracao_segundos).desc())
        .offset(offset)
        .limit(limit + 1)
    )

    result = await db.execute(query)
    linhas = result.all()
    has_more = len(linhas) > limit
    linhas = linhas[:limit]

    itens = [
        {
            "tipo_elemento": tipo,
            "subtipo": subtipo,
            "tempo_medio_horas": round((avg_seg or 0) / 3600, 2),
            "total_horas": round((sum_seg or 0) / 3600, 2),
            "total_sessoes": int(total_sessoes or 0),
        }
        for tipo, subtipo, avg_seg, sum_seg, total_sessoes in linhas
    ]

    payload = {
        "filtros": _filtros_resposta(inicio_data, fim_data, usuario_id),
        "itens": itens,
        "meta": {"limit": limit, "offset": offset, "total_itens": len(itens), "has_more": has_more},
    }
    return _cache_set(cache_key, payload)


@router.get("/tempo-medio/construtoras")
async def get_tempo_medio_por_construtora(
    data_inicio: date | None = None,
    data_fim: date | None = None,
    usuario_id: int | None = None,
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    cache_key = _cache_key(
        "tempo_medio_construtoras",
        data_inicio=data_inicio,
        data_fim=data_fim,
        usuario_id=usuario_id,
        limit=limit,
        offset=offset,
    )
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    _validar_paginacao(limit, offset)
    inicio_dt, fim_dt, inicio_data, fim_data = _normalizar_periodo(data_inicio, data_fim)

    base_query = (
        select(
            models.Construtora.id,
            models.Construtora.nome,
            func.avg(models.SessaoTrabalho.duracao_segundos),
            func.sum(models.SessaoTrabalho.duracao_segundos),
            func.count(models.SessaoTrabalho.id),
        )
        .join(models.Edificio, models.Edificio.construtora_id == models.Construtora.id)
        .join(models.Laje, models.Laje.edificio_id == models.Edificio.id)
        .join(models.Atividade, models.Atividade.laje_id == models.Laje.id)
        .join(models.SessaoTrabalho, models.SessaoTrabalho.atividade_id == models.Atividade.id)
        .where(models.SessaoTrabalho.finalizado_em != None)
        .where(models.SessaoTrabalho.duracao_segundos != None)
        .where(models.SessaoTrabalho.duracao_segundos > 0)
        .where(models.SessaoTrabalho.finalizado_em >= inicio_dt)
        .where(models.SessaoTrabalho.finalizado_em < fim_dt)
    )

    if usuario_id is not None:
        base_query = base_query.where(models.SessaoTrabalho.usuario_id == usuario_id)

    query = (
        base_query.group_by(models.Construtora.id, models.Construtora.nome)
        .order_by(func.avg(models.SessaoTrabalho.duracao_segundos).desc())
        .offset(offset)
        .limit(limit + 1)
    )

    result = await db.execute(query)
    linhas = result.all()
    has_more = len(linhas) > limit
    linhas = linhas[:limit]

    itens = [
        {
            "construtora_id": cid,
            "construtora_nome": nome,
            "tempo_medio_horas": round((avg_seg or 0) / 3600, 2),
            "total_horas": round((sum_seg or 0) / 3600, 2),
            "total_sessoes": int(total_sessoes or 0),
        }
        for cid, nome, avg_seg, sum_seg, total_sessoes in linhas
    ]

    payload = {
        "filtros": _filtros_resposta(inicio_data, fim_data, usuario_id),
        "itens": itens,
        "meta": {"limit": limit, "offset": offset, "total_itens": len(itens), "has_more": has_more},
    }
    return _cache_set(cache_key, payload)

async def obter_payload_sessoes_ativas(db: AsyncSession):
    query = (
        select(models.SessaoTrabalho)
        .where(models.SessaoTrabalho.finalizado_em == None)
        .options(
            selectinload(models.SessaoTrabalho.usuario),
            selectinload(models.SessaoTrabalho.atividade).selectinload(models.Atividade.laje).selectinload(models.Laje.edificio)
        )
    )
    result = await db.execute(query)
    sessoes = result.scalars().all()
    
    dados = []
    for s in sessoes:
        dados.append({
            "usuario_id": s.usuario_id,
            "usuario_nome": s.usuario.nome,
            "atividade_id": s.atividade_id,
            "atividade_descricao": f"{s.atividade.tipo_elemento} — {s.atividade.subtipo or ''}".strip(' — '),
            "edificio_nome": s.atividade.laje.edificio.nome,
            "laje_tipo": s.atividade.laje.tipo,
            "iniciado_em": s.iniciado_em.isoformat()
        })
    
    return {"tipo": "sessoes_ativas", "dados": dados}

# WebSocket movido para o main.py
