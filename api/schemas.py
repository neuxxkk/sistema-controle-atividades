from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, List, Literal

SubtipoAtividade = Literal["Rascunho", "Formato"]
StatusAtividade = Literal[
    "Pendente",
    "Fazendo",
    "Pausado",
    "Ok",
    "Atendendo comentarios",
    "Gerado",
    "Impresso",
    "Montada",
]

# --- Usuario ---
class UsuarioBase(BaseModel):
    nome: str
    role: str
    ativo: bool = True

class UsuarioCreate(UsuarioBase):
    pass

class Usuario(UsuarioBase):
    id: int
    criado_em: datetime
    model_config = ConfigDict(from_attributes=True)

# --- Construtora ---
class ConstrutoraBase(BaseModel):
    nome: str

class ConstrutoraCreate(ConstrutoraBase):
    pass

class Construtora(ConstrutoraBase):
    id: int
    criado_em: datetime
    model_config = ConfigDict(from_attributes=True)

# --- Edificio ---
class EdificioBase(BaseModel):
    construtora_id: int
    nome: str
    descricao: Optional[str] = None

class EdificioCreate(EdificioBase):
    num_pavimentos: int

class Edificio(EdificioBase):
    id: int
    criado_em: datetime
    encerrado_em: Optional[datetime] = None
    # Adicionado para facilitar o frontend
    construtora: Optional[Construtora] = None
    model_config = ConfigDict(from_attributes=True)

# --- Laje ---
class LajeBase(BaseModel):
    edificio_id: int
    tipo: str
    ordem: int

class Laje(LajeBase):
    id: int
    criado_em: datetime
    edificio: Optional[Edificio] = None
    model_config = ConfigDict(from_attributes=True)

# --- Atividade ---
class AtividadeBase(BaseModel):
    laje_id: int
    tipo_elemento: str
    subtipo: Optional[SubtipoAtividade] = None
    status_atual: StatusAtividade
    usuario_responsavel_id: Optional[int] = None

class Atividade(AtividadeBase):
    id: int
    criado_em: datetime
    atualizado_em: datetime
    laje: Optional[Laje] = None
    model_config = ConfigDict(from_attributes=True)


class AtividadeDetalhe(BaseModel):
    atividade: Atividade
    usuario_vinculado: Optional[Usuario] = None
    iniciada_em: Optional[datetime] = None
    pausada_em: Optional[datetime] = None
    em_andamento_desde: Optional[datetime] = None


class ProximosStatusAtividade(BaseModel):
    atividade_id: int
    status_atual: StatusAtividade
    opcoes: List[StatusAtividade]
    selecao_obrigatoria: bool

# --- Sessao de Trabalho ---
class SessaoTrabalhoBase(BaseModel):
    atividade_id: int
    usuario_id: int

class SessaoTrabalhoCreate(SessaoTrabalhoBase):
    pass

class SessaoTrabalho(SessaoTrabalhoBase):
    id: int
    iniciado_em: datetime
    finalizado_em: Optional[datetime] = None
    duracao_segundos: Optional[int] = None
    atividade: Optional[Atividade] = None
    usuario: Optional[Usuario] = None
    model_config = ConfigDict(from_attributes=True)

# --- Historico ---
class StatusHistorico(BaseModel):
    id: int
    atividade_id: int
    usuario_id: int
    status_anterior: Optional[str] = None
    status_novo: str
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)
