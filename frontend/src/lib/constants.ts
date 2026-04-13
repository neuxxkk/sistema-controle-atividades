import type { StatusCiclo, AcaoAtividade, Atividade } from '@/types'

// Nomes das etapas por tipo_elemento
export const ETAPAS: Record<string, string[]> = {
  Vigas:         ['Gerar desenhos', 'Rascunho', 'Montar formato'],
  Lajes:         ['Elaboração inicial', 'Correção', 'Montar formato'],
  GrelhaRefinada: ['Execução'],
  BlocosFundacao: ['Execução'],
  Cortinas:       ['Execução'],
  Escada:         ['Execução'],
  Rampa:          ['Execução'],
}

export function nomeEtapa(tipoElemento: string, etapa: number, subtipo?: string | null): string {
  if (subtipo) return subtipo
  const etapas = ETAPAS[tipoElemento] ?? ['Execução']
  return etapas[etapa - 1] ?? `Etapa ${etapa}`
}

export const LABEL_STATUS_CICLO: Record<StatusCiclo, string> = {
  'Pendente':     'Pendente',
  'Em andamento': 'Em andamento',
  'Pausada':      'Pausada',
  'Etapa concluida': 'Etapa concluida',
  'Finalizada':   'Finalizada',
}

export const COR_STATUS_CICLO: Record<StatusCiclo, string> = {
  'Pendente':     'var(--cinza-400)',
  'Em andamento': 'var(--verde-principal)',
  'Pausada':      '#f59e0b',
  'Etapa concluida': '#2563eb',
  'Finalizada':   '#6366f1',
}

export const LABEL_ACAO: Record<AcaoAtividade, string> = {
  iniciar:       'Iniciar',
  pausar:        'Pausar',
  retomar:       'Retomar',
  avancar_etapa: 'Concluir etapa',
  finalizar:     'Finalizar',
}

export const COR_ACAO: Record<AcaoAtividade, string> = {
  iniciar:       'var(--verde-principal)',
  pausar:        '#f59e0b',
  retomar:       'var(--verde-principal)',
  avancar_etapa: '#3b82f6',
  finalizar:     '#6366f1',
}

/**
 * Calcula as ações disponíveis para um usuário numa atividade.
 * A lógica espelha o backend (workflow.py::acoes_disponiveis).
 */
export function calcularAcoes(
  atividade: Atividade,
  usuarioId: number | null,
  temOutraEmAndamento: boolean,
  modoAdmin = false,
): AcaoAtividade[] {
  const { status_ciclo, etapa_atual, etapa_total, usuario_responsavel_id } = atividade
  const ultimaEtapa = etapa_atual >= etapa_total
  const vinculado = usuario_responsavel_id === usuarioId

  if (status_ciclo === 'Pendente') {
    if (temOutraEmAndamento && !modoAdmin) return []
    return ['iniciar']
  }

  if (status_ciclo === 'Em andamento') {
    if (!vinculado && !modoAdmin) return []
    return ['pausar', ultimaEtapa ? 'finalizar' : 'avancar_etapa']
  }

  if (status_ciclo === 'Pausada') {
    const acoes: AcaoAtividade[] = []
    if (!temOutraEmAndamento || modoAdmin) acoes.push('retomar')
    if (ultimaEtapa) {
      acoes.push('finalizar')
    } else if (vinculado || modoAdmin) {
      acoes.push('avancar_etapa')
    }
    return acoes
  }

  if (status_ciclo === 'Etapa concluida') {
    if (temOutraEmAndamento && !modoAdmin) return []
    return ['retomar']
  }

  return [] // Finalizada
}

// ── Formatadores ────────────────────────────────────────────────────────────

export function formatarTipoElemento(tipo: string, subtipo: string | null): string {
  const nomes: Record<string, string> = {
    Vigas: 'Vigas', Lajes: 'Lajes',
    GrelhaRefinada: 'Grelha refinada', Cortinas: 'Cortinas',
    Rampa: 'Rampa', Escada: 'Escada', BlocosFundacao: 'Blocos de fundação',
  }
  const base = nomes[tipo] ?? tipo
  return subtipo ? `${base} — ${subtipo}` : base
}

export function formatarLaje(tipo: string): string {
  if (tipo === 'Fundacao') return 'Fundação'
  if (tipo === 'FundCX')   return 'FundCX'
  if (tipo === 'TampaCX')  return 'TampaCX'
  const match = tipo.match(/^Laje_(\d+)$/)
  if (match) return `${match[1]}ª Laje`
  const matchTipo = tipo.match(/^tipo[\s_-]*(\d+)$/i)
  if (matchTipo) return `${matchTipo[1]}º Tipo`
  return tipo
}

type EdificioLike = {
  nome?: string | null
  construtora?: { nome?: string | null } | null
  construtora_nome?: string | null
}

export function formatarNomeEdificio(edificio?: EdificioLike | null, fallback = 'Edifício'): string {
  if (!edificio?.nome) return fallback
  const construtoraNome = edificio.construtora?.nome || edificio.construtora_nome
  return construtoraNome ? `${construtoraNome} - ${edificio.nome}` : edificio.nome
}

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') + '/api'

// Compatibilidade legada
export function vinculaFuncionario(tipoElemento: string, subtipo: string | null): boolean {
  return !(tipoElemento === 'Vigas' && subtipo === 'Rascunho')
}
