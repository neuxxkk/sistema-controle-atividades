'use client'
import { useEffect, useState, useMemo } from 'react'
import { useSessao } from '@/context/SessaoContext'
import { useUsuario } from '@/context/UsuarioContext'
import { useToast } from '@/context/ToastContext'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { TimerBanner } from '@/components/layout/TimerBanner'
import { CardAtividade } from '@/components/atividades/CardAtividade'
import { ModalDetalheAtividade } from '@/components/atividades/ModalDetalheAtividade'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Search, Filter, X, ChevronDown } from 'lucide-react'
import type { Atividade, AtividadeDetalhe, Edificio, ProximosStatusAtividade, SessaoTrabalho, StatusAtividade } from '@/types'
import { formatarLaje } from '@/lib/constants'

const ORDEM_STATUS: StatusAtividade[] = [
  'Pendente',
  'Fazendo',
  'Gerado',
  'Impresso',
  'Montada',
  'Atendendo comentarios',
  'Ok'
]

const TITULO_STATUS: Record<StatusAtividade, string> = {
  Pendente: 'Pendente',
  Fazendo: 'Em andamento',
  Pausado: 'Pausado',
  Gerado: 'Gerado',
  Impresso: 'Impresso',
  Montada: 'Montada',
  'Atendendo comentarios': 'Atendendo comentários',
  Ok: 'Concluído'
}

export default function DashboardPage() {
  const { sessaoAtiva, atividadeAtiva, iniciarSessao, pausarSessao } = useSessao()
  const { usuario } = useUsuario()
  const { addToast } = useToast()
  const [atividades, setAtividades] = useState<Atividade[]>([])
  const [edificios, setEdificios] = useState<Edificio[]>([])
  const [sessoes, setSessoes] = useState<SessaoTrabalho[]>([])
  const [proximosStatusPorAtividade, setProximosStatusPorAtividade] = useState<Record<number, StatusAtividade[]>>({})
  const [carregando, setCarregando] = useState(true)

  // Estados de Filtro
  const [busca, setBusca] = useState('')
  const [edificioFiltro, setEdificioFiltro] = useState<number | 'todos'>('todos')
  const [statusFiltro, setStatusFiltro] = useState<string | 'todos'>('todos')
  const [atividadeParaAvanco, setAtividadeParaAvanco] = useState<Atividade | null>(null)
  const [opcoesAvanco, setOpcoesAvanco] = useState<StatusAtividade[]>([])
  const [statusSelecionado, setStatusSelecionado] = useState<StatusAtividade | ''>('')
  const [processandoAvanco, setProcessandoAvanco] = useState(false)
  const [detalheAtividade, setDetalheAtividade] = useState<AtividadeDetalhe | null>(null)
  const [detalheAberto, setDetalheAberto] = useState(false)

  const normalizarBusca = (valor: string) =>
    valor
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()

  const carregarProximosStatus = async (ativs: Atividade[]) => {
    const candidatas = ativs.filter(a => {
      const concluida = a.status_atual === 'Ok' || a.status_atual === 'Montada' || a.status_atual === 'Atendendo comentarios'
      return !concluida
    })

    const resultados = await Promise.allSettled(
      candidatas.map(async atividade => {
        const data = await api.get<ProximosStatusAtividade>(`/atividades/${atividade.id}/proximos-status`)
        return { id: atividade.id, opcoes: data.opcoes }
      })
    )

    const mapa: Record<number, StatusAtividade[]> = {}
    for (const resultado of resultados) {
      if (resultado.status === 'fulfilled') {
        mapa[resultado.value.id] = resultado.value.opcoes
      }
    }
    setProximosStatusPorAtividade(mapa)
  }

  const carregarDados = async () => {
    if (!usuario) {
      setCarregando(false)
      return
    }

    try {
      const [ativs, edifs, sessoesUsuario] = await Promise.all([
        api.get<Atividade[]>('/atividades/'),
        api.get<Edificio[]>('/edificios/'),
        api.get<SessaoTrabalho[]>(`/sessoes/?usuario_id=${usuario.usuario_id}`),
      ])
      setAtividades(ativs)
      setEdificios(edifs)
      setSessoes(sessoesUsuario)
      await carregarProximosStatus(ativs)
    } catch (e) {
      console.error('Erro ao carregar dashboard', e)
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [sessaoAtiva, usuario])

  const handleUpdateStatus = async (id: number, novoStatus: StatusAtividade) => {
    if (!usuario) return
    try {
      await api.put(`/atividades/${id}/status?status_novo=${novoStatus}&usuario_id=${usuario.usuario_id}`, {})
      addToast(`Status atualizado: ${novoStatus}`, 'sucesso')
      carregarDados()
    } catch (e) {
      addToast('Erro ao atualizar status', 'erro')
    }
  }

  const handleSolicitarAvanco = async (atividade: Atividade) => {
    try {
      const data = await api.get<ProximosStatusAtividade>(`/atividades/${atividade.id}/proximos-status`)

      if (!data.opcoes.length) {
        addToast('Esta atividade não possui próximo status disponível', 'aviso')
        return
      }

      if (data.opcoes.length === 1) {
        addToast(`Status será alterado para ${data.opcoes[0]}`, 'aviso')
        await handleUpdateStatus(atividade.id, data.opcoes[0])
        return
      }

      setAtividadeParaAvanco(atividade)
      setOpcoesAvanco(data.opcoes)
      setStatusSelecionado('')
    } catch (e: any) {
      addToast(e?.message || 'Erro ao carregar próximos status', 'erro')
    }
  }

  const confirmarAvanco = async () => {
    if (!atividadeParaAvanco || !statusSelecionado) return
    setProcessandoAvanco(true)
    try {
      await handleUpdateStatus(atividadeParaAvanco.id, statusSelecionado)
      setAtividadeParaAvanco(null)
      setOpcoesAvanco([])
      setStatusSelecionado('')
    } finally {
      setProcessandoAvanco(false)
    }
  }

  const abrirDetalheAtividade = async (atividadeId: number) => {
    try {
      const data = await api.get<AtividadeDetalhe>(`/atividades/${atividadeId}/detalhe`)
      setDetalheAtividade(data)
      setDetalheAberto(true)
    } catch (e: any) {
      addToast(e?.message || 'Erro ao carregar detalhes da atividade', 'erro')
    }
  }

  // Lógica de Filtragem (Memoizada para performance)
  const atividadesFiltradas = useMemo(() => {
    return atividades.filter(ativ => {
      // Filtro de Busca (múltiplas palavras): todos os termos devem aparecer no texto indexado.
      const termos = normalizarBusca(busca).split(/\s+/).filter(Boolean)
      const textoAtividade = normalizarBusca([
        ativ.tipo_elemento,
        ativ.subtipo || '',
        ativ.laje?.edificio?.nome || '',
        ativ.laje?.tipo || '',
      ].join(' '))
      const matchesBusca = termos.length === 0 || termos.every(termo => textoAtividade.includes(termo))

      // Filtro de Edifício
      const matchesEdificio = edificioFiltro === 'todos' || ativ.laje?.edificio_id === edificioFiltro

      // Filtro de Status
      const matchesStatus = statusFiltro === 'todos' || ativ.status_atual === statusFiltro

      return matchesBusca && matchesEdificio && matchesStatus
    })
  }, [atividades, busca, edificioFiltro, statusFiltro])

  const atividadesPorStatus = useMemo(() => {
    const base = ORDEM_STATUS.reduce((acc, status) => {
      acc[status] = []
      return acc
    }, {} as Record<StatusAtividade, Atividade[]>)

    for (const atividade of atividadesFiltradas) {
      base[atividade.status_atual].push(atividade)
    }

    for (const status of ORDEM_STATUS) {
      base[status].sort((a, b) => {
        const nomeA = a.laje?.edificio?.nome || ''
        const nomeB = b.laje?.edificio?.nome || ''
        if (nomeA !== nomeB) return nomeA.localeCompare(nomeB)

        const lajeA = a.laje?.tipo || ''
        const lajeB = b.laje?.tipo || ''
        if (lajeA !== lajeB) return lajeA.localeCompare(lajeB)

        return `${a.tipo_elemento} ${a.subtipo || ''}`.localeCompare(`${b.tipo_elemento} ${b.subtipo || ''}`)
      })
    }

    return base
  }, [atividadesFiltradas])

  const sessoesPorAtividade = useMemo(() => {
    const mapa = new Map<number, SessaoTrabalho[]>()
    for (const sessao of sessoes) {
      const lista = mapa.get(sessao.atividade_id)
      if (lista) {
        lista.push(sessao)
      } else {
        mapa.set(sessao.atividade_id, [sessao])
      }
    }
    return mapa
  }, [sessoes])

  const obterLabelInicio = (atividadeId: number, isAtiva: boolean) => {
    if (isAtiva) return 'Play'
    const atividade = atividades.find(a => a.id === atividadeId)
    if (atividade?.status_atual === 'Pendente') return 'Play'
    if (atividade?.status_atual === 'Fazendo') return 'Retomar'
    const historico = sessoesPorAtividade.get(atividadeId) || []
    if (historico.length === 0) return 'Play'
    return 'Retomar'
  }

  const obterLabelAvanco = (atividadeId: number) => {
    const atividade = atividades.find(a => a.id === atividadeId)
    if (!atividade) return 'Avançar'

    if (atividade.tipo_elemento === 'Vigas' && atividade.subtipo === 'Rascunho') {
      return atividade.status_atual === 'Impresso' ? 'Finalizar' : 'Avançar'
    }

    const opcoes = proximosStatusPorAtividade[atividadeId] || []
    if (atividade.status_atual === 'Fazendo') return 'Finalizar'
    if (opcoes.length === 1) return 'Avançar'
    if (opcoes.length > 1) return 'Avançar'
    return 'Avançar'
  }

  const podeMostrarAvanco = (atividadeId: number) => {
    const opcoes = proximosStatusPorAtividade[atividadeId] || []
    return opcoes.length > 0
  }

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid var(--cinza-300)',
    fontSize: '14px',
    outline: 'none',
    background: 'var(--superficie-1)',
    transition: 'border-color 200ms ease'
  }

  return (
    <>
      {sessaoAtiva && atividadeAtiva && (
        <TimerBanner
          sessao={sessaoAtiva}
          atividade={atividadeAtiva}
          lajeTipo={formatarLaje(atividadeAtiva.laje?.tipo || 'Laje')}
          edificioNome={atividadeAtiva.laje?.edificio?.nome || 'Edifício'}
          onPausar={pausarSessao}
          onAbrirDetalhe={abrirDetalheAtividade}
        />
      )}

      <PageHeader
        titulo="Minhas atividades"
        subtitulo="Gerencie e registre seu tempo de trabalho"
      />

      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* Barra de Ferramentas (Busca e Filtros) */}
        <section style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px',
          background: 'var(--superficie-1)', padding: '16px', borderRadius: '8px', border: '1px solid var(--cinza-300)'
        }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--cinza-600)' }} />
            <input 
              type="text"
              placeholder="Buscar por atividade ou edifício..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{ ...inputStyle, width: '100%', paddingLeft: '36px' }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--verde-principal)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--cinza-300)'}
            />
            {busca && (
              <X 
                size={14} 
                onClick={() => setBusca('')}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--cinza-600)', cursor: 'pointer' }} 
              />
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={14} color="var(--cinza-600)" />
            <select 
              value={edificioFiltro}
              onChange={e => setEdificioFiltro(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
              style={inputStyle}
            >
              <option value="todos">Todos os Edifícios</option>
              {edificios.map(ed => (
                <option key={ed.id} value={ed.id}>{ed.nome}</option>
              ))}
            </select>

            <select 
              value={statusFiltro}
              onChange={e => setStatusFiltro(e.target.value)}
              style={inputStyle}
            >
              <option value="todos">Todos os Status</option>
              <option value="Pendente">Pendente</option>
              <option value="Fazendo">Em andamento</option>
              <option value="Gerado">Gerado</option>
              <option value="Impresso">Impresso</option>
              <option value="Montada">Montada</option>
              <option value="Ok">Concluído (Ok)</option>
              <option value="Atendendo comentarios">Atendendo Comentários</option>
            </select>
          </div>

          {(busca || edificioFiltro !== 'todos' || statusFiltro !== 'todos') && (
            <button 
              onClick={() => { setBusca(''); setEdificioFiltro('todos'); setStatusFiltro('todos') }}
              style={{ 
                background: 'none', border: 'none', color: 'var(--erro)', 
                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase'
              }}
            >
              Limpar Filtros
            </button>
          )}
        </section>

        {/* Atividades */}
        <section>
          {atividadeAtiva && (
            <div style={{
              position: 'sticky',
              top: 8,
              zIndex: 7,
              marginBottom: '16px',
              background: 'var(--verde-claro)',
              border: '1px solid var(--verde-principal)',
              borderRadius: '8px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--verde-texto)',
                fontSize: '13px'
              }}>
                Em execução: {atividadeAtiva.tipo_elemento}{atividadeAtiva.subtipo ? ` — ${atividadeAtiva.subtipo}` : ''}
              </span>
              <Button variant="ghost" onClick={() => abrirDetalheAtividade(atividadeAtiva.id)}>
                Ver detalhes
              </Button>
            </div>
          )}

          {carregando ? (
            <div style={{ textAlign: 'center', padding: '64px', color: 'var(--cinza-600)' }}>
              <div style={{ width: '24px', height: '24px', border: '2px solid var(--cinza-300)', borderTopColor: 'var(--verde-principal)', borderRadius: '50%', animation: 'pulse 1s infinite', margin: '0 auto 16px' }} />
              Carregando suas atividades...
            </div>
          ) : (
            <>
              {atividadesFiltradas.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {ORDEM_STATUS.map(status => {
                    const lista = atividadesPorStatus[status]
                    if (!lista.length) return null

                    return (
                      <details
                        key={status}
                        open={status === 'Fazendo' || status === 'Pendente'}
                        style={{
                          background: 'var(--superficie-1)',
                          border: '1px solid var(--cinza-300)',
                          borderRadius: '10px',
                          overflow: 'hidden'
                        }}
                      >
                        <summary
                          style={{
                            listStyle: 'none',
                            cursor: 'pointer',
                            padding: '14px 18px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px',
                            borderBottom: '1px solid var(--cinza-100)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{
                              fontFamily: "'Barlow Condensed', sans-serif",
                              fontSize: '16px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.06em',
                              color: 'var(--cinza-800)'
                            }}>
                              {TITULO_STATUS[status]}
                            </span>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '999px',
                              background: 'var(--cinza-100)',
                              color: 'var(--cinza-600)',
                              fontSize: '11px',
                              fontWeight: 700,
                              fontFamily: "'Barlow Condensed', sans-serif",
                              letterSpacing: '0.04em',
                              textTransform: 'uppercase'
                            }}>
                              {lista.length} tarefa{lista.length > 1 ? 's' : ''}
                            </span>
                          </div>

                          <ChevronDown size={16} color="var(--cinza-600)" />
                        </summary>

                        <div style={{
                          padding: '16px',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                          gap: '14px'
                        }}>
                          {lista.map(ativ => (
                            
                            <CardAtividade
                              key={ativ.id}
                              atividade={ativ}
                              onIniciar={iniciarSessao}
                              onPausar={pausarSessao}
                              onSolicitarAvanco={handleSolicitarAvanco}
                              onAbrirDetalhe={abrirDetalheAtividade}
                              disabled={!!sessaoAtiva && sessaoAtiva.atividade_id !== ativ.id}
                              isAtiva={sessaoAtiva?.atividade_id === ativ.id}
                              iniciarLabel={obterLabelInicio(ativ.id, sessaoAtiva?.atividade_id === ativ.id)}
                              avancoLabel={obterLabelAvanco(ativ.id)}
                              mostrarAvanco={podeMostrarAvanco(ativ.id)}
                            />
                          ))}
                        </div>
                      </details>
                    )
                  })}
                </div>
              ) : (
                <div style={{
                  padding: '80px 32px', textAlign: 'center', background: 'var(--superficie-1)',
                  border: '1px dashed var(--cinza-300)', borderRadius: '8px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px'
                }}>
                  <div style={{ color: 'var(--cinza-300)' }}>
                    <Search size={48} />
                  </div>
                  <div>
                    <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '18px', fontWeight: 700, color: 'var(--cinza-800)', textTransform: 'uppercase' }}>
                      Nenhuma atividade encontrada
                    </h3>
                    <p style={{ color: 'var(--cinza-600)', marginTop: '4px' }}>
                      Tente ajustar os filtros ou a busca para encontrar o que precisa.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <Modal
        isOpen={!!atividadeParaAvanco}
        onClose={() => {
          setAtividadeParaAvanco(null)
          setOpcoesAvanco([])
          setStatusSelecionado('')
        }}
        title="Selecionar próximo status"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setAtividadeParaAvanco(null)
                setOpcoesAvanco([])
                setStatusSelecionado('')
              }}
              disabled={processandoAvanco}
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmarAvanco}
              disabled={!statusSelecionado}
              isLoading={processandoAvanco}
            >
              Confirmar avanço
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ margin: 0 }}>
            Escolha o próximo status permitido para esta atividade.
          </p>
          <select
            value={statusSelecionado}
            onChange={e => setStatusSelecionado(e.target.value as StatusAtividade)}
            style={{
              padding: '10px 12px',
              borderRadius: '6px',
              border: '1px solid var(--cinza-300)',
              fontSize: '14px',
              background: 'var(--superficie-1)'
            }}
          >
            <option value="">Selecione...</option>
            {opcoesAvanco.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </Modal>

      <ModalDetalheAtividade
        isOpen={detalheAberto}
        onClose={() => {
          setDetalheAberto(false)
          setDetalheAtividade(null)
        }}
        detalhe={detalheAtividade}
      />
    </>
  )
}
