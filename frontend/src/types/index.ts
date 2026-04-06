export type Role = 'funcionario' | 'admin'

export interface Usuario {
  id: number
  nome: string
  role: Role
  ativo: boolean
  criado_em: string
}

export type TipoElemento =
  | 'Vigas' | 'Lajes' | 'GrelhaRefinada'
  | 'Cortinas' | 'Rampa' | 'Escada' | 'BlocosFundacao'

export type Subtipo = 'Rascunho' | 'Formato' | null

export type StatusAtividade =
  | 'Pendente' | 'Gerado' | 'Impresso' | 'Montada'
  | 'Fazendo' | 'Pausado' | 'Ok' | 'Atendendo comentarios'

export interface ProximosStatusAtividade {
  atividade_id: number
  status_atual: StatusAtividade
  opcoes: StatusAtividade[]
  selecao_obrigatoria: boolean
}

export interface AtividadeDetalhe {
  atividade: Atividade
  usuario_vinculado: Usuario | null
  iniciada_em: string | null
  pausada_em: string | null
  em_andamento_desde: string | null
}

export interface Atividade {
  id: number
  laje_id: number
  tipo_elemento: TipoElemento
  subtipo: Subtipo
  status_atual: StatusAtividade
  usuario_responsavel_id: number | null
  criado_em: string
  atualizado_em: string
  // Relacionamentos carregados opcionalmente
  laje?: Laje
}

export interface Laje {
  id: number
  edificio_id: number
  tipo: string
  ordem: number
  atividades?: Atividade[]
  edificio?: Edificio
}

export interface Edificio {
  id: number
  construtora_id: number
  construtora_nome?: string
  nome: string
  descricao: string | null
  criado_em: string
  encerrado_em: string | null
  percentual_conclusao?: number
  lajes?: Laje[]
}

export interface Construtora {
  id: number
  nome: string
  criado_em: string
  edificios?: Edificio[]
}

export interface SessaoTrabalho {
  id: number
  atividade_id: number
  usuario_id: number
  iniciado_em: string
  finalizado_em: string | null
  duracao_segundos: number | null
  atividade?: Atividade
  usuario?: Usuario
}

export interface UsuarioLocal {
  usuario_id: number
  nome: string
  role: Role
}
