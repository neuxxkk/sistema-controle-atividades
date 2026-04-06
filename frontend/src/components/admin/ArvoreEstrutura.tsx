'use client'
import { useState } from 'react'
import { StatusBadge } from '@/components/ui/Badge'
import { formatarLaje, formatarTipoElemento } from '@/lib/constants'
import type { Edificio, Laje, Atividade, StatusAtividade } from '@/types'

interface Props {
  edificio: Edificio & { lajes: (Laje & { atividades: Atividade[] })[] }
  onUpdateStatus: (atividadeId: number, novoStatus: StatusAtividade) => void
  filtroTexto?: string
  statusOpcoesPorAtividade?: Record<number, StatusAtividade[]>
}

const TIPOS_COM_SUBTIPO = ['Vigas', 'Lajes'] as const
const SUBTIPOS = ['Rascunho', 'Formato'] as const
const TIPOS_GERAIS_ORDEM = ['GrelhaRefinada', 'Cortinas', 'Rampa', 'Escada', 'BlocosFundacao'] as const

type TipoComSubtipo = typeof TIPOS_COM_SUBTIPO[number]

export function ArvoreEstrutura({ edificio, onUpdateStatus, filtroTexto = '', statusOpcoesPorAtividade = {} }: Props) {
  const [lajeAberta, setLajeAberta] = useState<number | null>(null)
  const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>({})

  const normalizar = (texto: string) =>
    texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()

  const termosFiltro = normalizar(filtroTexto).split(/\s+/).filter(Boolean)

  const atividadeCombinaFiltro = (ativ: Atividade, lajeTipo?: string) => {
    if (termosFiltro.length === 0) return true
    const indexado = normalizar([
      ativ.tipo_elemento,
      ativ.subtipo || '',
      ativ.status_atual,
      formatarTipoElemento(ativ.tipo_elemento, ativ.subtipo),
      lajeTipo ? formatarLaje(lajeTipo) : '',
      lajeTipo || '',
    ].join(' '))
    return termosFiltro.every(termo => indexado.includes(termo))
  }

  const lajeCombinaFiltro = (laje: Laje & { atividades?: Atividade[] }) => {
    if (termosFiltro.length === 0) return true
    const lajeNome = normalizar(`${laje.tipo} ${formatarLaje(laje.tipo)}`)
    const lajeNomeCombina = termosFiltro.every(termo => lajeNome.includes(termo))
    if (lajeNomeCombina) return true
    return (laje.atividades || []).some(ativ => atividadeCombinaFiltro(ativ, laje.tipo))
  }

  const lajesOrdenadas = [...edificio.lajes].sort((a, b) => a.ordem - b.ordem)

  const toggleGrupo = (lajeId: number, tipo: TipoComSubtipo) => {
    const chave = `${lajeId}-${tipo}`
    setGruposAbertos(prev => ({ ...prev, [chave]: !(prev[chave] ?? false) }))
  }

  const grupoAberto = (lajeId: number, tipo: TipoComSubtipo) => gruposAbertos[`${lajeId}-${tipo}`] ?? false

  const atividadesGerais = TIPOS_GERAIS_ORDEM.map(tipo => {
    for (const laje of lajesOrdenadas) {
      const encontrada = laje.atividades?.find(ativ => ativ.tipo_elemento === tipo)
      if (encontrada) return encontrada
    }
    return null
  }).filter((ativ): ativ is Atividade => !!ativ)
    .filter((ativ) => atividadeCombinaFiltro(ativ))

  const lajesFiltradas = lajesOrdenadas.filter(laje => lajeCombinaFiltro(laje))

  const renderLinhaAtividade = (ativ: Atividade, key: string | number) => {
    const opcoesPermitidas = statusOpcoesPorAtividade[ativ.id] ?? [ativ.status_atual]
    const podeAlterar = opcoesPermitidas.some(status => status !== ativ.status_atual)

    return (
      <div key={key} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', background: 'var(--cinza-50)', borderRadius: '4px'
      }}>
        <span style={{ fontSize: '14px', fontWeight: 500 }}>
          {formatarTipoElemento(ativ.tipo_elemento, ativ.subtipo)}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <StatusBadge status={ativ.status_atual} />

          <select
            value={ativ.status_atual}
            disabled={!podeAlterar}
            onChange={(e) => onUpdateStatus(ativ.id, e.target.value as StatusAtividade)}
            style={{
              fontSize: '11px', padding: '2px 4px', borderRadius: '4px',
              border: '1px solid var(--cinza-300)', background: 'var(--superficie-1)',
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
              textTransform: 'uppercase', cursor: podeAlterar ? 'pointer' : 'not-allowed',
              opacity: podeAlterar ? 1 : 0.65
            }}
          >
            {opcoesPermitidas.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--superficie-1)', borderRadius: '8px', border: '1px solid var(--cinza-300)', overflow: 'hidden' }}>
      <div style={{ padding: '20px', background: 'var(--cinza-50)', borderBottom: '1px solid var(--cinza-300)' }}>
        <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '20px', fontWeight: 700, margin: 0 }}>
          {edificio.nome}
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--cinza-600)', marginTop: '4px' }}>
          {lajesFiltradas.length} lajes exibidas
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {atividadesGerais.length > 0 && (
          <div style={{ borderBottom: '1px solid var(--cinza-100)', padding: '12px 20px 16px 20px' }}>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700,
              fontSize: '14px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--cinza-600)',
              marginBottom: '10px'
            }}>
              Atividades gerais do edifício
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {atividadesGerais.map((ativ) => renderLinhaAtividade(ativ, `geral-${ativ.tipo_elemento}`))}
            </div>
          </div>
        )}

        {lajesFiltradas.map(laje => {
          const atividadesPorLaje = (laje.atividades ?? []).filter(
            ativ => TIPOS_COM_SUBTIPO.includes(ativ.tipo_elemento as TipoComSubtipo) && atividadeCombinaFiltro(ativ, laje.tipo)
          )

          return (
          <div key={laje.id} style={{ borderBottom: '1px solid var(--cinza-100)' }}>
            <button
              onClick={() => setLajeAberta(lajeAberta === laje.id ? null : laje.id)}
              style={{
                width: '100%', padding: '12px 20px', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', background: 'none', border: 'none',
                cursor: 'pointer', textAlign: 'left'
              }}
            >
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: '16px' }}>
                {lajeAberta === laje.id ? '▼' : '▶'} {formatarLaje(laje.tipo)}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--cinza-600)' }}>
                {atividadesPorLaje.length} atividades
              </span>
            </button>

            {lajeAberta === laje.id && (
              <div style={{ padding: '0 20px 16px 40px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {TIPOS_COM_SUBTIPO.map(tipo => {
                  const temAlgumaAtividadeDoTipo = SUBTIPOS.some(subtipo =>
                    atividadesPorLaje.some((ativ) => ativ.tipo_elemento === tipo && ativ.subtipo === subtipo)
                  )
                  if (termosFiltro.length > 0 && !temAlgumaAtividadeDoTipo) {
                    return null
                  }

                  const aberto = grupoAberto(laje.id, tipo)

                  return (
                    <div key={`${laje.id}-${tipo}`} style={{ border: '1px solid var(--cinza-100)', borderRadius: '6px', overflow: 'hidden' }}>
                      <button
                        onClick={() => toggleGrupo(laje.id, tipo)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'var(--cinza-50)',
                          border: 'none',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <span style={{ fontSize: '14px', fontWeight: 600, fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {aberto ? '▼' : '▶'} {tipo}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--cinza-600)' }}>
                          Rascunho + Formato
                        </span>
                      </button>

                      {aberto && (
                        <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {SUBTIPOS.map(subtipo => {
                            const atividade = atividadesPorLaje.find(
                              (ativ) => ativ.tipo_elemento === tipo && ativ.subtipo === subtipo
                            )

                            if (!atividade) {
                              if (termosFiltro.length > 0) return null
                              return (
                                <div key={`${laje.id}-${tipo}-${subtipo}`} style={{
                                  padding: '8px 12px',
                                  borderRadius: '4px',
                                  border: '1px dashed var(--cinza-300)',
                                  fontSize: '12px',
                                  color: 'var(--cinza-600)'
                                }}>
                                  {formatarTipoElemento(tipo, subtipo)} não cadastrado
                                </div>
                              )
                            }

                            return renderLinhaAtividade(atividade, atividade.id)
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          )
        })}

        {lajesFiltradas.length === 0 && atividadesGerais.length === 0 && (
          <div style={{ padding: '20px', color: 'var(--cinza-600)', fontSize: '14px' }}>
            Nenhum item encontrado para este filtro.
          </div>
        )}
      </div>
    </div>
  )
}
