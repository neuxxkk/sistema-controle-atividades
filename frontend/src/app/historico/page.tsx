'use client'
import { useEffect, useState, useMemo } from 'react'
import { api } from '@/lib/api'
import { useUsuarioLocal } from '@/hooks/useUsuarioLocal'
import { PageHeader } from '@/components/layout/PageHeader'
import { formatarDuracao, formatarData } from '@/lib/formatters'
import { formatarNomeEdificio, formatarTipoElemento, nomeEtapa } from '@/lib/constants'
import type { SessaoTrabalho } from '@/types'

export default function HistoricoPage() {
  const { usuario } = useUsuarioLocal()
  const [sessoes, setSessoes] = useState<SessaoTrabalho[]>([])
  const [carregando, setCarregando] = useState(true)
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [edificioFiltro, setEdificioFiltro] = useState('todos')

  useEffect(() => {
    if (usuario) {
      api.get<SessaoTrabalho[]>(`/sessoes/?usuario_id=${usuario.usuario_id}`)
        .then(setSessoes)
        .finally(() => setCarregando(false))
    }
  }, [usuario])

  const edificios = useMemo(() => {
    const map = new Map<string, string>()
    sessoes.forEach(s => {
      const ed = s.atividade?.laje?.edificio
      if (ed) map.set(String(ed.id), formatarNomeEdificio(ed))
    })
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome }))
  }, [sessoes])

  const sessoesFiltradas = useMemo(() => {
    return sessoes.filter(s => {
      if (dataInicio) {
        const inicio = new Date(dataInicio)
        if (new Date(s.iniciado_em) < inicio) return false
      }
      if (dataFim) {
        const fim = new Date(dataFim)
        fim.setHours(23, 59, 59, 999)
        if (new Date(s.iniciado_em) > fim) return false
      }
      if (edificioFiltro !== 'todos') {
        const edId = s.atividade?.laje?.edificio?.id
        if (String(edId) !== edificioFiltro) return false
      }
      return true
    })
  }, [sessoes, dataInicio, dataFim, edificioFiltro])

  const tempoTotal = sessoesFiltradas.reduce((acc, s) => acc + (s.duracao_segundos || 0), 0)

  const nomeEdificioSelecionado = edificioFiltro === 'todos'
    ? null
    : edificios.find(e => e.id === edificioFiltro)?.nome ?? null

  const inputStyle: React.CSSProperties = {
    padding: '6px 10px', borderRadius: '6px',
    border: '1px solid var(--borda-padrao)',
    background: 'var(--superficie-2)', color: 'var(--texto-principal)',
    fontSize: '13px', fontFamily: "'DM Sans', sans-serif",
  }

  return (
    <>
      <PageHeader
        titulo="Meu Histórico"
        subtitulo="Visualize suas sessões de trabalho e o tempo total dedicado"
      />

      <div style={{ padding: 'var(--espaco-pagina)', maxWidth: '1000px' }}>

        {/* Filtros */}
        <div style={{
          display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center',
          marginBottom: '16px',
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--texto-secundario)' }}>
            De:
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--texto-secundario)' }}>
            Até:
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--texto-secundario)' }}>
            Edifício:
            <select value={edificioFiltro} onChange={e => setEdificioFiltro(e.target.value)} style={inputStyle}>
              <option value="todos">Todos</option>
              {edificios.map(e => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
          </label>
          {(dataInicio || dataFim || edificioFiltro !== 'todos') && (
            <button
              onClick={() => { setDataInicio(''); setDataFim(''); setEdificioFiltro('todos') }}
              style={{
                ...inputStyle, cursor: 'pointer', color: 'var(--texto-secundario)',
                border: '1px solid var(--borda-padrao)',
              }}
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* Resumo */}
        <div style={{
          background: 'var(--verde-principal)', color: '#fff', padding: '24px',
          borderRadius: 'var(--raio-card)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '24px',
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: '12px', textTransform: 'uppercase', opacity: 0.8, fontWeight: 600, letterSpacing: '0.05em' }}>
              Tempo Total Registrado
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '32px', fontWeight: 600 }}>
              {formatarDuracao(tempoTotal)}
            </div>
          </div>
          <div style={{ height: '40px', width: '1px', background: 'rgba(255,255,255,0.2)' }} />
          <div>
            <div style={{ fontSize: '12px', textTransform: 'uppercase', opacity: 0.8, fontWeight: 600, letterSpacing: '0.05em' }}>
              Total de Sessões
            </div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '32px', fontWeight: 600 }}>
              {sessoesFiltradas.length}
            </div>
          </div>
          {nomeEdificioSelecionado && (
            <>
              <div style={{ height: '40px', width: '1px', background: 'rgba(255,255,255,0.2)' }} />
              <div>
                <div style={{ fontSize: '12px', textTransform: 'uppercase', opacity: 0.8, fontWeight: 600, letterSpacing: '0.05em' }}>
                  Edifício Referente
                </div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '24px', fontWeight: 600 }}>
                  {nomeEdificioSelecionado}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Tabela de Sessões */}
        <div style={{ background: 'var(--superficie-1)', borderRadius: 'var(--raio-card)', border: '1px solid var(--borda-padrao)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--superficie-2)', textAlign: 'left', borderBottom: '1px solid var(--borda-padrao)' }}>
                <th style={{ padding: 'var(--tabela-padding)', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', fontSize: '12px', color: 'var(--texto-secundario)' }}>Tarefa</th>
                <th style={{ padding: 'var(--tabela-padding)', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', fontSize: '12px', color: 'var(--texto-secundario)' }}>Etapa</th>
                <th style={{ padding: 'var(--tabela-padding)', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', fontSize: '12px', color: 'var(--texto-secundario)' }}>Início</th>
                <th style={{ padding: 'var(--tabela-padding)', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', fontSize: '12px', color: 'var(--texto-secundario)' }}>Fim</th>
                <th style={{ padding: 'var(--tabela-padding)', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', fontSize: '12px', color: 'var(--texto-secundario)' }}>Duração</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center' }}>Carregando histórico...</td></tr>
              ) : sessoesFiltradas.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--cinza-100)' }}>
                  <td style={{ padding: 'var(--tabela-padding)', color: 'var(--texto-secundario)' }}>
                    {s.atividade
                      ? formatarTipoElemento(s.atividade.tipo_elemento, s.atividade.subtipo ?? null)
                      : '—'}
                  </td>
                  <td style={{ padding: 'var(--tabela-padding)', color: 'var(--texto-secundario)' }}>
                    {s.atividade
                      ? nomeEtapa(s.atividade.tipo_elemento, s.atividade.etapa_atual, s.atividade.subtipo)
                      : '—'}
                  </td>
                  <td style={{ padding: 'var(--tabela-padding)' }}>{formatarData(s.iniciado_em)}</td>
                  <td style={{ padding: 'var(--tabela-padding)' }}>{s.finalizado_em ? formatarData(s.finalizado_em) : 'Em aberto'}</td>
                  <td style={{ padding: 'var(--tabela-padding)', fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>
                    {s.duracao_segundos ? formatarDuracao(s.duracao_segundos) : '--:--:--'}
                  </td>
                </tr>
              ))}
              {!carregando && sessoesFiltradas.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: 'var(--texto-secundario)' }}>
                  {sessoes.length === 0 ? 'Nenhuma sessão encontrada' : 'Nenhuma sessão para os filtros selecionados'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </>
  )
}
