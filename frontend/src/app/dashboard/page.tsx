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
import { Search, X, Filter, ChevronDown, ChevronsDown, ChevronsRight } from 'lucide-react'
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
  const [comandoEdificios, setComandoEdificios] = useState<{ versao: number; recolher: boolean }>({ versao: 0, recolher: true })
  const [atividadeFocoId, setAtividadeFocoId] = useState<number | null>(null)
  const [detalheAtividade, setDetalheAtividade] = useState<AtividadeDetalhe | null>(null)
  const [detalheAberto, setDetalheAberto] = useState(false)
  const ultimoFiltroAutomaticoRef = useRef<number | null>(null)
  const ultimoFocoAutomaticoRef = useRef<number | null>(null)
  const filtroDropdownRef = useRef<HTMLDivElement | null>(null)
  const carregamentoEmAndamentoRef = useRef(false)

  const withTimeout = async <T,>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const timeoutPromise = new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms)
    })
    try {
      return await Promise.race([promise, timeoutPromise])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  const carregarEdificios = async () => {
    if (carregamentoEmAndamentoRef.current) return
    carregamentoEmAndamentoRef.current = true
    setCarregando(true)
    try {
      // Caminho otimizado: uma chamada para todas as estruturas.
      const estruturas = await withTimeout(
        api.get<EdificioCompleto[]>('/edificios/estruturas'),
        12000,
        'Tempo esgotado ao carregar estruturas dos edifícios',
      )
      setEdificios(estruturas)
    } catch (e: any) {
      try {
        // Fallback legado para manter robustez em ambientes sem endpoint agregado.
        const lista = await withTimeout(
          api.get<{ id: number; nome: string }[]>('/edificios/'),
          12000,
          'Tempo esgotado ao carregar edifícios',
        )
        const estruturas = await Promise.all(
          lista.map(ed => withTimeout(
            api.get<EdificioCompleto>(`/edificios/${ed.id}/estrutura`),
            12000,
            `Tempo esgotado ao carregar estrutura do edifício ${ed.id}`,
          ))
        )
        setEdificios(estruturas)
      } catch (fallbackErr: any) {
        console.error('Erro ao carregar edifícios', fallbackErr)
        addToast(fallbackErr?.message || e?.message || 'Erro ao carregar edifícios', 'erro')
      }
    } finally {
      setCarregando(false)
      carregamentoEmAndamentoRef.current = false
    }
  }

  useEffect(() => {
    if (usuario) carregarEdificios()
    else setCarregando(false)
  }, [usuario])

  useEffect(() => {
    // Estado inicial do dashboard de funcionario: todos os edificios recolhidos.
    setComandoEdificios({ versao: 1, recolher: true })
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const rawEdificio = params.get('edificio_id') ?? localStorage.getItem('dashboard_edificio_filtro')
    if (!rawEdificio) return
    const edificioId = Number(rawEdificio)
    localStorage.removeItem('dashboard_edificio_filtro')
    if (!Number.isFinite(edificioId) || edificioId <= 0) return
    setEdificioFiltro(edificioId)
    ultimoFiltroAutomaticoRef.current = edificioId
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const rawAtividade = params.get('atividade_id') ?? localStorage.getItem('dashboard_atividade_foco')
    if (!rawAtividade) return
    const atividadeId = Number(rawAtividade)
    localStorage.removeItem('dashboard_atividade_foco')
    if (!Number.isFinite(atividadeId) || atividadeId <= 0) return
    if (ultimoFocoAutomaticoRef.current === atividadeId) return
    ultimoFocoAutomaticoRef.current = atividadeId
    setAtividadeFocoId(atividadeId)
  }, [])

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!showEdificios) return
      const alvo = event.target as Node
      if (filtroDropdownRef.current?.contains(alvo)) return
      setShowEdificios(false)
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [showEdificios])

  useEffect(() => {
    const handleFocoSidebar = (event: Event) => {
      const custom = event as CustomEvent<{ atividadeId: number; edificioId?: number }>
      const atividadeId = custom.detail?.atividadeId
      const edificioId = custom.detail?.edificioId
      if (!atividadeId) return
      focarAtividade(atividadeId, edificioId)
    }

    window.addEventListener('dashboard:focar-atividade', handleFocoSidebar as EventListener)
    return () => {
      window.removeEventListener('dashboard:focar-atividade', handleFocoSidebar as EventListener)
    }
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
        case 'pausar':
          setAtividadeFocoId(atividadeId)
          await pausarSessao()
          break
        case 'retomar':
          setAtividadeFocoId(atividadeId)
          await retomarSessao(atividadeId)
          break
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

  const focarAtividade = (atividadeId: number, edificioId?: number) => {
    if (edificioId && Number.isFinite(edificioId) && edificioId > 0) {
      setEdificioFiltro(edificioId)
      ultimoFiltroAutomaticoRef.current = edificioId
    }
    setAtividadeFocoId(atividadeId)
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
          onIrParaAtividade={focarAtividade}
          onAbrirDetalhe={abrirDetalhe}
        />
      )}

      <PageHeader
        titulo={
          <button
            onClick={() => {
              setEdificioFiltro(null)
              setShowEdificios(false)
              setBuscaEdificio('')
              setComandoEdificios(prev => ({ versao: prev.versao + 1, recolher: true }))
            }}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--texto-principal)',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '26px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              margin: 0,
              padding: 0,
              cursor: 'pointer',
            }}
            title="Mostrar todos os edifícios"
          >
            Minhas atividades
          </button>
        }
        subtitulo="Árvore de tarefas por edifício e pavimento"
      />

      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch' }}>
          {/* Filtro por edifício (Searchable Dropdown) */}
          <div
            ref={filtroDropdownRef}
            style={{ 
              position: 'relative', 
              minWidth: '240px',
              marginBottom: 0,
            }}
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
                marginTop: '0', background: 'white', borderRadius: '8px',
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

          {edificioFiltro === null && (
            <button
              onClick={() => {
                setComandoEdificios(prev => ({ versao: prev.versao + 1, recolher: !prev.recolher }))
              }}
              style={{
                background: 'var(--superficie-1)',
                border: '1px solid var(--cinza-300)',
                borderRadius: '8px',
                padding: '12px 16px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                color: 'var(--cinza-800)',
                fontSize: '12px',
                fontWeight: 700,
                fontFamily: "'Barlow Condensed', sans-serif",
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
              title={comandoEdificios.recolher ? 'Expandir todos os edifícios' : 'Recolher todos os edifícios'}
            >
              {comandoEdificios.recolher ? <ChevronsDown size={14} /> : <ChevronsRight size={14} />}
              {comandoEdificios.recolher ? 'Expandir edifícios' : 'Recolher edifícios'}
            </button>
          )}

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
                onDetalhe={abrirDetalhe}
                atividadeFocoId={atividadeFocoId}
                iniciarRecolhido
                comandoEdificioGlobal={edificioFiltro === null ? comandoEdificios : null}
                ocultarSemPavimentosNoFiltro
              />
            ))}
          </div>
        )}
      </div>

      <ModalDetalheAtividade
        isOpen={detalheAberto}
        onClose={() => { setDetalheAberto(false); setDetalheAtividade(null) }}
        detalhe={detalheAtividade}
        onAtualizou={async () => {
          await refreshSessao()
          await carregarEdificios()
        }}
      />
    </>
  )
}
