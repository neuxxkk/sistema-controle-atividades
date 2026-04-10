"""
Serviço de workflow ação-orientado.

Cada ação (iniciar, pausar, retomar, avancar_etapa, finalizar) valida suas
pré-condições e aplica os efeitos de forma atômica. O commit é responsabilidade
do router chamador.
"""
from typing import Optional
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import models

# ── Mapeamento de etapas por tipo_elemento ─────────────────────────────────

ETAPAS: dict[str, list[str]] = {
    "Vigas":         ["Gerar desenhos", "Rascunho", "Montar formato"],
    "Lajes":         ["Elaboração inicial", "Correção", "Montar formato"],
    "GrelhaRefinada": ["Execução"],
    "BlocosFundacao": ["Execução"],
    "Cortinas":       ["Execução"],
    "Escada":         ["Execução"],
    "Rampa":          ["Execução"],
}


def etapa_total_para(tipo_elemento: str, subtipo: Optional[str] = None) -> int:
    """Retorna o número total de etapas para um tipo de tarefa."""
    if subtipo is not None:
        # Atividades legadas com subtipo são tratadas como etapa única
        return 1
    return len(ETAPAS.get(tipo_elemento, ["Execução"]))


def nome_etapa(tipo_elemento: str, etapa: int, subtipo: Optional[str] = None) -> str:
    """Retorna o nome descritivo de uma etapa."""
    if subtipo is not None:
        return subtipo
    etapas = ETAPAS.get(tipo_elemento, ["Execução"])
    idx = etapa - 1
    return etapas[idx] if 0 <= idx < len(etapas) else f"Etapa {etapa}"


# ── Helpers internos ───────────────────────────────────────────────────────

async def _sessao_ativa_usuario(usuario_id: int, db: AsyncSession) -> Optional[models.SessaoTrabalho]:
    result = await db.execute(
        select(models.SessaoTrabalho).where(
            models.SessaoTrabalho.usuario_id == usuario_id,
            models.SessaoTrabalho.finalizado_em == None,
        )
    )
    return result.scalars().first()


async def _sessao_ativa_atividade(atividade_id: int, db: AsyncSession) -> Optional[models.SessaoTrabalho]:
    result = await db.execute(
        select(models.SessaoTrabalho).where(
            models.SessaoTrabalho.atividade_id == atividade_id,
            models.SessaoTrabalho.finalizado_em == None,
        )
    )
    return result.scalars().first()


async def _fechar_sessao_ativa(atividade_id: int, db: AsyncSession) -> None:
    sessao = await _sessao_ativa_atividade(atividade_id, db)
    if sessao:
        agora = datetime.now(timezone.utc)
        sessao.finalizado_em = agora
        sessao.duracao_segundos = int((agora - sessao.iniciado_em).total_seconds())


def _registrar_historico(
    db: AsyncSession,
    atividade: models.Atividade,
    usuario_id: int,
    acao: str,
    status_anterior: str,
    status_novo: str,
    etapa_anterior: int,
    etapa_nova: int,
) -> None:
    db.add(models.StatusHistorico(
        atividade_id=atividade.id,
        usuario_id=usuario_id,
        acao=acao,
        status_anterior=status_anterior,
        status_novo=status_novo,
        etapa_anterior=etapa_anterior,
        etapa_nova=etapa_nova,
        timestamp=datetime.now(timezone.utc),
    ))


def _agora() -> datetime:
    return datetime.now(timezone.utc)


# ── Ações canônicas ────────────────────────────────────────────────────────

async def iniciar(atividade: models.Atividade, usuario_id: int, db: AsyncSession) -> models.Atividade:
    """
    Pré-condições:
      - status_ciclo == Pendente
      - Funcionário não possui outra tarefa Em andamento
    Efeitos:
      - status_ciclo → Em andamento
      - Vincula funcionário
      - Abre sessão de trabalho
    """
    if atividade.status_ciclo != "Pendente":
        raise HTTPException(400, f"Iniciar requer status Pendente. Atual: {atividade.status_ciclo}")

    sessao_aberta = await _sessao_ativa_usuario(usuario_id, db)
    if sessao_aberta and sessao_aberta.atividade_id != atividade.id:
        raise HTTPException(409, "Você já tem uma tarefa Em andamento. Pause-a antes de iniciar outra.")

    status_ant = atividade.status_ciclo
    atividade.status_ciclo = "Em andamento"
    atividade.status_atual = "Fazendo"
    atividade.usuario_responsavel_id = usuario_id
    atividade.atualizado_em = _agora()

    db.add(models.SessaoTrabalho(
        atividade_id=atividade.id,
        usuario_id=usuario_id,
        iniciado_em=_agora(),
    ))
    _registrar_historico(db, atividade, usuario_id, "iniciar", status_ant, "Em andamento", atividade.etapa_atual, atividade.etapa_atual)
    return atividade


async def pausar(atividade: models.Atividade, usuario_id: int, db: AsyncSession) -> models.Atividade:
    """
    Pré-condições:
      - status_ciclo == Em andamento
      - Usuário atual é o funcionário vinculado
    Efeitos:
      - Fecha sessão ativa
      - status_ciclo → Pausada
    """
    if atividade.status_ciclo != "Em andamento":
        raise HTTPException(400, f"Pausar requer status Em andamento. Atual: {atividade.status_ciclo}")

    if atividade.usuario_responsavel_id != usuario_id:
        raise HTTPException(403, "Somente o funcionário vinculado pode pausar esta tarefa.")

    status_ant = atividade.status_ciclo
    await _fechar_sessao_ativa(atividade.id, db)
    atividade.status_ciclo = "Pausada"
    atividade.status_atual = "Pausado"
    atividade.atualizado_em = _agora()

    _registrar_historico(db, atividade, usuario_id, "pausar", status_ant, "Pausada", atividade.etapa_atual, atividade.etapa_atual)
    return atividade


async def retomar(atividade: models.Atividade, usuario_id: int, db: AsyncSession) -> models.Atividade:
    """
    Pré-condições:
      - status_ciclo == Pausada
      - Funcionário não possui outra tarefa Em andamento
      - (Roubo de vínculo permitido quando Pausada)
    Efeitos:
      - status_ciclo → Em andamento
      - Atualiza vínculo para o usuário atual
      - Abre nova sessão de trabalho
    """
    if atividade.status_ciclo != "Pausada":
        raise HTTPException(400, f"Retomar requer status Pausada. Atual: {atividade.status_ciclo}")

    sessao_aberta = await _sessao_ativa_usuario(usuario_id, db)
    if sessao_aberta and sessao_aberta.atividade_id != atividade.id:
        raise HTTPException(409, "Você já tem uma tarefa Em andamento. Pause-a antes de retomar outra.")

    status_ant = atividade.status_ciclo
    atividade.status_ciclo = "Em andamento"
    atividade.status_atual = "Fazendo"
    atividade.usuario_responsavel_id = usuario_id
    atividade.atualizado_em = _agora()

    db.add(models.SessaoTrabalho(
        atividade_id=atividade.id,
        usuario_id=usuario_id,
        iniciado_em=_agora(),
    ))
    _registrar_historico(db, atividade, usuario_id, "retomar", status_ant, "Em andamento", atividade.etapa_atual, atividade.etapa_atual)
    return atividade


async def avancar_etapa(atividade: models.Atividade, usuario_id: int, db: AsyncSession) -> models.Atividade:
    """
    Pré-condições:
      - Não está na última etapa
      - status_ciclo == Pausada (qualquer funcionário) OU Em andamento (próprio vinculado)
    Efeitos:
      - etapa_atual += 1
      - Mantém status_ciclo
      - Registra histórico de etapa
    """
    if atividade.etapa_atual >= atividade.etapa_total:
        raise HTTPException(400, "Já está na última etapa. Use Finalizar.")

    pode = (
        atividade.status_ciclo == "Pausada"
        or (atividade.status_ciclo == "Em andamento" and atividade.usuario_responsavel_id == usuario_id)
    )
    if not pode:
        raise HTTPException(403, "Avançar etapa requer: Pausada (qualquer) ou Em andamento (próprio vinculado).")

    etapa_ant = atividade.etapa_atual
    atividade.etapa_atual += 1
    atividade.atualizado_em = _agora()

    _registrar_historico(db, atividade, usuario_id, "avancar_etapa", atividade.status_ciclo, atividade.status_ciclo, etapa_ant, atividade.etapa_atual)
    return atividade


async def finalizar(atividade: models.Atividade, usuario_id: int, db: AsyncSession) -> models.Atividade:
    """
    Pré-condições:
      - Está na última etapa
      - status_ciclo == Pausada (qualquer funcionário) OU Em andamento (próprio vinculado)
    Efeitos:
      - status_ciclo → Finalizada
      - Fecha sessão ativa (se houver)
      - Registra histórico final
    """
    if atividade.etapa_atual < atividade.etapa_total:
        raise HTTPException(
            400,
            f"Não está na última etapa ({atividade.etapa_atual}/{atividade.etapa_total}). Avance as etapas primeiro.",
        )

    pode = (
        atividade.status_ciclo == "Pausada"
        or (atividade.status_ciclo == "Em andamento" and atividade.usuario_responsavel_id == usuario_id)
    )
    if not pode:
        raise HTTPException(403, "Finalizar requer: Pausada (qualquer) ou Em andamento (próprio vinculado).")

    status_ant = atividade.status_ciclo
    await _fechar_sessao_ativa(atividade.id, db)
    atividade.status_ciclo = "Finalizada"
    atividade.status_atual = "Ok"
    atividade.atualizado_em = _agora()

    _registrar_historico(db, atividade, usuario_id, "finalizar", status_ant, "Finalizada", atividade.etapa_atual, atividade.etapa_atual)
    return atividade


# ── Helpers de consulta ────────────────────────────────────────────────────

def acoes_disponiveis(
    atividade: models.Atividade,
    usuario_id: int,
    tem_outra_em_andamento: bool,
) -> list[str]:
    """Retorna lista de ações permitidas para o (usuario_id, atividade) no estado atual."""
    s = atividade.status_ciclo
    ultima = atividade.etapa_atual >= atividade.etapa_total
    vinculado = atividade.usuario_responsavel_id == usuario_id

    if s == "Pendente":
        return [] if tem_outra_em_andamento else ["iniciar"]

    if s == "Em andamento":
        if not vinculado:
            return []
        acoes = ["pausar"]
        acoes.append("finalizar" if ultima else "avancar_etapa")
        return acoes

    if s == "Pausada":
        acoes = []
        if not tem_outra_em_andamento:
            acoes.append("retomar")
        acoes.append("finalizar" if ultima else "avancar_etapa")
        return acoes

    return []  # Finalizada


# ── Compatibilidade legada (mantida para endpoints de admin existentes) ────

def vincula_funcionario(tipo_elemento: str, subtipo: Optional[str]) -> bool:
    """Retorna se o tipo requer vínculo de funcionário (todos os novos tipos sim)."""
    return not (tipo_elemento == "Vigas" and subtipo == "Rascunho")


def transicoes_validas(tipo_elemento: str, subtipo: Optional[str], status_atual: str) -> list[str]:
    """Compatibilidade: transições do modelo legado."""
    _LEGADO: dict[tuple, dict] = {
        ("Vigas", "Rascunho"):  {"Pendente": ["Gerado"], "Gerado": ["Impresso"], "Impresso": ["Montada"]},
        ("Vigas", "Formato"):   {"Pendente": ["Fazendo"], "Fazendo": ["Ok"]},
        ("Lajes", "Rascunho"):  {"Pendente": ["Fazendo"], "Fazendo": ["Ok"]},
        ("Lajes", "Formato"):   {"Pendente": ["Fazendo"], "Fazendo": ["Atendendo comentarios"]},
    }
    _PADRAO = {"Pendente": ["Fazendo"], "Fazendo": ["Ok"]}
    regra = _LEGADO.get((tipo_elemento, subtipo), _PADRAO)
    return regra.get(status_atual, [])


def opcoes_avanco(tipo_elemento: str, subtipo: Optional[str], status_atual: str) -> list[str]:
    return [s for s in transicoes_validas(tipo_elemento, subtipo, status_atual) if s != "Fazendo"]


def validar_transicao(tipo_elemento: str, subtipo: Optional[str], status_atual: str, status_novo: str) -> None:
    validos = transicoes_validas(tipo_elemento, subtipo, status_atual)
    if status_novo not in validos:
        raise HTTPException(400, f"Transição inválida: {status_atual} → {status_novo}")


def status_inicial(tipo_elemento: str, subtipo: Optional[str]) -> str:
    return "Pendente"
