export type Role = 'funcionario' | 'admin'

export interface Usuario {
  id: number
  nome: string
  role: Role
  ativo: boolean
  criado_em: string
}

export interface VinculoMaquina {
  id: number
  usuario_id: number
  nome_dispositivo: string
  ip: string
  windows_username: string
  criado_em: string
  atualizado_em: string
}

export interface PrimeiroAcessoRequest {
  nome_completo: string
  nome_dispositivo: string
  ip: string
  windows_username: string
  confirmar_maquina_anterior?: boolean
}

export interface PrimeiroAcessoResponse {
  usuario: Usuario
  vinculo_maquina: VinculoMaquina | null
  primeiro_acesso: boolean
}

export interface AlterarVinculoMaquinaRequest {
  admin_id: number
  nome_dispositivo: string
  ip: string
  windows_username: string
}

export interface VinculoMaquinaHistorico {
  id: number
  usuario_id: number
  admin_id: number | null
  acao: string
  nome_dispositivo_antes: string | null
  ip_antes: string | null
  windows_username_antes: string | null
  nome_dispositivo_depois: string
  ip_depois: string
  windows_username_depois: string
  criado_em: string
}

export type TipoElemento =
  | 'Vigas' | 'Lajes' | 'GrelhaRefinada'
  | 'Cortinas' | 'Rampa' | 'Escada' | 'BlocosFundacao'

export type Subtipo = 'Rascunho' | 'Formato' | null

// Status legado — mantido para compatibilidade com dados existentes
export type StatusAtividade =
  | 'Pendente' | 'Gerado' | 'Impresso' | 'Montada'
  | 'Fazendo' | 'Pausado' | 'Ok' | 'Atendendo comentarios'

// Novo ciclo de vida canônico
export type StatusCiclo = 'Pendente' | 'Em andamento' | 'Pausada' | 'Finalizada'

export type AcaoAtividade = 'iniciar' | 'pausar' | 'retomar' | 'avancar_etapa' | 'finalizar'

export interface ProximosStatusAtividade {
  atividade_id: number
  status_atual: StatusAtividade
  opcoes: StatusAtividade[]
  selecao_obrigatoria: boolean
}

export interface AcoesDisponiveis {
  atividade_id: number
  status_ciclo: StatusCiclo
  etapa_atual: number
  etapa_total: number
  acoes: AcaoAtividade[]
}

export interface AtividadeDetalhe {
  atividade: Atividade
  usuario_vinculado: Usuario | null
  iniciada_em: string | null
  finalizada_em: string | null
  em_andamento_desde: string | null
  tempo_por_usuario: { usuario: Usuario; tempo_segundos: number }[]
}

export interface Atividade {
  id: number
  laje_id: number
  tipo_elemento: TipoElemento
  subtipo: Subtipo
  status_atual: StatusAtividade
  status_ciclo: StatusCiclo
  etapa_atual: number
  etapa_total: number
  usuario_responsavel_id: number | null
  criado_em: string
  atualizado_em: string
  laje?: Laje
  usuario_responsavel?: Usuario | null
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
  construtora?: { id: number; nome: string; criado_em: string }
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

export interface ItemRelatorio {
  id: number
  edificio: string
  laje: string
  tarefa: string
  status: string
  etapa_atual: number
  etapa_total: number
  tipo_original: string
  horas_totais: number
  contribuicoes: { usuario: string; horas: number }[]
}

export interface EdificioDetalhe {
  edificio: Edificio
  primeiro_inicio: string | null
  ultima_finalizacao: string | null
  total_atividades: number
  atividades_finalizadas: number
  tempo_por_usuario: { usuario: Usuario; tempo_segundos: number }[]
}

export interface UsuarioLocal {
  usuario_id: number
  nome: string
  role: Role
}
