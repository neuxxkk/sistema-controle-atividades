from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from database import get_db
import models
import schemas

router = APIRouter(prefix="", tags=["Usuários"])


def _normalizar_nome(nome: str) -> str:
    return " ".join(nome.strip().split()).lower()


def _vinculo_igual(vinculo: models.VinculoMaquina, payload: schemas.VinculoMaquinaBase) -> bool:
    return (
        vinculo.nome_dispositivo == payload.nome_dispositivo
        and vinculo.ip == payload.ip
        and vinculo.windows_username == payload.windows_username
    )


async def _buscar_usuario_por_nome(nome: str, db: AsyncSession) -> models.Usuario | None:
    normalized = _normalizar_nome(nome)
    result = await db.execute(
        select(models.Usuario).where(func.lower(models.Usuario.nome) == normalized)
    )
    return result.scalar_one_or_none()


async def _buscar_vinculo_por_usuario(usuario_id: int, db: AsyncSession) -> models.VinculoMaquina | None:
    result = await db.execute(
        select(models.VinculoMaquina).where(models.VinculoMaquina.usuario_id == usuario_id)
    )
    return result.scalar_one_or_none()


async def _existe_vinculo_admin(db: AsyncSession) -> bool:
    result = await db.execute(
        select(models.VinculoMaquina.id)
        .join(models.Usuario, models.Usuario.id == models.VinculoMaquina.usuario_id)
        .where(models.Usuario.role == "admin")
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def _registrar_historico_vinculo(
    db: AsyncSession,
    usuario_id: int,
    acao: str,
    depois: schemas.VinculoMaquinaBase,
    antes: models.VinculoMaquina | None = None,
    admin_id: int | None = None,
) -> None:
    db.add(models.VinculoMaquinaHistorico(
        usuario_id=usuario_id,
        admin_id=admin_id,
        acao=acao,
        nome_dispositivo_antes=antes.nome_dispositivo if antes else None,
        ip_antes=antes.ip if antes else None,
        windows_username_antes=antes.windows_username if antes else None,
        nome_dispositivo_depois=depois.nome_dispositivo,
        ip_depois=depois.ip,
        windows_username_depois=depois.windows_username,
    ))


@router.get("/ambiente-atual")
async def get_ambiente_atual(request: Request):
    forwarded_for = request.headers.get("x-forwarded-for")
    ip_origem = (forwarded_for.split(",")[0].strip() if forwarded_for else None) or request.client.host
    user_agent = request.headers.get("user-agent", "")
    return {
        "ip": ip_origem,
        "user_agent": user_agent,
    }

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


@router.post("/primeiro-acesso", response_model=schemas.PrimeiroAcessoResponse)
async def primeiro_acesso(payload: schemas.PrimeiroAcessoRequest, db: AsyncSession = Depends(get_db)):
    usuario = await _buscar_usuario_por_nome(payload.nome_completo, db)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    existe_vinculo_admin = await _existe_vinculo_admin(db)
    if not existe_vinculo_admin and usuario.role != "admin":
        raise HTTPException(
            status_code=403,
            detail=(
                "Primeiro vínculo de máquina do sistema deve ser de um admin. "
                "Faça o primeiro acesso com um usuário administrador."
            ),
        )

    if existe_vinculo_admin and usuario.role != "funcionario":
        raise HTTPException(status_code=403, detail="Primeiro acesso disponível apenas para funcionário")
    if not usuario.ativo:
        raise HTTPException(status_code=403, detail="Usuário inativo")

    vinculo = await _buscar_vinculo_por_usuario(usuario.id, db)
    if not vinculo:
        novo_vinculo = models.VinculoMaquina(
            usuario_id=usuario.id,
            nome_dispositivo=payload.nome_dispositivo,
            ip=payload.ip,
            windows_username=payload.windows_username,
        )
        db.add(novo_vinculo)
        await _registrar_historico_vinculo(
            db=db,
            usuario_id=usuario.id,
            acao="primeiro_acesso",
            depois=payload,
        )
        await db.commit()
        await db.refresh(novo_vinculo)
        await db.refresh(usuario)
        return schemas.PrimeiroAcessoResponse(usuario=usuario, vinculo_maquina=novo_vinculo, primeiro_acesso=True)

    if _vinculo_igual(vinculo, payload):
        return schemas.PrimeiroAcessoResponse(usuario=usuario, vinculo_maquina=vinculo, primeiro_acesso=False)

    # Caso especial acordado: IP alterado em DHCP, usuário confirma que é sua máquina anterior.
    if payload.confirmar_maquina_anterior and vinculo.nome_dispositivo == payload.nome_dispositivo:
        vinculo_anterior = models.VinculoMaquina(
            usuario_id=vinculo.usuario_id,
            nome_dispositivo=vinculo.nome_dispositivo,
            ip=vinculo.ip,
            windows_username=vinculo.windows_username,
        )
        vinculo.ip = payload.ip
        vinculo.windows_username = payload.windows_username
        await _registrar_historico_vinculo(
            db=db,
            usuario_id=usuario.id,
            acao="atualizacao_ip_confirmada",
            antes=vinculo_anterior,
            depois=payload,
        )
        await db.commit()
        await db.refresh(vinculo)
        return schemas.PrimeiroAcessoResponse(usuario=usuario, vinculo_maquina=vinculo, primeiro_acesso=False)

    raise HTTPException(
        status_code=403,
        detail=(
            "Máquina não autorizada para este usuário. "
            "Solicite ao admin a alteração de vínculo."
        ),
    )


@router.get("/{usuario_id}/vinculo-maquina", response_model=schemas.UsuarioComVinculo)
async def get_usuario_com_vinculo(
    usuario_id: int,
    solicitante_id: int,
    db: AsyncSession = Depends(get_db),
):
    usuario = await db.get(models.Usuario, usuario_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    solicitante = await db.get(models.Usuario, solicitante_id)
    if not solicitante:
        raise HTTPException(status_code=404, detail="Solicitante não encontrado")
    if solicitante.role != "admin" and solicitante.id != usuario_id:
        raise HTTPException(status_code=403, detail="Sem permissão para consultar vínculo")

    vinculo = await _buscar_vinculo_por_usuario(usuario_id, db)
    return schemas.UsuarioComVinculo(usuario=usuario, vinculo_maquina=vinculo)


@router.put("/{usuario_id}/vinculo-maquina", response_model=schemas.UsuarioComVinculo)
async def alterar_vinculo_maquina(
    usuario_id: int,
    payload: schemas.AlterarVinculoMaquinaRequest,
    db: AsyncSession = Depends(get_db),
):
    usuario = await db.get(models.Usuario, usuario_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    admin = await db.get(models.Usuario, payload.admin_id)
    if not admin:
        raise HTTPException(status_code=404, detail="Admin não encontrado")
    if admin.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin pode alterar vínculo de máquina")

    vinculo = await _buscar_vinculo_por_usuario(usuario_id, db)
    vinculo_anterior = None
    if vinculo:
        vinculo_anterior = models.VinculoMaquina(
            usuario_id=vinculo.usuario_id,
            nome_dispositivo=vinculo.nome_dispositivo,
            ip=vinculo.ip,
            windows_username=vinculo.windows_username,
        )
        vinculo.nome_dispositivo = payload.nome_dispositivo
        vinculo.ip = payload.ip
        vinculo.windows_username = payload.windows_username
    else:
        vinculo = models.VinculoMaquina(
            usuario_id=usuario_id,
            nome_dispositivo=payload.nome_dispositivo,
            ip=payload.ip,
            windows_username=payload.windows_username,
        )
        db.add(vinculo)

    await _registrar_historico_vinculo(
        db=db,
        usuario_id=usuario_id,
        admin_id=payload.admin_id,
        acao="alteracao_admin",
        antes=vinculo_anterior,
        depois=payload,
    )

    await db.commit()
    await db.refresh(vinculo)
    return schemas.UsuarioComVinculo(usuario=usuario, vinculo_maquina=vinculo)


@router.get("/{usuario_id}/vinculo-maquina/historico", response_model=List[schemas.VinculoMaquinaHistorico])
async def get_historico_vinculo_maquina(
    usuario_id: int,
    solicitante_id: int,
    db: AsyncSession = Depends(get_db),
):
    solicitante = await db.get(models.Usuario, solicitante_id)
    if not solicitante:
        raise HTTPException(status_code=404, detail="Solicitante não encontrado")
    if solicitante.role != "admin" and solicitante.id != usuario_id:
        raise HTTPException(status_code=403, detail="Sem permissão para consultar histórico")

    result = await db.execute(
        select(models.VinculoMaquinaHistorico)
        .where(models.VinculoMaquinaHistorico.usuario_id == usuario_id)
        .order_by(models.VinculoMaquinaHistorico.criado_em.desc())
    )
    return result.scalars().all()

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
