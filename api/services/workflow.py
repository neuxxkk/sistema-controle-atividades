from dataclasses import dataclass
from typing import Optional

from fastapi import HTTPException


Status = str


@dataclass(frozen=True)
class WorkflowRule:
    transicoes: dict[Status, list[Status]]
    vincula_funcionario: bool


RULES: dict[tuple[str, Optional[str]], WorkflowRule] = {
    ("Vigas", "Rascunho"): WorkflowRule(
        transicoes={
            "Pendente": ["Gerado"],
            "Gerado": ["Impresso"],
            "Impresso": ["Montada"],
            "Montada": [],
        },
        vincula_funcionario=False,
    ),
    ("Vigas", "Formato"): WorkflowRule(
        transicoes={
            "Pendente": ["Fazendo"],
            "Fazendo": ["Ok"],
            "Ok": [],
        },
        vincula_funcionario=True,
    ),
    ("Lajes", "Rascunho"): WorkflowRule(
        transicoes={
            "Pendente": ["Fazendo"],
            "Fazendo": ["Ok"],
            "Ok": [],
        },
        vincula_funcionario=True,
    ),
    ("Lajes", "Formato"): WorkflowRule(
        transicoes={
            "Pendente": ["Fazendo"],
            "Fazendo": ["Atendendo comentarios"],
            "Atendendo comentarios": [],
        },
        vincula_funcionario=True,
    ),
    ("GrelhaRefinada", None): WorkflowRule(
        transicoes={
            "Pendente": ["Fazendo"],
            "Fazendo": ["Ok"],
            "Ok": [],
        },
        vincula_funcionario=True,
    ),
    ("Cortinas", None): WorkflowRule(
        transicoes={
            "Pendente": ["Fazendo"],
            "Fazendo": ["Ok"],
            "Ok": [],
        },
        vincula_funcionario=True,
    ),
    ("Rampa", None): WorkflowRule(
        transicoes={
            "Pendente": ["Fazendo"],
            "Fazendo": ["Ok"],
            "Ok": [],
        },
        vincula_funcionario=True,
    ),
    ("Escada", None): WorkflowRule(
        transicoes={
            "Pendente": ["Fazendo"],
            "Fazendo": ["Ok"],
            "Ok": [],
        },
        vincula_funcionario=True,
    ),
    ("BlocosFundacao", None): WorkflowRule(
        transicoes={
            "Pendente": ["Fazendo"],
            "Fazendo": ["Ok"],
            "Ok": [],
        },
        vincula_funcionario=True,
    ),
}


def _rule_for(tipo_elemento: str, subtipo: Optional[str]) -> WorkflowRule:
    rule = RULES.get((tipo_elemento, subtipo))
    if rule:
        return rule

    fallback = RULES.get((tipo_elemento, None))
    if fallback:
        return fallback

    raise HTTPException(
        status_code=400,
        detail=f"Fluxo não configurado para elemento={tipo_elemento} subtipo={subtipo}",
    )


def vincula_funcionario(tipo_elemento: str, subtipo: Optional[str]) -> bool:
    return _rule_for(tipo_elemento, subtipo).vincula_funcionario


def transicoes_validas(tipo_elemento: str, subtipo: Optional[str], status_atual: str) -> list[str]:
    rule = _rule_for(tipo_elemento, subtipo)
    return rule.transicoes.get(status_atual, [])


def opcoes_avanco(tipo_elemento: str, subtipo: Optional[str], status_atual: str) -> list[str]:
    opcoes = transicoes_validas(tipo_elemento, subtipo, status_atual)
    return [s for s in opcoes if s != "Fazendo"]


def validar_transicao(
    tipo_elemento: str,
    subtipo: Optional[str],
    status_atual: str,
    status_novo: str,
) -> None:
    validos = transicoes_validas(tipo_elemento, subtipo, status_atual)
    if status_novo not in validos:
        raise HTTPException(
            status_code=400,
            detail=f"Transição inválida: {status_atual} -> {status_novo}",
        )


def status_inicial(tipo_elemento: str, subtipo: Optional[str]) -> str:
    rule = _rule_for(tipo_elemento, subtipo)
    if "Pendente" in rule.transicoes:
        return "Pendente"

    raise HTTPException(
        status_code=400,
        detail=f"Fluxo sem status inicial para elemento={tipo_elemento} subtipo={subtipo}",
    )