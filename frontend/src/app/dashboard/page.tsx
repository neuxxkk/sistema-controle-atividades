'use client'
import { useEffect, useRef, useState } from 'react'
import { useSessao } from '@/context/SessaoContext'
import { useUsuario } from '@/context/UsuarioContext'
import { useToast } from '@/context/ToastContext'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { TimerBanner } from '@/components/layout/TimerBanner'
import { ModalDetalheAtividade } from '@/components/atividades/ModalDetalheAtividade'
import { ArvoreEstrutura, type EdificioCompleto } from '@/components/admin/ArvoreEstrutura'
import { Search, X, Filter, ChevronDown } from 'lucide-react'
import type { AcaoAtividade, AtividadeDetalhe } from '@/types'
import { formatarLaje, formatarNomeEdificio } from '@/lib/constants'

export default function DashboardPage() {
  const { sessaoAtiva, atividadeAtiva, iniciarSessao, pausarSessao, retomarSessao, avancarEtapa, finalizarAtividade, refreshSessao } = useSessao()
  const { usuario } = useUsuario()
  const { addToast } = useToast()

  const [edificios, setEdificios] = useState<EdificioCompleto[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [edificioFiltro, setEdificioFiltro] = useState<number | null>(null)
  const [buscaEdificio, setBuscaEdificio] = useState('')
  const [showEdificios, setShowEdificios] = useState(false)
  const [detalheAtividade, setDetalheAtividade] = useState<AtividadeDetalhe | null>(null)
  const [detalheAberto, setDetalheAberto] = useState(false)
  const ultimoFiltroAutomaticoRef = useRef<number | null>(null)

  const carregarEdificios = async () => {
    setCarregando(true)
    try {
      const lista = await api.get<{ id: number; nome: string }[]>('/edificios/')
      const estruturas = await Promise.all(
        lista.map(ed => api.get<EdificioCompleto>(`/edificios/${ed.id}/estrutura`))
      )
      setEdificios(estruturas)
    } catch (e) {
      console.error('Erro ao carregar edifícios', e)
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    if (usuario) carregarEdificios()
    else setCarregando(false)
  }, [usuario])

  useEffect(() => {
    const raw = localStorage.getItem('dashboard_edificio_filtro')
    if (!raw) return
    const edificioId = Number(raw)
    localStorage.removeItem('dashboard_edificio_filtro')
    if (!Number.isFinite(edificioId) || edificioId <= 0) return
    setEdificioFiltro(edificioId)
    ultimoFiltroAutomaticoRef.current = edificioId
  }, [])

  useEffect(() => {
    const edificioIdAtivo = atividadeAtiva?.laje?.edificio?.id
    if (!edificioIdAtivo) return
    if (ultimoFiltroAutomaticoRef.current === edificioIdAtivo) return
    setEdificioFiltro(edificioIdAtivo)
    ultimoFiltroAutomaticoRef.current = edificioIdAtivo
  }, [atividadeAtiva?.id, atividadeAtiva?.laje?.edificio?.id])

  // Recarrega após qualquer ação que mude sessão
  useEffect(() => {
    if (!carregando) carregarEdificios()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessaoAtiva?.id])

  const handleAcao = async (tipo: AcaoAtividade, atividadeId: number) => {
    try {
      switch (tipo) {
        case 'iniciar':       await iniciarSessao(atividadeId);   break
        case 'pausar':        await pausarSessao();               break
        case 'retomar':       await retomarSessao(atividadeId);   break
        case 'avancar_etapa': await avancarEtapa(atividadeId);    break
        case 'finalizar':     await finalizarAtividade(atividadeId); break
      }
      await carregarEdificios()
    } catch (e: any) {
      addToast(e?.message || `Erro ao executar ação: ${tipo}`, 'erro')
    }
  }

  const abrirDetalhe = async (atividadeId: number) => {
    try {
      const data = await api.get<AtividadeDetalhe>(`/atividades/${atividadeId}/detalhe`)
      setDetalheAtividade(data)
      setDetalheAberto(true)
    } catch (e: any) {
      addToast(e?.message || 'Erro ao carregar detalhes', 'erro')
    }
  }

  const atividadeEmAndamentoId = atividadeAtiva?.id ?? null
  const nomeExibicaoEdificio = (edificio: EdificioCompleto) => formatarNomeEdificio(edificio)
  const edificioSelecionado = edificios.find(e => e.id === edificioFiltro)

  return (
    <>
      {sessaoAtiva && atividadeAtiva && (
        <TimerBanner
          sessao={sessaoAtiva}
          atividade={atividadeAtiva}
          lajeTipo={formatarLaje(atividadeAtiva.laje?.tipo ?? 'Laje')}
          edificioNome={formatarNomeEdificio(atividadeAtiva.laje?.edificio)}
          onPausar={pausarSessao}
          onAbrirDetalhe={abrirDetalhe}
        />
      )}

      <PageHeader
        titulo="Minhas atividades"
        subtitulo="Árvore de tarefas por edifício e pavimento"
      />

      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch' }}>
          {/* Filtro por edifício (Searchable Dropdown) */}
          <div 
            style={{ 
              position: 'relative', 
              minWidth: '240px',
              paddingBottom: '8px',
              marginBottom: '-8px'
            }}
            onMouseLeave={() => setShowEdificios(false)}
          >
            <div style={{
              background: 'var(--superficie-1)', padding: '12px 16px', borderRadius: '8px',
              border: '1px solid var(--cinza-300)', display: 'flex', alignItems: 'center', gap: '8px',
              cursor: 'pointer', height: '100%',
            }} onClick={() => setShowEdificios(!showEdificios)}>
              <Filter size={15} color="var(--cinza-600)" style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: '14px', color: 'var(--cinza-800)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {edificioSelecionado ? nomeExibicaoEdificio(edificioSelecionado) : 'Todos os Edifícios'}
              </span>
              <ChevronDown size={14} color="var(--cinza-400)" style={{ 
                transition: 'transform 0.2s', 
                transform: showEdificios ? 'rotate(180deg)' : 'none' 
              }} />
            </div>

            {showEdificios && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                marginTop: '4px', background: 'white', borderRadius: '8px',
                border: '1px solid var(--cinza-300)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                display: 'flex', flexDirection: 'column',
              }}>
                <div style={{ padding: '8px', borderBottom: '1px solid var(--cinza-100)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Search size={14} color="var(--cinza-400)" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Buscar edifício..."
                    value={buscaEdificio}
                    onChange={e => setBuscaEdificio(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    style={{ border: 'none', outline: 'none', fontSize: '13px', width: '100%' }}
                  />
                  {buscaEdificio && (
                    <X size={12} color="var(--cinza-400)" cursor="pointer" onClick={(e) => { e.stopPropagation(); setBuscaEdificio('') }} />
                  )}
                </div>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  <div 
                    style={{ 
                      padding: '10px 16px', fontSize: '13px', cursor: 'pointer',
                      background: edificioFiltro === null ? 'var(--verde-principal-10)' : 'transparent',
                      color: edificioFiltro === null ? 'var(--verde-principal)' : 'var(--cinza-800)',
                      fontWeight: edificioFiltro === null ? 700 : 400,
                    }}
                    onClick={() => { setEdificioFiltro(null); setShowEdificios(false); setBuscaEdificio('') }}
                  >
                    Todos os Edifícios
                  </div>
                  {edificios
                    .filter(ed => nomeExibicaoEdificio(ed).toLowerCase().includes(buscaEdificio.toLowerCase()))
                    .map(ed => (
                      <div 
                        key={ed.id}
                        style={{ 
                          padding: '10px 16px', fontSize: '13px', cursor: 'pointer',
                          background: edificioFiltro === ed.id ? 'var(--verde-principal-10)' : 'transparent',
                          color: edificioFiltro === ed.id ? 'var(--verde-principal)' : 'var(--cinza-800)',
                          fontWeight: edificioFiltro === ed.id ? 700 : 400,
                          borderTop: '1px solid var(--cinza-50)'
                        }}
                        onClick={() => { setEdificioFiltro(ed.id); setShowEdificios(false); setBuscaEdificio('') }}
                      >
                        {nomeExibicaoEdificio(ed)}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Filtro por texto */}
          <div style={{
            flex: 1, background: 'var(--superficie-1)', padding: '12px 16px', borderRadius: '8px',
            border: '1px solid var(--cinza-300)', display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <Search size={16} color="var(--cinza-600)" />
            <input
              type="text"
              placeholder="Filtrar por tarefa, pavimento ou status..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{
                flex: 1, border: 'none', outline: 'none', fontSize: '14px',
                background: 'transparent', color: 'var(--cinza-800)',
              }}
            />
            {busca && (
              <button onClick={() => setBusca('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <X size={14} color="var(--cinza-600)" />
              </button>
            )}
          </div>
        </div>

        {/* Árvore de tarefas */}
        {carregando ? (
          <div style={{ textAlign: 'center', padding: '64px', color: 'var(--cinza-600)' }}>
            Carregando atividades...
          </div>
        ) : edificios.length === 0 ? (
          <div style={{
            padding: '64px', textAlign: 'center', border: '2px dashed var(--cinza-300)',
            borderRadius: '8px', color: 'var(--cinza-600)',
          }}>
            Nenhum edifício cadastrado.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {(edificioFiltro ? edificios.filter(e => e.id === edificioFiltro) : edificios).map(ed => (
              <ArvoreEstrutura
                key={ed.id}
                edificio={ed}
                usuarioId={usuario?.usuario_id ?? null}
                modoAdmin={usuario?.role === 'admin'}
                atividadeEmAndamentoId={atividadeEmAndamentoId}
                onAcao={handleAcao}
                filtroTexto={busca}
              />
            ))}
          </div>
        )}
      </div>

      <ModalDetalheAtividade
        isOpen={detalheAberto}
        onClose={() => { setDetalheAberto(false); setDetalheAtividade(null) }}
        detalhe={detalheAtividade}
      />
    </>
  )
}
