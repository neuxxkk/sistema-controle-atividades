'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useUsuario } from '@/context/UsuarioContext'
import { useSessao } from '@/context/SessaoContext'
import { useToast } from '@/context/ToastContext'
import { api } from '@/lib/api'
import { formatarTipoElemento, formatarLaje } from '@/lib/constants'
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
  Play,
  Pause,
  ArrowRight,
  FileSpreadsheet
} from 'lucide-react'
import type { Atividade, AtividadeDetalhe, ProximosStatusAtividade, SessaoTrabalho, StatusAtividade } from '@/types'

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { usuario, limparUsuario } = useUsuario()
  const { sessaoAtiva, iniciarSessao, pausarSessao, retomarSessao, avancarEtapa, finalizarAtividade, refreshSessao } = useSessao()
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

  useEffect(() => {
    const savedTheme = localStorage.getItem('formula_theme') as 'light' | 'dark'
    if (savedTheme) {
      setTheme(savedTheme)
      document.documentElement.setAttribute('data-theme', savedTheme)
    }
  }, [])

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

  const obterLabelInicio = (atividadeId: number, ativa: boolean) => {
    if (ativa) return 'Play'
    const atividade = atividades.find(a => a.id === atividadeId)
    if (!atividade) return 'Play'
    return atividade.status_ciclo === 'Pausada' ? 'Retomar' : 'Play'
  }

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

  const idsAtividadesComSessaoPropria = new Set(sessoes.map(s => s.activity_id ?? s.atividade_id))

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

  return (
    <aside style={{
      width: '240px', background: 'var(--sidebar-bg)', height: '100vh',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      borderRight: '1px solid var(--sidebar-borda)'
    }}>
      {/* Logo */}
      <div style={{
        padding: '32px 24px',
        borderBottom: '1px solid var(--sidebar-borda)',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <Link href={isAdmin ? '/admin' : '/dashboard'} style={{ textDecoration: 'none' }}>
          {/* Fallback caso a imagem não exista */}
          <div style={{ position: 'relative', width: '180px' }}>
            <img 
              src="/banner.png" 
              alt="Fórmula Engenharia"
              style={{ width: '100%', height: 'auto', display: 'block' }}
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                if (e.currentTarget.parentElement) {
                  const fallback = e.currentTarget.parentElement.querySelector('.logo-fallback') as HTMLElement
                  if (fallback) fallback.style.display = 'block'
                }
              }}
            />
            <div className="logo-fallback" style={{
              display: 'none',
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: '20px', fontWeight: 700,
              color: 'var(--sidebar-texto)', letterSpacing: '0.05em', textAlign: 'center'
            }}>
              <span style={{ color: 'var(--verde-principal)' }}>FÓRMULA</span> ENGENHARIA
            </div>
          </div>
        </Link>
      </div>

      {/* Navegação */}
      <nav style={{ flex: 1, padding: '24px 12px', display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
        {navItems.map(item => {
          const ativo = pathname === item.href
          return (
            <Link 
              key={item.href} 
              href={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 16px', borderRadius: '4px',
                textDecoration: 'none',
                background: ativo ? 'rgba(90, 138, 74, 0.15)' : 'transparent',
                color: ativo ? 'var(--sidebar-texto)' : 'var(--sidebar-texto-sec)',
                borderLeft: ativo ? '3px solid var(--verde-principal)' : '3px solid transparent',
                transition: 'all 200ms ease'
              }}
            >
              <item.icon size={18} color={ativo ? 'var(--verde-principal)' : 'currentColor'} />
              <span style={{ 
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', 
                fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' 
              }}>
                {item.label}
              </span>
            </Link>
          )
        })}

        {!isAdmin && (
          <section style={{ marginTop: '12px', borderTop: '1px solid var(--sidebar-borda)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ color: 'var(--sidebar-texto-sec)', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, fontSize: '12px', padding: '0 8px' }}>
              Minhas tarefas
            </div>

            {carregandoSecao ? (
              <div style={{ color: 'var(--sidebar-texto-muted)', fontSize: '12px', padding: '0 8px' }}>Carregando...</div>
            ) : tarefasPorStatus.length === 0 ? (
              <div style={{ color: 'var(--sidebar-texto-muted)', fontSize: '12px', padding: '0 8px' }}>Sem tarefas pausadas/em andamento.</div>
            ) : (
              tarefasPorStatus.map(grupo => (
                <div key={grupo.status} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ color: 'var(--sidebar-texto-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 8px', fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif" }}>
                    {grupo.status}
                  </div>

                  {grupo.lista.map(atividade => {
                    const ativa = sessaoAtiva?.atividade_id === atividade.id
                    const usuarioVinculado = atividade.usuario_responsavel?.nome
                      || (atividade.usuario_responsavel_id ? `#${atividade.usuario_responsavel_id}` : 'Sem vínculo')
                    return (
                      <div key={atividade.id} style={{ background: ativa ? 'rgba(90, 138, 74, 0.18)' : 'var(--sidebar-bg-elevada)', border: ativa ? '1px solid var(--verde-principal)' : '1px solid var(--sidebar-borda)', borderRadius: '6px', padding: '8px' }}>
                        <button onClick={() => abrirDetalhe(atividade.id)} style={{ border: 'none', background: 'none', color: 'var(--sidebar-texto)', fontSize: '12px', fontWeight: 600, textAlign: 'left', cursor: 'pointer', width: '100%' }}>
                          {formatarTipoElemento(atividade.tipo_elemento, atividade.subtipo)}
                        </button>
                        <div style={{ color: 'var(--sidebar-texto-muted)', fontSize: '10px', marginTop: '2px' }}>
                          {atividade.laje?.edificio?.nome || 'Edifício'} · {atividade.laje ? formatarLaje(atividade.laje.tipo) : '—'}
                        </div>
                        <div style={{ color: 'var(--sidebar-texto-muted)', fontSize: '10px', marginTop: '2px' }}>
                          Etapa {atividade.etapa_atual}/{atividade.etapa_total}
                        </div>
                        {atividade.status_ciclo === 'Pausada' && atividade.usuario_responsavel_id !== usuario.usuario_id && (
                          <div style={{ color: '#f59e0b', fontSize: '10px', marginTop: '4px', fontWeight: 600 }}>
                            Vinculada a: {usuarioVinculado}
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                          <button onClick={() => {
                            const acao = atividade.status_ciclo === 'Pausada'
                              ? retomarSessao(atividade.id)
                              : iniciarSessao(atividade.id)
                            acao.catch(() => {})
                          }} disabled={!!sessaoAtiva && !ativa} style={{ border: '1px solid var(--sidebar-borda)', background: 'var(--sidebar-hover)', color: 'var(--sidebar-texto)', borderRadius: '4px', padding: '4px 6px', cursor: !!sessaoAtiva && !ativa ? 'not-allowed' : 'pointer', opacity: !!sessaoAtiva && !ativa ? 0.5 : 1, fontSize: '10px', display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                            <Play size={12} />
                            {obterLabelInicio(atividade.id, ativa)}
                          </button>
                          {ativa && atividade.status_ciclo === 'Em andamento' && (
                            <button onClick={() => { pausarSessao().catch(() => {}) }} style={{ border: '1px solid var(--sidebar-borda)', background: 'var(--sidebar-hover)', color: 'var(--sidebar-texto)', borderRadius: '4px', padding: '4px 6px', cursor: 'pointer', fontSize: '10px', display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                              <Pause size={12} />
                              Pausar
                            </button>
                          )}
                          {podeMostrarAvanco(atividade.id) && (
                            <button onClick={() => { solicitarAvanco(atividade).catch(() => {}) }} style={{ border: '1px solid var(--sidebar-borda)', background: 'var(--sidebar-hover)', color: 'var(--sidebar-texto)', borderRadius: '4px', padding: '4px 6px', cursor: 'pointer', fontSize: '10px', display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                              <ArrowRight size={12} />
                              {obterLabelAvanco(atividade.id)}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))
            )}
          </section>
        )}
      </nav>

      {/* Rodapé - Info Usuário & Trocar */}
      <div style={{
        padding: '16px', borderTop: '1px solid var(--sidebar-borda)',
        background: 'rgba(0,0,0,0.18)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'var(--sidebar-bg-elevada)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: 'var(--sidebar-texto)', fontWeight: 700, fontSize: '12px',
              border: '1px solid var(--sidebar-borda)'
            }}>
              {usuario.nome.substring(0, 2).toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: 'var(--sidebar-texto)', fontSize: '13px', fontWeight: 600 }}>{usuario.nome}</span>
              <span style={{ color: 'var(--sidebar-texto-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {usuario.role}
              </span>
            </div>
          </div>
          
          <button
            onClick={toggleTheme}
            aria-label={`Mudar para modo ${theme === 'light' ? 'escuro' : 'claro'}`}
            style={{
              background: 'transparent', border: 'none', color: 'var(--sidebar-texto-sec)',
              cursor: 'pointer', padding: '4px', borderRadius: '4px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 200ms'
            }}
            onMouseOver={e => e.currentTarget.style.background = 'var(--sidebar-hover)'}
            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>
        
        <button
          onClick={handleTrocarUsuario}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
            background: 'var(--sidebar-hover)', border: '1px solid var(--sidebar-borda)', borderRadius: '4px',
            padding: '8px 12px', color: 'var(--sidebar-texto-sec)', cursor: 'pointer',
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: '12px',
            fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
            transition: 'all 200ms ease'
          }}
          onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
          onMouseOut={e => e.currentTarget.style.background = 'var(--sidebar-hover)'}
        >
          <UserRound size={14} />
          Trocar Usuário
        </button>
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
