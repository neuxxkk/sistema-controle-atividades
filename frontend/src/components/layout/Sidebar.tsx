'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useUsuario } from '@/context/UsuarioContext'
import { useSessao } from '@/context/SessaoContext'
import { useToast } from '@/context/ToastContext'
import { api } from '@/lib/api'
import { formatarTipoElemento, formatarLaje, formatarNomeEdificio } from '@/lib/constants'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ModalDetalheAtividade } from '@/components/atividades/ModalDetalheAtividade'
import {
  LayoutDashboard,
  Building2,
  Building,
  Users,
  History,
  SquareCheck,
  UserRound,
  Sun,
  Moon,
  Pause,
  Play,
  ArrowRight,
  CheckCheck,
  FileSpreadsheet,
  Layers,
  ClipboardList,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import type { Atividade, AtividadeDetalhe, ProximosStatusAtividade, SessaoTrabalho, StatusAtividade } from '@/types'

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { usuario, limparUsuario } = useUsuario()
  const { sessaoAtiva, pausarSessao, retomarSessao, avancarEtapa, finalizarAtividade, refreshSessao } = useSessao()
  const { addToast } = useToast()
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [atividades, setAtividades] = useState<Atividade[]>([])
  const [sessoes, setSessoes] = useState<SessaoTrabalho[]>([])
  const [carregandoSecao, setCarregandoSecao] = useState(false)
  const [proximosStatusPorAtividade, setProximosStatusPorAtividade] = useState<Record<number, StatusAtividade[]>>({})
  const [opcoesAvanco, setOpcoesAvanco] = useState<StatusAtividade[]>([])
  const [atividadeAvanco, setAtividadeAvanco] = useState<Atividade | null>(null)
  const [statusSelecionado, setStatusSelecionado] = useState<StatusAtividade | ''>('')
  const [detalhe, setDetalhe] = useState<AtividadeDetalhe | null>(null)
  const [detalheAberto, setDetalheAberto] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('formula_theme') as 'light' | 'dark'
    if (savedTheme) {
      setTheme(savedTheme)
      document.documentElement.setAttribute('data-theme', savedTheme)
    }
    const savedCollapsed = localStorage.getItem('formula_sidebar_collapsed')
    if (savedCollapsed === 'true') setCollapsed(true)
  }, [])

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('formula_sidebar_collapsed', String(next))
  }

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem('formula_theme', newTheme)
  }

  const isAdmin = usuario?.role === 'admin'

  const navItems = isAdmin 
    ? [
        { label: 'Dashboard', icon: LayoutDashboard, href: '/admin' },
        { label: 'Edifícios', icon: Building2, href: '/admin/edificios' },
        { label: 'Relatórios Detalhados', icon: FileSpreadsheet, href: '/admin/relatorios/produtividade' },
        { label: 'Construtoras', icon: Building, href: '/admin/construtoras' },
        { label: 'Usuários', icon: Users, href: '/admin/usuarios' },
      ]
    : [
        { label: 'Minhas Atividades', icon: SquareCheck, href: '/dashboard' },
        { label: 'Histórico', icon: History, href: '/historico' },
      ]

  const handleTrocarUsuario = () => {
    limparUsuario()
    router.push('/')
  }

  const carregarSecaoFuncionario = async () => {
    if (!usuario || usuario.role !== 'funcionario') return
    setCarregandoSecao(true)
    try {
      const [ativs, sess] = await Promise.all([
        api.get<Atividade[]>('/atividades/'),
        api.get<SessaoTrabalho[]>(`/sessoes/?usuario_id=${usuario.usuario_id}`),
      ])
      setAtividades(ativs)
      setSessoes(sess)

      const candidatas = ativs.filter(a => {
        return a.status_ciclo !== 'Finalizada'
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
    } catch {
      addToast('Erro ao carregar tarefas da barra lateral', 'erro')
    } finally {
      setCarregandoSecao(false)
    }
  }

  useEffect(() => {
    carregarSecaoFuncionario()
  }, [usuario, sessaoAtiva])

  if (!usuario) return null

  const obterLabelAvanco = (atividadeId: number) => {
    const atividade = atividades.find(a => a.id === atividadeId)
    if (!atividade) return 'Avançar'

    if ((atividade.status_ciclo === 'Em andamento' || atividade.status_ciclo === 'Pausada')
      && atividade.etapa_atual >= atividade.etapa_total) {
      return 'Finalizar'
    }

    const opcoes = proximosStatusPorAtividade[atividadeId] || []
    if (opcoes.length === 1) return 'Avançar'
    if (opcoes.length > 1) return 'Avançar'
    return 'Avançar'
  }

  const podeMostrarAvanco = (atividadeId: number) => {
    const opcoes = proximosStatusPorAtividade[atividadeId] || []
    return opcoes.length > 0
  }

  const idsAtividadesComSessaoPropria = new Set(sessoes.map(s => s.atividade_id))

  const tarefasRelevantes = atividades.filter(a => {
    const jaTocou = idsAtividadesComSessaoPropria.has(a.id)
    const emAndamentoOuPausada = a.status_ciclo === 'Em andamento' || a.status_ciclo === 'Pausada'
    return jaTocou && emAndamentoOuPausada
  })

  const tarefasPorStatus = [
    { 
      status: 'Em andamento', 
      lista: tarefasRelevantes.filter(t => t.status_ciclo === 'Em andamento') 
    },
    { 
      status: 'Pausadas', 
      lista: tarefasRelevantes.filter(t => t.status_ciclo === 'Pausada') 
    },
  ].filter(g => g.lista.length > 0)

  const abrirDetalhe = async (atividadeId: number) => {
    try {
      const data = await api.get<AtividadeDetalhe>(`/atividades/${atividadeId}/detalhe`)
      setDetalhe(data)
      setDetalheAberto(true)
    } catch {
      addToast('Erro ao carregar detalhes da atividade', 'erro')
    }
  }

  const solicitarAvanco = async (atividade: Atividade) => {
    try {
      if (atividade.status_ciclo === 'Em andamento' || atividade.status_ciclo === 'Pausada') {
        if (atividade.etapa_atual >= atividade.etapa_total) {
          await finalizarAtividade(atividade.id)
        } else {
          await avancarEtapa(atividade.id)
        }
        await carregarSecaoFuncionario()
        return
      }

      const data = await api.get<ProximosStatusAtividade>(`/atividades/${atividade.id}/proximos-status`)
      if (!data.opcoes.length) {
        addToast('Sem próximo status disponível', 'aviso')
        return
      }
      if (data.opcoes.length === 1) {
        addToast(`Status será alterado para ${data.opcoes[0]}`, 'aviso')
        await api.put(`/atividades/${atividade.id}/status?status_novo=${data.opcoes[0]}&usuario_id=${usuario?.usuario_id}`, {})
        await carregarSecaoFuncionario()
        return
      }

      setAtividadeAvanco(atividade)
      setOpcoesAvanco(data.opcoes)
      setStatusSelecionado('')
    } catch {
      addToast('Erro ao carregar próximos status', 'erro')
    }
  }

  const confirmarAvanco = async () => {
    if (!atividadeAvanco || !statusSelecionado || !usuario) return
    try {
      await api.put(`/atividades/${atividadeAvanco.id}/status?status_novo=${statusSelecionado}&usuario_id=${usuario.usuario_id}`, {})
      setAtividadeAvanco(null)
      setOpcoesAvanco([])
      setStatusSelecionado('')
      await carregarSecaoFuncionario()
      await refreshSessao()
      addToast('Status atualizado com sucesso', 'sucesso')
    } catch {
      addToast('Erro ao avançar atividade', 'erro')
    }
  }

  const W_EXPANDED = 320
  const W_COLLAPSED = 80

  return (
    <aside style={{
      width: collapsed ? `${W_COLLAPSED}px` : `${W_EXPANDED}px`,
      background: 'var(--sidebar-bg)',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      borderRight: '1px solid var(--sidebar-borda)',
      transition: 'width 250ms ease',
      overflow: 'hidden',
    }}>
      {/* ── Logo + toggle ── */}
      <div style={{
        padding: collapsed ? '20px 0' : '24px 20px',
        borderBottom: '1px solid var(--sidebar-borda)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        gap: '8px',
        minHeight: '72px',
        flexShrink: 0,
      }}>
        {collapsed ? (
          /* Marca compacta */
          <Link href={isAdmin ? '/admin' : '/dashboard'} title="Fórmula Engenharia" style={{ textDecoration: 'none' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '8px',
              background: 'var(--verde-principal)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '16px', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em',
            }}>
              FE
            </div>
          </Link>
        ) : (
          <Link href={isAdmin ? '/admin' : '/dashboard'} style={{ textDecoration: 'none', flex: 1, minWidth: 0 }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '180px' }}>
              <img
                src="/banner.png"
                alt="Fórmula Engenharia"
                style={{ width: '100%', height: 'auto', display: 'block' }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  const fallback = e.currentTarget.parentElement?.querySelector('.logo-fallback') as HTMLElement | null
                  if (fallback) fallback.style.display = 'block'
                }}
              />
              <div className="logo-fallback" style={{
                display: 'none',
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: '18px', fontWeight: 700,
                color: 'var(--sidebar-texto)', letterSpacing: '0.05em',
              }}>
                <span style={{ color: 'var(--verde-principal)' }}>FÓRMULA</span> ENGENHARIA
              </div>
            </div>
          </Link>
        )}

        {/* Botão collapse / expand */}
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          style={{
            flexShrink: 0,
            background: 'transparent',
            border: '1px solid var(--sidebar-borda)',
            color: 'var(--sidebar-texto-sec)',
            borderRadius: '6px',
            width: '28px', height: '28px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 150ms ease',
          }}
          onMouseOver={e => {
            e.currentTarget.style.background = 'var(--sidebar-hover)'
            e.currentTarget.style.color = 'var(--sidebar-texto)'
          }}
          onMouseOut={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--sidebar-texto-sec)'
          }}
        >
          {collapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
        </button>
      </div>

      {/* ── Navegação ── */}
      <nav style={{
        flexShrink: 0,
        padding: collapsed ? '16px 6px' : '24px 12px',
        display: 'flex', flexDirection: 'column', gap: '4px',
      }}>
        {navItems.map(item => {
          const ativo = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: '12px',
                padding: collapsed ? '12px 0' : '12px 16px',
                borderRadius: '4px',
                textDecoration: 'none',
                background: ativo ? 'rgba(90,138,74,0.15)' : 'transparent',
                color: ativo ? 'var(--sidebar-texto)' : 'var(--sidebar-texto-sec)',
                borderLeft: collapsed ? 'none' : (ativo ? '3px solid var(--verde-principal)' : '3px solid transparent'),
                outline: collapsed && ativo ? '2px solid var(--verde-principal)' : undefined,
                outlineOffset: '-2px',
                transition: 'all 200ms ease',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              <item.icon
                size={18}
                color={ativo ? 'var(--verde-principal)' : 'currentColor'}
                style={{ flexShrink: 0 }}
              />
              {!collapsed && (
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px',
                  fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {item.label}
                </span>
              )}
            </Link>
          )
        })}

        {/* Indicador colapsado de tarefas ativas (funcionário + collapsed) */}
        {!isAdmin && collapsed && tarefasRelevantes.length > 0 && (
          <div style={{
            marginTop: '8px', paddingTop: '8px',
            borderTop: '1px solid var(--sidebar-borda)',
            display: 'flex', justifyContent: 'center',
          }}>
            <div
              title={`${tarefasRelevantes.length} tarefa(s) ativa(s)`}
              style={{
                position: 'relative', display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center',
                width: '36px', height: '36px', borderRadius: '8px',
                background: 'rgba(90,138,74,0.12)',
                border: '1px solid rgba(90,138,74,0.3)',
                color: 'var(--verde-principal)',
              }}
            >
              <ClipboardList size={16} />
              <span style={{
                position: 'absolute', top: '-4px', right: '-4px',
                background: 'var(--verde-principal)', color: '#fff',
                fontSize: '9px', fontWeight: 800, borderRadius: '8px',
                padding: '0 4px', lineHeight: '14px', minWidth: '14px',
                textAlign: 'center', fontFamily: "'Barlow Condensed', sans-serif",
              }}>
                {tarefasRelevantes.length}
              </span>
            </div>
          </div>
        )}

      </nav>

      {/* ── Minhas Tarefas (funcionário expandido) — scroll independente ── */}
      {!isAdmin && !collapsed && (
        <div style={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden',
          padding: '0 12px 12px',
          borderTop: '1px solid var(--sidebar-borda)',
        }}>
          <section style={{ paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Cabeçalho da seção */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 8px',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                color: 'var(--sidebar-texto-sec)',
                fontFamily: "'Barlow Condensed', sans-serif",
                textTransform: 'uppercase', letterSpacing: '0.08em',
                fontWeight: 700, fontSize: '11px',
              }}>
                <ClipboardList size={13} />
                Minhas tarefas
              </div>
              {tarefasRelevantes.length > 0 && (
                <span style={{
                  background: 'var(--verde-principal)', color: '#fff',
                  fontSize: '10px', fontWeight: 700, borderRadius: '10px',
                  padding: '1px 6px', fontFamily: "'Barlow Condensed', sans-serif",
                  lineHeight: '16px',
                }}>
                  {tarefasRelevantes.length}
                </span>
              )}
            </div>

            {/* Estados: carregando / vazio / lista */}
            {carregandoSecao ? (
              /* Skeleton */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '0 4px' }}>
                {[1, 2].map(i => (
                  <div key={i} style={{
                    background: 'var(--sidebar-bg-elevada)', border: '1px solid var(--sidebar-borda)',
                    borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px',
                  }}>
                    <div style={{ height: '10px', width: '70%', background: 'var(--sidebar-hover)', borderRadius: '4px' }} />
                    <div style={{ height: '8px', width: '50%', background: 'var(--sidebar-hover)', borderRadius: '4px' }} />
                    <div style={{ height: '4px', width: '100%', background: 'var(--sidebar-hover)', borderRadius: '2px', marginTop: '4px' }} />
                  </div>
                ))}
              </div>
            ) : tarefasPorStatus.length === 0 ? (
              /* Estado vazio */
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                padding: '16px 8px', color: 'var(--sidebar-texto-muted)', textAlign: 'center',
              }}>
                <SquareCheck size={22} strokeWidth={1.5} style={{ opacity: 0.4 }} />
                <span style={{ fontSize: '11px', lineHeight: '1.4' }}>
                  Nenhuma tarefa ativa no momento
                </span>
              </div>
            ) : (
              /* Grupos por status */
              tarefasPorStatus.map(grupo => {
                const emAndamento = grupo.status === 'Em andamento'
                const corGrupo = emAndamento ? 'var(--verde-principal)' : '#f59e0b'
                return (
                  <div key={grupo.status} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {/* Header do grupo */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      padding: '0 8px',
                    }}>
                      <span style={{
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: corGrupo, flexShrink: 0,
                        boxShadow: emAndamento ? `0 0 0 2px rgba(90,138,74,0.25)` : undefined,
                        animation: emAndamento ? 'pulsar 2s infinite' : undefined,
                      }} />
                      <span style={{
                        color: corGrupo, fontSize: '10px', fontWeight: 700,
                        fontFamily: "'Barlow Condensed', sans-serif",
                        textTransform: 'uppercase', letterSpacing: '0.07em',
                        flex: 1,
                      }}>
                        {grupo.status}
                      </span>
                      <span style={{
                        color: 'var(--sidebar-texto-muted)', fontSize: '10px',
                        fontFamily: "'Barlow Condensed', sans-serif",
                      }}>
                        {grupo.lista.length}
                      </span>
                    </div>

                    {/* Cards */}
                    {grupo.lista.map(atividade => {
                      const ativa = sessaoAtiva?.atividade_id === atividade.id
                      const pct = Math.round((atividade.etapa_atual / atividade.etapa_total) * 100)
                      const podeRetomar = atividade.status_ciclo === 'Pausada' && (!sessaoAtiva || ativa)
                      const isFinalizar = atividade.etapa_atual >= atividade.etapa_total
                      const usuarioVinculado = atividade.usuario_responsavel?.nome
                        || (atividade.usuario_responsavel_id ? `#${atividade.usuario_responsavel_id}` : 'Sem vínculo')
                      const outraVinculada = atividade.status_ciclo === 'Pausada'
                        && atividade.usuario_responsavel_id !== usuario.usuario_id

                      return (
                        <div
                          key={atividade.id}
                          style={{
                            background: 'var(--superficie-1)',
                            borderTop: `1px solid ${ativa ? 'rgba(90,138,74,0.45)' : 'var(--cinza-300)'}`,
                            borderRight: `1px solid ${ativa ? 'rgba(90,138,74,0.45)' : 'var(--cinza-300)'}`,
                            borderBottom: `1px solid ${ativa ? 'rgba(90,138,74,0.45)' : 'var(--cinza-300)'}`,
                            borderLeft: `3px solid ${ativa ? 'var(--verde-principal)' : 'var(--cinza-300)'}`,
                            borderRadius: '8px',
                            padding: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            minHeight: '140px',
                          }}
                        >
                          {/* Linha 1: tipo + badge status */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '4px' }}>
                            <button
                              onClick={() => abrirDetalhe(atividade.id)}
                              title="Ver detalhes"
                              style={{
                                border: 'none', background: 'none',
                                color: 'var(--cinza-800)',
                                fontSize: '12px', fontWeight: 700,
                                textAlign: 'left', cursor: 'pointer',
                                padding: 0, lineHeight: '1.3',
                                fontFamily: "'DM Sans', sans-serif",
                              }}
                            >
                              {formatarTipoElemento(atividade.tipo_elemento, atividade.subtipo)}
                            </button>
                            {ativa && (
                              <span style={{
                                flexShrink: 0,
                                background: 'rgba(90,138,74,0.2)',
                                color: 'var(--verde-principal)',
                                fontSize: '10px', fontWeight: 700,
                                borderRadius: '4px', padding: '1px 5px',
                                fontFamily: "'Barlow Condensed', sans-serif",
                                textTransform: 'uppercase', letterSpacing: '0.05em',
                                lineHeight: '14px',
                              }}>
                                Ativo
                              </span>
                            )}
                          </div>

                          {/* Linha 2: edifício + laje */}
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            color: 'var(--cinza-600)',
                            fontSize: '11px',
                          }}>
                            <Layers size={9} style={{ flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {formatarNomeEdificio(atividade.laje?.edificio)}
                              {atividade.laje ? ` · ${formatarLaje(atividade.laje.tipo)}` : ''}
                            </span>
                          </div>

                          {/* Linha 3: progress bar de etapas */}
                          <div style={{ marginTop: '7px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <div style={{
                              display: 'flex', justifyContent: 'space-between',
                              color: 'var(--cinza-600)', fontSize: '10px',
                              fontFamily: "'Barlow Condensed', sans-serif",
                              textTransform: 'uppercase', letterSpacing: '0.05em',
                            }}>
                              <span>Etapa {atividade.etapa_atual} de {atividade.etapa_total}</span>
                              <span>{pct}%</span>
                            </div>
                            <div style={{
                              height: '4px', background: 'var(--cinza-100)',
                              borderRadius: '2px', overflow: 'hidden',
                            }}>
                              <div style={{
                                height: '100%', width: `${pct}%`,
                                background: ativa ? 'var(--verde-principal)' : corGrupo,
                                borderRadius: '2px',
                                transition: 'width 400ms ease',
                              }} />
                            </div>
                          </div>

                          {/* Aviso: outra pessoa vinculada */}
                          {outraVinculada && (
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: '4px',
                              marginTop: '6px',
                              color: '#f59e0b', fontSize: '9px', fontWeight: 600,
                              fontFamily: "'Barlow Condensed', sans-serif",
                              textTransform: 'uppercase', letterSpacing: '0.04em',
                            }}>
                              <span>↗</span>
                              <span>{usuarioVinculado}</span>
                            </div>
                          )}

                          {/* Ações */}
                          <div style={{
                            display: 'flex', gap: '6px', marginTop: 'auto',
                            flexWrap: 'wrap',
                            minHeight: '28px',
                          }}>
                            {atividade.status_ciclo === 'Pausada' && (
                              <button
                                onClick={() => {
                                  const fn = async () => {
                                    const edificioId = atividade.laje?.edificio?.id
                                    if (edificioId) {
                                      localStorage.setItem('dashboard_edificio_filtro', String(edificioId))
                                    }
                                    await retomarSessao(atividade.id)
                                    if (pathname !== '/dashboard') router.push('/dashboard')
                                  }
                                  fn().catch(() => {})
                                }}
                                disabled={!!sessaoAtiva && !ativa}
                                title={!!sessaoAtiva && !ativa ? 'Pause a tarefa ativa antes de retomar esta' : 'Retomar'}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                                  border: '1px solid rgba(90,138,74,0.4)',
                                  background: 'rgba(90,138,74,0.1)',
                                  color: !!sessaoAtiva && !ativa ? 'var(--sidebar-texto-muted)' : 'var(--verde-principal)',
                                  borderRadius: '6px', padding: '5px 9px',
                                  cursor: !!sessaoAtiva && !ativa ? 'not-allowed' : 'pointer',
                                  opacity: !!sessaoAtiva && !ativa ? 0.5 : 1,
                                  fontSize: '10px', fontWeight: 700,
                                  fontFamily: "'Barlow Condensed', sans-serif",
                                  textTransform: 'uppercase', letterSpacing: '0.05em',
                                  transition: 'all 150ms ease',
                                }}
                              >
                                <Play size={10} />
                                Retomar
                              </button>
                            )}

                            {ativa && atividade.status_ciclo === 'Em andamento' && (
                              <button
                                onClick={() => { pausarSessao().catch(() => {}) }}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                                  border: '1px solid rgba(245,158,11,0.4)',
                                  background: 'rgba(245,158,11,0.1)',
                                  color: '#f59e0b',
                                  borderRadius: '6px', padding: '5px 9px',
                                  cursor: 'pointer', fontSize: '10px', fontWeight: 700,
                                  fontFamily: "'Barlow Condensed', sans-serif",
                                  textTransform: 'uppercase', letterSpacing: '0.05em',
                                  transition: 'all 150ms ease',
                                }}
                              >
                                <Pause size={10} />
                                Pausar
                              </button>
                            )}

                            {podeMostrarAvanco(atividade.id) && (
                              <button
                                onClick={() => { solicitarAvanco(atividade).catch(() => {}) }}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                                  border: `1px solid ${isFinalizar ? 'rgba(99,102,241,0.4)' : 'var(--sidebar-borda)'}`,
                                  background: isFinalizar ? 'rgba(99,102,241,0.1)' : 'var(--cinza-50)',
                                  color: isFinalizar ? '#818cf8' : 'var(--cinza-700)',
                                  borderRadius: '6px', padding: '5px 9px',
                                  cursor: 'pointer', fontSize: '10px', fontWeight: 700,
                                  fontFamily: "'Barlow Condensed', sans-serif",
                                  textTransform: 'uppercase', letterSpacing: '0.05em',
                                  transition: 'all 150ms ease',
                                }}
                              >
                                {isFinalizar ? <CheckCheck size={10} /> : <ArrowRight size={10} />}
                                {obterLabelAvanco(atividade.id)}
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })
            )}
          </section>
        </div>
      )}

      {/* Spacer: empurra o rodapé para baixo quando não há Minhas Tarefas */}
      {(isAdmin || collapsed) && <div style={{ flex: 1 }} />}

      {/* ── Rodapé ── */}
      <div style={{
        padding: collapsed ? '12px 8px' : '14px 14px',
        borderTop: '1px solid var(--sidebar-borda)',
        background: 'rgba(0,0,0,0.18)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        flexShrink: 0,
      }}>
        {collapsed ? (
          /* Modo colapsado: avatar + ícones empilhados */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            {/* Avatar */}
            <div
              title={`${usuario.nome} · ${usuario.role}`}
              style={{
                width: '34px', height: '34px', borderRadius: '50%',
                background: 'var(--verde-principal)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 800, fontSize: '12px',
                fontFamily: "'Barlow Condensed', sans-serif",
                letterSpacing: '0.02em', cursor: 'default',
              }}
            >
              {usuario.nome.substring(0, 2).toUpperCase()}
            </div>

            {/* Tema */}
            <button
              onClick={toggleTheme}
              aria-label={`Modo ${theme === 'light' ? 'escuro' : 'claro'}`}
              title={`Modo ${theme === 'light' ? 'escuro' : 'claro'}`}
              style={{
                background: 'transparent', border: '1px solid var(--sidebar-borda)',
                color: 'var(--sidebar-texto-sec)',
                cursor: 'pointer', borderRadius: '6px',
                width: '34px', height: '34px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 150ms ease',
              }}
              onMouseOver={e => e.currentTarget.style.background = 'var(--sidebar-hover)'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >
              {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
            </button>

            {/* Trocar usuário */}
            <button
              onClick={handleTrocarUsuario}
              title="Trocar usuário"
              style={{
                background: 'transparent', border: '1px solid var(--sidebar-borda)',
                color: 'var(--sidebar-texto-sec)',
                cursor: 'pointer', borderRadius: '6px',
                width: '34px', height: '34px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 150ms ease',
              }}
              onMouseOver={e => e.currentTarget.style.background = 'var(--sidebar-hover)'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >
              <UserRound size={15} />
            </button>
          </div>
        ) : (
          /* Modo expandido */
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                  background: 'var(--verde-principal)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 800, fontSize: '12px',
                  fontFamily: "'Barlow Condensed', sans-serif",
                }}>
                  {usuario.nome.substring(0, 2).toUpperCase()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{
                    color: 'var(--sidebar-texto)', fontSize: '13px', fontWeight: 600,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {usuario.nome}
                  </span>
                  <span style={{
                    color: 'var(--sidebar-texto-muted)', fontSize: '10px',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    {usuario.role}
                  </span>
                </div>
              </div>

              <button
                onClick={toggleTheme}
                aria-label={`Modo ${theme === 'light' ? 'escuro' : 'claro'}`}
                style={{
                  background: 'transparent', border: 'none',
                  color: 'var(--sidebar-texto-sec)',
                  cursor: 'pointer', padding: '4px', borderRadius: '4px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 150ms',
                }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--sidebar-hover)'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
              </button>
            </div>

            <button
              onClick={handleTrocarUsuario}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                background: 'var(--sidebar-hover)', border: '1px solid var(--sidebar-borda)', borderRadius: '6px',
                padding: '7px 10px', color: 'var(--sidebar-texto-sec)', cursor: 'pointer',
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11px',
                fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
                transition: 'all 150ms ease',
              }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
              onMouseOut={e => e.currentTarget.style.background = 'var(--sidebar-hover)'}
            >
              <UserRound size={13} />
              Trocar Usuário
            </button>
          </>
        )}
      </div>

      <Modal
        isOpen={!!atividadeAvanco}
        onClose={() => {
          setAtividadeAvanco(null)
          setOpcoesAvanco([])
          setStatusSelecionado('')
        }}
        title="Selecionar próximo status"
        footer={
          <>
            <Button variant="secondary" onClick={() => {
              setAtividadeAvanco(null)
              setOpcoesAvanco([])
              setStatusSelecionado('')
            }}>
              Cancelar
            </Button>
            <Button onClick={confirmarAvanco} disabled={!statusSelecionado}>
              Confirmar
            </Button>
          </>
        }
      >
        <select
          value={statusSelecionado}
          onChange={e => setStatusSelecionado(e.target.value as StatusAtividade)}
          style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--borda-padrao)' }}
        >
          <option value="">Selecione...</option>
          {opcoesAvanco.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </Modal>

      <ModalDetalheAtividade
        isOpen={detalheAberto}
        onClose={() => {
          setDetalheAberto(false)
          setDetalhe(null)
        }}
        detalhe={detalhe}
      />
    </aside>
  )
}
