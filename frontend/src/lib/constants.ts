export const PROGRESSAO_STATUS: Record<string, Record<string, string>> = {
  'Vigas-Rascunho':  { 'Pendente': 'Gerado', 'Gerado': 'Impresso', 'Impresso': 'Montada' },
  'Vigas-Formato':   { 'Pendente': 'Fazendo', 'Fazendo': 'Ok' },
  'Lajes-Rascunho':  { 'Pendente': 'Fazendo', 'Fazendo': 'Ok' },
  'Lajes-Formato':   { 'Pendente': 'Fazendo', 'Fazendo': 'Atendendo comentarios' },
  'GrelhaRefinada':  { 'Pendente': 'Fazendo', 'Fazendo': 'Ok' },
  'Cortinas':        { 'Pendente': 'Fazendo', 'Fazendo': 'Ok' },
  'Rampa':           { 'Pendente': 'Fazendo', 'Fazendo': 'Ok' },
  'Escada':          { 'Pendente': 'Fazendo', 'Fazendo': 'Ok' },
  'BlocosFundacao':  { 'Pendente': 'Fazendo', 'Fazendo': 'Ok' },
}

export function vinculaFuncionario(tipoElemento: string, subtipo: string | null): boolean {
  return !(tipoElemento === 'Vigas' && subtipo === 'Rascunho')
}

export function obterProximoStatus(
  tipoElemento: string,
  subtipo: string | null,
  statusAtual: string
): string | null {
  const chave = subtipo ? `${tipoElemento}-${subtipo}` : tipoElemento
  return PROGRESSAO_STATUS[chave]?.[statusAtual] ?? null
}

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
  if (match) return `Laje ${match[1]}`
  return tipo
}

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') + '/api'
