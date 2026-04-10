from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, List, Literal

SubtipoAtividade = Literal["Rascunho", "Formato"]

# Status legado — mantido para compatibilidade de dados existentes
StatusAtividade = Literal[
    "Pendente", "Fazendo", "Pausado", "Ok",
    "Atendendo comentarios", "Gerado", "Impresso", "Montada",
]

# Novo ciclo de vida canônico
StatusCiclo = Literal["Pendente", "Em andamento", "Pausada", "Finalizada"]

AcaoAtividade = Literal["iniciar", "pausar", "retomar", "avancar_etapa", "finalizar"]

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
    construtora: Optional[Construtora] = None
    model_config = ConfigDict(from_attributes=True)

class EdificioComLajes(Edificio):
    lajes: List["Laje"] = []

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
    status_ciclo: StatusCiclo = "Pendente"
    etapa_atual: int = 1
    etapa_total: int = 1
    usuario_responsavel_id: Optional[int] = None

class Atividade(AtividadeBase):
    id: int
    criado_em: datetime
    atualizado_em: datetime
    laje: Optional[Laje] = None
    usuario_responsavel: Optional[Usuario] = None
    model_config = ConfigDict(from_attributes=True)


class TempoPorUsuario(BaseModel):
    usuario: Usuario
    tempo_segundos: int

class AtividadeDetalhe(BaseModel):
    atividade: Atividade
    usuario_vinculado: Optional[Usuario] = None
    iniciada_em: Optional[datetime] = None
    finalizada_em: Optional[datetime] = None
    em_andamento_desde: Optional[datetime] = None
    tempo_por_usuario: List[TempoPorUsuario] = []


class ProximosStatusAtividade(BaseModel):
    atividade_id: int
    status_atual: StatusAtividade
    opcoes: List[StatusAtividade]
    selecao_obrigatoria: bool

# Resposta das ações do novo workflow
class AcoesDisponiveis(BaseModel):
    atividade_id: int
    status_ciclo: StatusCiclo
    etapa_atual: int
    etapa_total: int
    acoes: List[AcaoAtividade]

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
class EdificioDetalhe(BaseModel):
    edificio: Edificio
    primeiro_inicio: Optional[datetime] = None
    ultima_finalizacao: Optional[datetime] = None
    total_atividades: int = 0
    atividades_finalizadas: int = 0
    tempo_por_usuario: List[TempoPorUsuario] = []


class StatusHistorico(BaseModel):
    id: int
    atividade_id: int
    usuario_id: Optional[int] = None
    acao: Optional[str] = None
    status_anterior: Optional[str] = None
    status_novo: str
    etapa_anterior: Optional[int] = None
    etapa_nova: Optional[int] = None
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)
