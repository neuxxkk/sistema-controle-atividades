'use client'
import { useState, useCallback, useMemo, useEffect } from 'react'
import type { Edificio, Laje, Atividade, AcaoAtividade, StatusCiclo } from '@/types'
import {
  formatarLaje, formatarTipoElemento, calcularAcoes,
  LABEL_ACAO, COR_ACAO, LABEL_STATUS_CICLO, COR_STATUS_CICLO, nomeEtapa,
} from '@/lib/constants'

// ── Tipos ──────────────────────────────────────────────────────────────────

export type EdificioCompleto = Edificio & { lajes: (Laje & { atividades: Atividade[] })[] }

interface Props {
  edificio: EdificioCompleto
  usuarioId: number | null
  modoAdmin: boolean
  atividadeEmAndamentoId: number | null
  onAcao: (tipo: AcaoAtividade, atividadeId: number) => Promise<void>
  filtroTexto?: string
  onDetalhe?: (atividadeId: number) => void
  // Compatibilidade legada (admin com dropdown de status)
  onUpdateStatus?: (atividadeId: number, novoStatus: string) => void
  statusOpcoesPorAtividade?: Record<number, string[]>
}

const TIPOS_COM_ETAPAS = ['Vigas', 'Lajes'] as const
const TIPOS_GERAIS_ORDEM = [
  'GrelhaRefinada', 'Cortinas', 'Rampa', 'Escada', 'BlocosFundacao',
] as const

// ── Helpers de estilo ──────────────────────────────────────────────────────

const ROW_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(200px, 1fr) 100px 150px 200px 220px',
  alignItems: 'center',
  gap: '20px',
  padding: '6px 16px',
  borderBottom: '1px solid var(--cinza-100)',
  minHeight: '40px',
}

const HEADER_COL: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  color: 'var(--cinza-500)',
}

function StatusPill({ status }: { status: StatusCiclo }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '1px 8px',
      borderRadius: '4px',
      fontSize: '10px',
      fontWeight: 700,
      fontFamily: "'Barlow Condensed', sans-serif",
      letterSpacing: '0.04em',
      textTransform: 'uppercase' as const,
      background: status === 'Em andamento' ? 'var(--verde-claro)'
        : status === 'Pausada' ? '#fef3c7'
        : status === 'Finalizada' ? '#ede9fe'
        : 'var(--cinza-100)',
      color: COR_STATUS_CICLO[status],
      border: `1px solid ${status === 'Em andamento' ? 'var(--verde-principal)'
        : status === 'Pausada' ? '#f59e0b'
        : status === 'Finalizada' ? '#6366f1'
        : 'var(--cinza-300)'}`,
    }}>
      {LABEL_STATUS_CICLO[status]}
    </span>
  )
}

function BotaoAcao({
  acao,
  onClick,
  disabled,
}: {
  acao: AcaoAtividade
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={LABEL_ACAO[acao]}
      style={{
        padding: '3px 10px',
        borderRadius: '4px',
        border: `1px solid ${disabled ? 'var(--cinza-300)' : COR_ACAO[acao]}`,
        background: disabled ? 'transparent' : 'transparent',
        color: disabled ? 'var(--cinza-400)' : COR_ACAO[acao],
        fontSize: '11px',
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 700,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.04em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap' as const,
        transition: 'all 150ms',
      }}
    >
      {LABEL_ACAO[acao]}
    </button>
  )
}

// ── Componente principal ───────────────────────────────────────────────────

export function ArvoreEstrutura({
  edificio,
  usuarioId,
  modoAdmin,
  atividadeEmAndamentoId,
  onAcao,
  filtroTexto = '',
  onDetalhe,
  onUpdateStatus,
  statusOpcoesPorAtividade = {},
}: Props) {
  const [lajsAbertas, setLajsAbertas] = useState<Set<number>>(new Set())
  const [geraisAbertas, setGeraisAbertas] = useState(false)
  const [executando, setExecutando] = useState<Set<number>>(new Set())

  const lajes = edificio.lajes || []
  const lajesOrdenadas = [...lajes].sort((a, b) => a.ordem - b.ordem)

  const normalizar = (t: string) =>
    t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

  const termos = normalizar(filtroTexto).split(/\s+/).filter(Boolean)

  const combinaFiltro = (ativ: Atividade, lajeTipo?: string) => {
    if (!termos.length) return true
    const txt = normalizar([
      ativ.tipo_elemento, ativ.subtipo ?? '',
      ativ.status_ciclo, ativ.status_atual,
      lajeTipo ? formatarLaje(lajeTipo) : '',
    ].join(' '))
    return termos.every(t => txt.includes(t))
  }

  // Expandir / recolher todos
  const expandirTodos = useCallback(() => {
    setLajsAbertas(new Set(lajesOrdenadas.map(l => l.id)))
    setGeraisAbertas(true)
  }, [lajesOrdenadas])

  const toggleLaje = (id: number) => {
    setLajsAbertas(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // Handler de ação com loading por atividade
  const handleAcao = async (tipo: AcaoAtividade, atividadeId: number) => {
    if (executando.has(atividadeId)) return
    setExecutando(prev => new Set(prev).add(atividadeId))
    try {
      await onAcao(tipo, atividadeId)
    } finally {
      setExecutando(prev => {
        const next = new Set(prev)
        next.delete(atividadeId)
        return next
      })
    }
  }

  const temOutraEmAndamento = (atividadeId: number) =>
    atividadeEmAndamentoId !== null && atividadeEmAndamentoId !== atividadeId

  // ── Linha de atividade ────────────────────────────────────────────────
  const renderLinhaAtividade = (ativ: Atividade, indentLevel = 0) => {
    const acoes = calcularAcoes(ativ, usuarioId, temOutraEmAndamento(ativ.id), modoAdmin)
    const carregando = executando.has(ativ.id)

    // Modo legado: exibe dropdown de status
    if (onUpdateStatus && !onAcao) {
      const opcoesPermitidas = statusOpcoesPorAtividade[ativ.id] ?? [ativ.status_atual]
      const podeAlterar = opcoesPermitidas.some(s => s !== ativ.status_atual)
      return (
        <div key={ativ.id} style={{ ...ROW_STYLE, paddingLeft: `${12 + indentLevel * 16}px` }}>
          <span style={{ fontSize: '13px', fontWeight: 500 }}>
            {formatarTipoElemento(ativ.tipo_elemento, ativ.subtipo)}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--cinza-600)', textAlign: 'center' as const }}>
            {ativ.etapa_atual}/{ativ.etapa_total}
          </span>
          <StatusPill status={ativ.status_ciclo} />
          <span style={{ fontSize: '12px', color: 'var(--cinza-600)' }}>—</span>
          <select
            value={ativ.status_atual}
            disabled={!podeAlterar}
            onChange={e => onUpdateStatus(ativ.id, e.target.value)}
            style={{ fontSize: '11px', padding: '2px 4px', borderRadius: '4px', border: '1px solid var(--cinza-300)' }}
          >
            {opcoesPermitidas.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      )
    }

    const nomeUsuario = ativ.usuario_responsavel?.nome
      ?? (ativ.usuario_responsavel_id ? `#${ativ.usuario_responsavel_id}` : null)

    return (
      <div
        key={ativ.id}
        style={{
          ...ROW_STYLE,
          paddingLeft: `${12 + indentLevel * 16}px`,
          background: carregando ? 'var(--cinza-50)' : undefined,
          opacity: carregando ? 0.7 : 1,
        }}
      >
        {/* Tarefa */}
        <span style={{ fontSize: '13px', fontWeight: 500 }}>
          {formatarTipoElemento(ativ.tipo_elemento, ativ.subtipo)}
          {ativ.etapa_total > 1 && (
            <span style={{ fontSize: '11px', color: 'var(--cinza-500)', marginLeft: '6px', fontStyle: 'italic' }}>
              ({nomeEtapa(ativ.tipo_elemento, ativ.etapa_atual, ativ.subtipo)})
            </span>
          )}
        </span>

        {/* Etapa */}
        <span style={{ fontSize: '12px', color: 'var(--cinza-600)', textAlign: 'center' as const, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600 }}>
          {ativ.etapa_total > 1 ? `${ativ.etapa_atual}/${ativ.etapa_total}` : '—'}
        </span>

        {/* Status */}
        <StatusPill status={ativ.status_ciclo} />

        {/* Vinculado */}
        <span style={{ fontSize: '12px', color: nomeUsuario ? 'var(--cinza-800)' : 'var(--cinza-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
          {nomeUsuario ?? '—'}
        </span>

        {/* Ações */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' as const, alignItems: 'center' }}>
          {modoAdmin && onDetalhe && (
            <button
              onClick={() => onDetalhe(ativ.id)}
              style={{
                padding: '3px 8px', borderRadius: '4px',
                border: '1px solid var(--cinza-400)', background: 'transparent',
                color: 'var(--cinza-600)', fontSize: '11px',
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                textTransform: 'uppercase' as const, letterSpacing: '0.04em',
                cursor: 'pointer', whiteSpace: 'nowrap' as const,
              }}
            >
              Detalhes
            </button>
          )}
          {ativ.status_ciclo === 'Finalizada' ? (
            <span style={{ fontSize: '12px', color: '#6366f1', fontWeight: 700 }}>✓</span>
          ) : acoes.length === 0 ? (
            <span style={{ fontSize: '11px', color: 'var(--cinza-400)' }}>—</span>
          ) : (
            acoes.map(acao => (
              <BotaoAcao
                key={acao}
                acao={acao}
                onClick={() => handleAcao(acao, ativ.id)}
                disabled={carregando}
              />
            ))
          )}
        </div>
      </div>
    )
  }

  // ── Atividades gerais do edifício ─────────────────────────────────────
  const atividadesGerais = TIPOS_GERAIS_ORDEM
    .map(tipo => {
      for (const laje of lajesOrdenadas) {
        const found = laje.atividades?.find(a => a.tipo_elemento === tipo)
        if (found) return found
      }
      return null
    })
    .filter((a): a is Atividade => !!a && combinaFiltro(a))

  const lajeDaAtividadeEmAndamentoId = useMemo(() => {
    if (atividadeEmAndamentoId === null) return null
    for (const laje of lajesOrdenadas) {
      if ((laje.atividades ?? []).some(a =>
        a.id === atividadeEmAndamentoId &&
        !TIPOS_GERAIS_ORDEM.includes(a.tipo_elemento as typeof TIPOS_GERAIS_ORDEM[number])
      )) {
        return laje.id
      }
    }
    return null
  }, [atividadeEmAndamentoId, lajesOrdenadas])

  const atividadeEmAndamentoEhGeral = useMemo(() => {
    if (atividadeEmAndamentoId === null) return false
    return atividadesGerais.some(a => a.id === atividadeEmAndamentoId)
  }, [atividadeEmAndamentoId, atividadesGerais])

  useEffect(() => {
    if (lajeDaAtividadeEmAndamentoId === null) return
    setLajsAbertas(prev => {
      if (prev.has(lajeDaAtividadeEmAndamentoId)) return prev
      const next = new Set(prev)
      next.add(lajeDaAtividadeEmAndamentoId)
      return next
    })
  }, [lajeDaAtividadeEmAndamentoId])

  useEffect(() => {
    if (atividadeEmAndamentoEhGeral) {
      setGeraisAbertas(true)
    }
  }, [atividadeEmAndamentoEhGeral])

  const recolherTodosComRegra = useCallback(() => {
    setLajsAbertas(() => {
      const next = new Set<number>()
      if (lajeDaAtividadeEmAndamentoId !== null) {
        next.add(lajeDaAtividadeEmAndamentoId)
      }
      return next
    })
    setGeraisAbertas(atividadeEmAndamentoEhGeral)
  }, [lajeDaAtividadeEmAndamentoId, atividadeEmAndamentoEhGeral])

  const toggleLajeComRegra = (id: number) => {
    if (lajeDaAtividadeEmAndamentoId === id) return
    toggleLaje(id)
  }

  // ── Lajes de pavimento (Vigas/Lajes) ──────────────────────────────────
  // Exclui a laje que contém apenas atividades gerais (Fundacao) se ela não tiver Vigas/Lajes
  const lajesFiltradas = lajesOrdenadas.filter(laje => {
    const ativs = (laje.atividades ?? []).filter(a =>
      TIPOS_COM_ETAPAS.includes(a.tipo_elemento as typeof TIPOS_COM_ETAPAS[number])
    )
    if (!ativs.length) return false
    if (termos.length === 0) return true
    const lajeNome = normalizar(`${laje.tipo} ${formatarLaje(laje.tipo)}`)
    if (termos.every(t => lajeNome.includes(t))) return true
    return ativs.some(a => combinaFiltro(a, laje.tipo))
  })

  // Nome composto: Construtora - Edificio
  const nomeCompleto = edificio.construtora
    ? `${edificio.construtora.nome} — ${edificio.nome}`
    : edificio.nome

  return (
    <div style={{ background: 'var(--superficie-1)', borderRadius: '8px', border: '1px solid var(--cinza-300)', overflow: 'hidden' }}>

      {/* Cabeçalho do edifício */}
      <div style={{
        padding: '12px 20px',
        background: 'var(--cinza-50)',
        borderBottom: '2px solid var(--cinza-300)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
      }}>
        <div>
          <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '18px', fontWeight: 700, margin: 0 }}>
            {nomeCompleto}
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--cinza-600)', margin: '2px 0 0' }}>
            {lajesFiltradas.length} pavimento{lajesFiltradas.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={expandirTodos}
            style={{ fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.04em', padding: '4px 10px', border: '1px solid var(--cinza-300)', borderRadius: '4px', background: 'var(--superficie-1)', color: 'var(--texto-principal)', cursor: 'pointer' }}
          >
            Expandir tudo
          </button>
          <button
            onClick={recolherTodosComRegra}
            style={{ fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.04em', padding: '4px 10px', border: '1px solid var(--cinza-300)', borderRadius: '4px', background: 'var(--superficie-1)', color: 'var(--texto-principal)', cursor: 'pointer' }}
          >
            Recolher tudo
          </button>
        </div>
      </div>

      {/* Cabeçalho das colunas */}
      <div style={{ ...ROW_STYLE, background: 'var(--cinza-50)', borderBottom: '2px solid var(--cinza-200)' }}>
        <span style={HEADER_COL}>Tarefa</span>
        <span style={{ ...HEADER_COL, textAlign: 'center' as const }}>Etapa</span>
        <span style={HEADER_COL}>Status</span>
        <span style={HEADER_COL}>Vinculado</span>
        <span style={HEADER_COL}>Ações</span>
      </div>

      {/* Atividades gerais do edifício */}
      {atividadesGerais.length > 0 && (
        <div style={{ borderBottom: '1px solid var(--cinza-200)' }}>
          <button
            onClick={() => {
              if (atividadeEmAndamentoEhGeral) return
              setGeraisAbertas(!geraisAbertas)
            }}
            style={{
              width: '100%',
              padding: '6px 12px',
              background: 'var(--cinza-50)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.06em',
              color: 'var(--cinza-600)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '10px' }}>{geraisAbertas ? '▼' : '▶'}</span>
              <span>Atividades do edifício</span>
            </div>
            <span style={{ fontSize: '10px', color: 'var(--cinza-400)' }}>
              {atividadesGerais.length} tarefa{atividadesGerais.length !== 1 ? 's' : ''}
            </span>
          </button>
          {geraisAbertas && atividadesGerais.map(ativ => renderLinhaAtividade(ativ))}
        </div>
      )}

      {/* Pavimentos */}
      {lajesFiltradas.map(laje => {
        const aberta = lajsAbertas.has(laje.id)
        const ativs = (laje.atividades ?? [])
          .filter(a => TIPOS_COM_ETAPAS.includes(a.tipo_elemento as typeof TIPOS_COM_ETAPAS[number]))
          .filter(a => !termos.length || combinaFiltro(a, laje.tipo))

        const contadores = {
          total: ativs.length,
          emAndamento: ativs.filter(a => a.status_ciclo === 'Em andamento').length,
          pausadas: ativs.filter(a => a.status_ciclo === 'Pausada').length,
          finalizadas: ativs.filter(a => a.status_ciclo === 'Finalizada').length,
        }

        return (
          <div key={laje.id} style={{ borderBottom: '1px solid var(--cinza-200)' }}>
            {/* Linha do pavimento (clickável) */}
            <button
              onClick={() => toggleLajeComRegra(laje.id)}
              style={{
                width: '100%',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: aberta ? 'var(--verde-claro)' : 'var(--cinza-50)',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left' as const,
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: aberta ? 'var(--verde-texto)' : 'var(--cinza-500)' }}>
                  {aberta ? '▼' : '▶'}
                </span>
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 700,
                  fontSize: '14px',
                  color: aberta ? 'var(--verde-texto)' : 'var(--cinza-800)',
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.04em',
                }}>
                  {formatarLaje(laje.tipo)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {contadores.emAndamento > 0 && (
                  <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '999px', background: 'var(--verde-claro)', color: 'var(--verde-principal)', fontWeight: 700, border: '1px solid var(--verde-principal)' }}>
                    {contadores.emAndamento} em andamento
                  </span>
                )}
                {contadores.pausadas > 0 && (
                  <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '999px', background: '#fef3c7', color: '#f59e0b', fontWeight: 700, border: '1px solid #f59e0b' }}>
                    {contadores.pausadas} pausada{contadores.pausadas > 1 ? 's' : ''}
                  </span>
                )}
                <span style={{ fontSize: '11px', color: 'var(--cinza-500)' }}>
                  {contadores.finalizadas}/{contadores.total}
                </span>
              </div>
            </button>

            {/* Atividades do pavimento */}
            {aberta && ativs.map(ativ => renderLinhaAtividade(ativ, 1))}
          </div>
        )
      })}

      {lajesFiltradas.length === 0 && atividadesGerais.length === 0 && (
        <div style={{ padding: '20px', color: 'var(--cinza-600)', fontSize: '14px' }}>
          Nenhum item encontrado para este filtro.
        </div>
      )}
    </div>
  )
}
