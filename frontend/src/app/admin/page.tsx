'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { API_BASE, nomeEtapa, formatarTipoElemento, formatarLaje } from '@/lib/constants'
import { useToast } from '@/context/ToastContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { GraficoProgresso } from '@/components/admin/GraficoProgresso'
import { ModalDetalheEdificio } from '@/components/admin/ModalDetalheEdificio'
import { ModalDetalheAtividade } from '@/components/atividades/ModalDetalheAtividade'
import { useWebSocket } from '@/hooks/useWebSocket'
import { Building2, Users, Building, Clock3, Timer, FileSpreadsheet } from 'lucide-react'
import type { Usuario, EdificioDetalhe, AtividadeDetalhe } from '@/types'

interface SessaoAtivaWS {
  usuario_id: number
  usuario_nome: string
  atividade_descricao: string
  edificio_nome: string
  laje_tipo: string
  iniciado_em: string
}

interface PayloadWS {
  tipo: string
  dados: SessaoAtivaWS[]
}

interface HorasSerieItem {
  periodo: string
  horas: number
}

interface HorasUsuarioItem {
  usuario_id: number
  usuario_nome: string
  horas: number
}

interface HorasTrabalhadasResponse {
  filtros: {
    data_inicio: string
    data_fim: string
    usuario_id: number | null
  }
  resumo: {
    total_horas: number
    media_horas_dia: number
    total_sessoes: number
    dias_periodo: number
  }
  serie: HorasSerieItem[]
  por_usuario: HorasUsuarioItem[]
}

interface TempoMedioItemEdificio {
  edificio_id: number
  edificio_nome: string
  tempo_medio_horas: number
  total_horas: number
  total_sessoes: number
}

interface TempoMedioItemTipo {
  tipo_elemento: string
  etapa_atual: number
  tempo_medio_horas: number
  total_horas: number
  total_sessoes: number
}

interface TempoMedioResponse<T> {
  itens: T[]
  meta: {
    limit: number
    offset: number
    total_itens: number
    has_more: boolean
  }
}

interface KpisExecutivoResponse {
  kpis: {
    throughput_concluidas: number
    fazendo_com_sessao_ativa: number
    fazendo_sem_sessao_ativa: number
  }
}

interface HorasPorTarefaItem {
  usuario_id: number
  usuario_nome: string
  atividade_id: number
  tarefa: string
  laje: string
  edificio: string
  horas: number
  total_sessoes: number
}

interface HorasPorTarefaResponse {
  itens: HorasPorTarefaItem[]
  meta: {
    limit: number
    offset: number
    total_itens: number
    has_more: boolean
  }
}

function formatarDataInput(data: Date) {
  const ano = data.getFullYear()
  const mes = `${data.getMonth() + 1}`.padStart(2, '0')
  const dia = `${data.getDate()}`.padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function formatarMesInput(data: Date) {
  const ano = data.getFullYear()
  const mes = `${data.getMonth() + 1}`.padStart(2, '0')
  return `${ano}-${mes}`
}

function obterIntervaloDoMes(mesRef: string) {
  const [anoStr, mesStr] = mesRef.split('-')
  const ano = Number(anoStr)
  const mes = Number(mesStr)
  const inicio = new Date(ano, mes - 1, 1)
  const fim = new Date(ano, mes, 0)
  return {
    inicio: formatarDataInput(inicio),
    fim: formatarDataInput(fim),
  }
}

export default function AdminDashboard() {
  const { addToast } = useToast()
  const [progresso, setProgresso] = useState<any[]>([])
  const [produtividade, setProdutividade] = useState<any[]>([])
  const [usuariosFiltro, setUsuariosFiltro] = useState<Usuario[]>([])
  const [usuarioIdFiltro, setUsuarioIdFiltro] = useState<number | 'todos'>('todos')
  const mesAtual = formatarMesInput(new Date())
  const intervaloInicial = obterIntervaloDoMes(mesAtual)
  const [mesReferencia, setMesReferencia] = useState(mesAtual)
  const [dataFim, setDataFim] = useState(intervaloInicial.fim)
  const [dataInicio, setDataInicio] = useState(intervaloInicial.inicio)
  const [horasRelatorio, setHorasRelatorio] = useState<HorasTrabalhadasResponse | null>(null)
  const [kpisExecutivo, setKpisExecutivo] = useState<KpisExecutivoResponse | null>(null)
  const [carregandoRelatorio, setCarregandoRelatorio] = useState(false)
  const [tempoMedioEdificios, setTempoMedioEdificios] = useState<TempoMedioItemEdificio[]>([])
  const [tempoMedioTipos, setTempoMedioTipos] = useState<TempoMedioItemTipo[]>([])
  const [offsetEdificios, setOffsetEdificios] = useState(0)
  const [offsetTipos, setOffsetTipos] = useState(0)
  const [metaEdificios, setMetaEdificios] = useState({ limit: 5, offset: 0, total_itens: 0, has_more: false })
  const [metaTipos, setMetaTipos] = useState({ limit: 5, offset: 0, total_itens: 0, has_more: false })
  const [carregandoTemposMedios, setCarregandoTemposMedios] = useState(false)
  const [tarefasFuncionario, setTarefasFuncionario] = useState<HorasPorTarefaItem[]>([])
  const [offsetTarefasFuncionario, setOffsetTarefasFuncionario] = useState(0)
  const [metaTarefasFuncionario, setMetaTarefasFuncionario] = useState({ limit: 8, offset: 0, total_itens: 0, has_more: false })
  const [carregandoTarefasFuncionario, setCarregandoTarefasFuncionario] = useState(false)
  const { data: wsData } = useWebSocket<PayloadWS>(`${API_BASE}/dashboard/ws/tempo-real`)
  const LIMIT_TEMPOS_MEDIOS = 5
  const LIMIT_TAREFAS = 8
  const [detalheEdificio, setDetalheEdificio] = useState<EdificioDetalhe | null>(null)
  const [detalheEdificioAberto, setDetalheEdificioAberto] = useState(false)
  const [detalheAtividade, setDetalheAtividade] = useState<AtividadeDetalhe | null>(null)
  const [detalheAtividadeAberto, setDetalheAtividadeAberto] = useState(false)
  const [usuarioIdTemposMedios, setUsuarioIdTemposMedios] = useState<number | 'todos'>('todos')
  const [edificioIdTipos, setEdificioIdTipos] = useState<number | 'todos'>('todos')

  const abrirDetalheEdificio = async (edificioId: number) => {
    try {
      const data = await api.get<EdificioDetalhe>(`/edificios/${edificioId}/detalhe`)
      setDetalheEdificio(data)
      setDetalheEdificioAberto(true)
    } catch (e: any) {
      addToast(e?.message || 'Erro ao carregar detalhes do edifício', 'erro')
    }
  }

  const abrirDetalheAtividade = async (atividadeId: number) => {
    try {
      const data = await api.get<AtividadeDetalhe>(`/atividades/${atividadeId}/detalhe`)
      setDetalheAtividade(data)
      setDetalheAtividadeAberto(true)
    } catch (e: any) {
      addToast(e?.message || 'Erro ao carregar detalhes da tarefa', 'erro')
    }
  }

  const aplicarMesReferencia = (mes: string) => {
    const intervalo = obterIntervaloDoMes(mes)
    setMesReferencia(mes)
    setDataInicio(intervalo.inicio)
    setDataFim(intervalo.fim)
  }

  const carregarHorasTrabalhadas = async () => {
    setCarregandoRelatorio(true)
    try {
      const params = new URLSearchParams({
        data_inicio: dataInicio,
        data_fim: dataFim,
      })

      if (usuarioIdFiltro !== 'todos') {
        params.set('usuario_id', String(usuarioIdFiltro))
      }

      const dados = await api.get<HorasTrabalhadasResponse>(`/dashboard/horas-trabalhadas?${params.toString()}`)
      setHorasRelatorio(dados)
    } catch (e: any) {
      addToast(e?.message || 'Erro ao carregar relatório de horas', 'erro')
    } finally {
      setCarregandoRelatorio(false)
    }
  }

  const carregarKpisExecutivo = async () => {
    try {
      const kpis = await api.get<KpisExecutivoResponse>(`/dashboard/kpis-executivo?data_inicio=${dataInicio}&data_fim=${dataFim}${usuarioIdFiltro !== 'todos' ? `&usuario_id=${usuarioIdFiltro}` : ''}`)
      setKpisExecutivo(kpis)
    } catch (e: any) {
      addToast(e?.message || 'Erro ao carregar KPIs executivos', 'erro')
    }
  }

  const carregarTemposMedios = async () => {
    setCarregandoTemposMedios(true)
    try {
      const base = new URLSearchParams({
        data_inicio: dataInicio,
        data_fim: dataFim,
        limit: String(LIMIT_TEMPOS_MEDIOS),
      })
      if (usuarioIdTemposMedios !== 'todos') base.set('usuario_id', String(usuarioIdTemposMedios))

      const paramsEdificios = new URLSearchParams(base)
      paramsEdificios.set('offset', String(offsetEdificios))

      const paramsTipos = new URLSearchParams(base)
      paramsTipos.set('offset', String(offsetTipos))
      if (edificioIdTipos !== 'todos') paramsTipos.set('edificio_id', String(edificioIdTipos))

      const [edificios, tipos] = await Promise.all([
        api.get<TempoMedioResponse<TempoMedioItemEdificio>>(`/dashboard/tempo-medio/edificios?${paramsEdificios.toString()}`),
        api.get<TempoMedioResponse<TempoMedioItemTipo>>(`/dashboard/tempo-medio/tipos?${paramsTipos.toString()}`),
      ])

      setTempoMedioEdificios(edificios.itens)
      setTempoMedioTipos(tipos.itens)
      setMetaEdificios(edificios.meta)
      setMetaTipos(tipos.meta)
    } catch (e: any) {
      addToast(e?.message || 'Erro ao carregar tempos médios', 'erro')
    } finally {
      setCarregandoTemposMedios(false)
    }
  }

  const carregarHorasPorTarefa = async () => {
    setCarregandoTarefasFuncionario(true)
    try {
      const params = new URLSearchParams({
        data_inicio: dataInicio,
        data_fim: dataFim,
        limit: String(LIMIT_TAREFAS),
        offset: String(offsetTarefasFuncionario),
      })

      if (usuarioIdFiltro !== 'todos') {
        params.set('usuario_id', String(usuarioIdFiltro))
      }

      const response = await api.get<HorasPorTarefaResponse>(`/dashboard/horas-por-tarefa?${params.toString()}`)
      setTarefasFuncionario(response.itens)
      setMetaTarefasFuncionario(response.meta)
    } catch (e: any) {
      addToast(e?.message || 'Erro ao carregar tarefas por funcionário', 'erro')
    } finally {
      setCarregandoTarefasFuncionario(false)
    }
  }

  useEffect(() => {
    async function carregar() {
      try {
        const [prog, prod, usuarios] = await Promise.all([
          api.get<any>('/dashboard/progresso'),
          api.get<any>('/dashboard/produtividade'),
          api.get<Usuario[]>('/usuarios/'),
        ])
        setProgresso(prog)
        setProdutividade(prod)
        setUsuariosFiltro(usuarios.filter(u => u.role === 'funcionario' && u.ativo))
      } catch (e) {
        console.error('Erro ao carregar dashboard')
      }
    }
    carregar()
  }, [])

  useEffect(() => {
    carregarHorasTrabalhadas()
  }, [usuarioIdFiltro, dataInicio, dataFim])

  useEffect(() => {
    carregarKpisExecutivo()
  }, [usuarioIdFiltro, dataInicio, dataFim])

  useEffect(() => {
    carregarTemposMedios()
  }, [usuarioIdTemposMedios, edificioIdTipos, dataInicio, dataFim, offsetEdificios, offsetTipos])

  useEffect(() => {
    carregarHorasPorTarefa()
  }, [usuarioIdFiltro, dataInicio, dataFim, offsetTarefasFuncionario])

  useEffect(() => {
    setOffsetEdificios(0)
    setOffsetTipos(0)
    setOffsetTarefasFuncionario(0)
  }, [usuarioIdFiltro, dataInicio, dataFim])

  useEffect(() => {
    setOffsetEdificios(0)
    setOffsetTipos(0)
  }, [usuarioIdTemposMedios, edificioIdTipos])

  const sessoesAtivas = wsData?.dados || []

  return (
    <>
      <PageHeader 
        titulo="Dashboard" 
        subtitulo="Acompanhamento em tempo real e indicadores de produtividade" 
      />

      <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <section>
          <h2 style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px',
            fontWeight: 700, color: 'var(--cinza-600)', textTransform: 'uppercase',
            letterSpacing: '0.1em', marginBottom: '16px'
          }}>
            Gestão rápida
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
            <Link href="/admin/edificios" style={{
              background: 'var(--superficie-1)', border: '1px solid var(--cinza-300)', borderRadius: '8px',
              padding: '14px 16px', textDecoration: 'none', color: 'var(--cinza-800)',
              display: 'flex', alignItems: 'center', gap: '10px'
            }}>
              <Building2 size={18} color="var(--verde-principal)" />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                Edifícios
              </span>
            </Link>

            <Link href="/admin/relatorios/produtividade" style={{
              background: 'var(--superficie-1)', border: '1px solid var(--cinza-300)', borderRadius: '8px',
              padding: '14px 16px', textDecoration: 'none', color: 'var(--cinza-800)',
              display: 'flex', alignItems: 'center', gap: '10px'
            }}>
              <FileSpreadsheet size={18} color="var(--verde-principal)" />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                Relatórios Detalhados
              </span>
            </Link>

            <Link href="/admin/construtoras" style={{
              background: 'var(--superficie-1)', border: '1px solid var(--cinza-300)', borderRadius: '8px',
              padding: '14px 16px', textDecoration: 'none', color: 'var(--cinza-800)',
              display: 'flex', alignItems: 'center', gap: '10px'
            }}>
              <Building size={18} color="var(--verde-principal)" />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                Construtoras
              </span>
            </Link>

            <Link href="/admin/usuarios" style={{
              background: 'var(--superficie-1)', border: '1px solid var(--cinza-300)', borderRadius: '8px',
              padding: '14px 16px', textDecoration: 'none', color: 'var(--cinza-800)',
              display: 'flex', alignItems: 'center', gap: '10px'
            }}>
              <Users size={18} color="var(--verde-principal)" />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                Usuários
              </span>
            </Link>

          </div>
        </section>
        
        {/* Seção: Tempo Real */}
        <section>
          <h2 style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px',
            fontWeight: 700, color: 'var(--cinza-600)', textTransform: 'uppercase',
            letterSpacing: '0.1em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--erro)', animation: 'pulse 1.8s infinite' }} />
            Agora no Sistema
          </h2>
          
          <div style={{ 
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' 
          }}>
            {sessoesAtivas.map(s => (
              <div key={`${s.usuario_id}-${s.atividade_descricao}-${s.iniciado_em}`} style={{
                background: 'var(--superficie-1)', padding: '16px', borderRadius: '8px', border: '1px solid var(--cinza-300)',
                display: 'flex', flexDirection: 'column', gap: '8px'
              }}>
                <div style={{ fontWeight: 700, color: 'var(--cinza-800)', fontSize: '16px' }}>{s.usuario_nome}</div>
                <div style={{ fontSize: '13px', color: 'var(--cinza-600)' }}>
                  Trabalhando em: <strong style={{ color: 'var(--verde-principal)' }}>{s.atividade_descricao}</strong>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--texto-secundario)', textTransform: 'uppercase', fontWeight: 600 }}>
                  {formatarLaje(s.laje_tipo)} · {s.edificio_nome}
                </div>
              </div>
            ))}
            
            {sessoesAtivas.length === 0 && (
              <div style={{ 
                gridColumn: '1/-1', padding: '32px', textAlign: 'center', 
                background: 'var(--cinza-50)', border: '1px dashed var(--cinza-300)', borderRadius: '8px',
                color: 'var(--texto-secundario)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em'
              }}>
                Ninguém trabalhando no momento
              </div>
            )}
          </div>
        </section>

        <section style={{ background: 'var(--superficie-1)', border: '1px solid var(--cinza-300)', borderRadius: '10px', padding: '16px' }}>
          <h2 style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px',
            fontWeight: 700, color: 'var(--cinza-600)', textTransform: 'uppercase',
            letterSpacing: '0.1em', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <Clock3 size={16} color="var(--verde-principal)" />
            Relatório de horas trabalhadas
          </h2>

          <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'var(--cinza-600)' }}>
            Filtros globais abaixo afetam KPIs, tempos médios e tarefas por funcionário.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--cinza-600)', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em', fontWeight: 700 }}>
                Mês referência
              </label>
              <input
                type="month"
                value={mesReferencia}
                onChange={(e) => aplicarMesReferencia(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--cinza-300)', borderRadius: '6px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--cinza-600)', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em', fontWeight: 700 }}>
                Data início
              </label>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--cinza-300)', borderRadius: '6px' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--cinza-600)', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em', fontWeight: 700 }}>
                Data fim
              </label>
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--cinza-300)', borderRadius: '6px' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--cinza-600)', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em', fontWeight: 700 }}>
                Funcionário
              </label>
              <select value={usuarioIdFiltro} onChange={(e) => setUsuarioIdFiltro(e.target.value === 'todos' ? 'todos' : Number(e.target.value))} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--cinza-300)', borderRadius: '6px', background: 'var(--superficie-1)' }}>
                <option value="todos">Todos</option>
                {usuariosFiltro.map(u => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {carregandoRelatorio ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--cinza-600)' }}>Carregando relatório...</div>
          ) : horasRelatorio ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                <div style={{ border: '1px solid var(--cinza-100)', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--cinza-600)', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em', fontWeight: 700 }}>Total de horas</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--cinza-800)' }}>{horasRelatorio.resumo.total_horas.toFixed(1)}h</div>
                </div>
                <div style={{ border: '1px solid var(--cinza-100)', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--cinza-600)', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em', fontWeight: 700 }}>Média por dia</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--cinza-800)' }}>{horasRelatorio.resumo.media_horas_dia.toFixed(1)}h</div>
                </div>
                <div style={{ border: '1px solid var(--cinza-100)', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--cinza-600)', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em', fontWeight: 700 }}>Sessões fechadas</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--cinza-800)' }}>{horasRelatorio.resumo.total_sessoes}</div>
                </div>
                <div style={{ border: '1px solid var(--cinza-100)', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--cinza-600)', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em', fontWeight: 700 }}>Tarefas concluídas</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--cinza-800)' }}>{kpisExecutivo?.kpis.throughput_concluidas ?? 0}</div>
                </div>
                <div style={{ border: '1px solid var(--cinza-100)', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--cinza-600)', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em', fontWeight: 700 }}>Em fazendo com sessão ativa</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--cinza-800)' }}>{kpisExecutivo?.kpis.fazendo_com_sessao_ativa ?? 0}</div>
                </div>
              </div>

              <div style={{ border: '1px solid var(--cinza-100)', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ background: 'var(--cinza-50)', padding: '10px 12px', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, fontSize: '12px', color: 'var(--cinza-600)' }}>
                  Tarefas executadas por funcionário
                </div>
                {carregandoTarefasFuncionario ? (
                  <div style={{ padding: '14px', color: 'var(--cinza-600)' }}>Carregando tarefas...</div>
                ) : tarefasFuncionario.length === 0 ? (
                  <div style={{ padding: '14px', color: 'var(--cinza-600)' }}>Sem tarefas no período.</div>
                ) : (
                  <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
                    {tarefasFuncionario.map(item => (
                      <div
                        key={`${item.usuario_id}-${item.atividade_id}`}
                        onClick={() => abrirDetalheAtividade(item.atividade_id)}
                        style={{ padding: '10px 12px', borderTop: '1px solid var(--cinza-100)', display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', cursor: 'pointer', transition: 'background 150ms' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--cinza-50)')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--cinza-800)' }}>{item.usuario_nome}</div>
                          <div style={{ fontSize: '12px', color: 'var(--cinza-600)' }}>{item.tarefa} • {item.edificio} • {item.laje}</div>
                        </div>
                        <div style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: 'var(--verde-principal)', fontWeight: 700 }}>
                          {item.horas.toFixed(2)}h
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {(offsetTarefasFuncionario > 0 || metaTarefasFuncionario.has_more) && (
                  <div style={{ borderTop: '1px solid var(--cinza-100)', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <button
                      onClick={() => setOffsetTarefasFuncionario(Math.max(0, offsetTarefasFuncionario - LIMIT_TAREFAS))}
                      disabled={offsetTarefasFuncionario === 0}
                      style={{ 
                        border: '1px solid var(--cinza-300)', 
                        background: 'var(--superficie-1)', 
                        borderRadius: '6px', 
                        padding: '6px 10px', 
                        cursor: offsetTarefasFuncionario === 0 ? 'not-allowed' : 'pointer', 
                        opacity: offsetTarefasFuncionario === 0 ? 0.5 : 1,
                        fontSize: '12px',
                        color: 'var(--cinza-800)',
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontWeight: 600,
                        textTransform: 'uppercase'
                      }}
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setOffsetTarefasFuncionario(offsetTarefasFuncionario + LIMIT_TAREFAS)}
                      disabled={!metaTarefasFuncionario.has_more}
                      style={{ 
                        border: '1px solid var(--cinza-300)', 
                        background: 'var(--superficie-1)', 
                        borderRadius: '6px', 
                        padding: '6px 10px', 
                        cursor: !metaTarefasFuncionario.has_more ? 'not-allowed' : 'pointer', 
                        opacity: !metaTarefasFuncionario.has_more ? 0.5 : 1,
                        fontSize: '12px',
                        color: 'var(--cinza-800)',
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontWeight: 600,
                        textTransform: 'uppercase'
                      }}
                    >
                      Próxima
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </section>

        <section style={{ background: 'var(--superficie-1)', border: '1px solid var(--cinza-300)', borderRadius: '10px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
            <div>
              <h2 style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px',
                fontWeight: 700, color: 'var(--cinza-600)', textTransform: 'uppercase',
                letterSpacing: '0.1em', margin: 0, display: 'flex', alignItems: 'center', gap: '8px'
              }}>
                <Timer size={16} color="var(--verde-principal)" />
                Tempo médio gasto por sessão de trabalho
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--cinza-400)' }}>
                Média de duração por sessão fechada no período — agrupado por edifício e por tipo/etapa de tarefa.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', color: 'var(--cinza-500)', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em', fontWeight: 700, marginBottom: '2px' }}>
                  Funcionário
                </label>
                <select
                  value={usuarioIdTemposMedios}
                  onChange={e => setUsuarioIdTemposMedios(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
                  style={{ padding: '6px 8px', border: '1px solid var(--cinza-300)', borderRadius: '6px', fontSize: '12px', background: 'var(--superficie-1)' }}
                >
                  <option value="todos">Todos</option>
                  {usuariosFiltro.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', color: 'var(--cinza-500)', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em', fontWeight: 700, marginBottom: '2px' }}>
                  Edifício (tarefas)
                </label>
                <select
                  value={edificioIdTipos}
                  onChange={e => setEdificioIdTipos(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
                  style={{ padding: '6px 8px', border: '1px solid var(--cinza-300)', borderRadius: '6px', fontSize: '12px', background: 'var(--superficie-1)' }}
                >
                  <option value="todos">Todos</option>
                  {progresso.map((ed: any) => <option key={ed.id} value={ed.id}>{ed.nome}</option>)}
                </select>
              </div>
            </div>
          </div>

          {carregandoTemposMedios ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--cinza-600)' }}>Carregando tempos médios...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
              <div style={{ border: '1px solid var(--cinza-100)', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ background: 'var(--cinza-50)', padding: '10px 12px' }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, fontSize: '12px', color: 'var(--cinza-600)' }}>
                    Por edifício
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--cinza-400)', marginTop: '2px' }}>tempo médio/sessão por edifício</div>
                </div>
                {tempoMedioEdificios.length === 0 ? (
                  <div style={{ padding: '12px', color: 'var(--cinza-600)' }}>Sem dados para o período.</div>
                ) : tempoMedioEdificios.map(item => (
                  <div
                    key={item.edificio_id}
                    onClick={() => abrirDetalheEdificio(item.edificio_id)}
                    style={{ borderTop: '1px solid var(--cinza-100)', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', gap: '10px', cursor: 'pointer', transition: 'background 150ms' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--cinza-50)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <div style={{ color: 'var(--cinza-800)' }}>{item.edificio_nome}</div>
                    <div style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: 'var(--verde-principal)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {item.tempo_medio_horas.toFixed(2)}h
                      <div style={{ fontSize: '10px', color: 'var(--cinza-400)', fontFamily: 'inherit', fontWeight: 400 }}>média/sessão</div>
                    </div>
                  </div>
                ))}
                {(offsetEdificios > 0 || metaEdificios.has_more) && (
                  <div style={{ borderTop: '1px solid var(--cinza-100)', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <button
                      onClick={() => setOffsetEdificios(Math.max(0, offsetEdificios - LIMIT_TEMPOS_MEDIOS))}
                      disabled={offsetEdificios === 0}
                      style={{ 
                        border: '1px solid var(--cinza-300)', 
                        background: 'var(--superficie-1)', 
                        borderRadius: '6px', 
                        padding: '6px 10px', 
                        cursor: offsetEdificios === 0 ? 'not-allowed' : 'pointer', 
                        opacity: offsetEdificios === 0 ? 0.5 : 1,
                        fontSize: '12px',
                        color: 'var(--cinza-800)',
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontWeight: 600,
                        textTransform: 'uppercase'
                      }}
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setOffsetEdificios(offsetEdificios + LIMIT_TEMPOS_MEDIOS)}
                      disabled={!metaEdificios.has_more}
                      style={{ 
                        border: '1px solid var(--cinza-300)', 
                        background: 'var(--superficie-1)', 
                        borderRadius: '6px', 
                        padding: '6px 10px', 
                        cursor: !metaEdificios.has_more ? 'not-allowed' : 'pointer', 
                        opacity: !metaEdificios.has_more ? 0.5 : 1,
                        fontSize: '12px',
                        color: 'var(--cinza-800)',
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontWeight: 600,
                        textTransform: 'uppercase'
                      }}
                    >
                      Próxima
                    </button>
                  </div>
                )}
              </div>

              <div style={{ border: '1px solid var(--cinza-100)', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ background: 'var(--cinza-50)', padding: '10px 12px' }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, fontSize: '12px', color: 'var(--cinza-600)' }}>
                    Por tipo / etapa de tarefa
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--cinza-400)', marginTop: '2px' }}>tempo médio/sessão por tipo e etapa</div>
                </div>
                {tempoMedioTipos.length === 0 ? (
                  <div style={{ padding: '12px', color: 'var(--cinza-600)' }}>Sem dados para o período.</div>
                ) : tempoMedioTipos.map((item, idx) => (
                  <div key={`${item.tipo_elemento}-${item.etapa_atual}-${idx}`} style={{ borderTop: '1px solid var(--cinza-100)', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ color: 'var(--cinza-800)', fontWeight: 600, fontSize: '13px' }}>
                        {formatarTipoElemento(item.tipo_elemento, null)}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--cinza-500)', marginTop: '1px' }}>
                        Etapa {item.etapa_atual} — {nomeEtapa(item.tipo_elemento, item.etapa_atual)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: 'var(--verde-principal)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {item.tempo_medio_horas.toFixed(2)}h
                      <div style={{ fontSize: '10px', color: 'var(--cinza-400)', fontFamily: 'inherit', fontWeight: 400 }}>média/sessão</div>
                    </div>
                  </div>
                ))}
                {(offsetTipos > 0 || metaTipos.has_more) && (
                  <div style={{ borderTop: '1px solid var(--cinza-100)', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <button
                      onClick={() => setOffsetTipos(Math.max(0, offsetTipos - LIMIT_TEMPOS_MEDIOS))}
                      disabled={offsetTipos === 0}
                      style={{ 
                        border: '1px solid var(--cinza-300)', 
                        background: 'var(--superficie-1)', 
                        borderRadius: '6px', 
                        padding: '6px 10px', 
                        cursor: offsetTipos === 0 ? 'not-allowed' : 'pointer', 
                        opacity: offsetTipos === 0 ? 0.5 : 1,
                        fontSize: '12px',
                        color: 'var(--cinza-800)',
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontWeight: 600,
                        textTransform: 'uppercase'
                      }}
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setOffsetTipos(offsetTipos + LIMIT_TEMPOS_MEDIOS)}
                      disabled={!metaTipos.has_more}
                      style={{ 
                        border: '1px solid var(--cinza-300)', 
                        background: 'var(--superficie-1)', 
                        borderRadius: '6px', 
                        padding: '6px 10px', 
                        cursor: !metaTipos.has_more ? 'not-allowed' : 'pointer', 
                        opacity: !metaTipos.has_more ? 0.5 : 1,
                        fontSize: '12px',
                        color: 'var(--cinza-800)',
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontWeight: 600,
                        textTransform: 'uppercase'
                      }}
                    >
                      Próxima
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
          {/* Progresso dos Edifícios */}
          <GraficoProgresso dados={progresso} />

          {/* Produtividade */}
          <div style={{ background: 'var(--superficie-1)', padding: '20px', borderRadius: '8px', border: '1px solid var(--cinza-300)' }}>
            <h3 style={{ 
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: '18px', fontWeight: 700, 
              marginBottom: '20px', textTransform: 'uppercase', color: 'var(--cinza-600)' 
            }}>
              Produtividade (últimos 30 dias)
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {produtividade.map((p: any) => (
                <div key={p.usuario} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--cinza-100)' }}>
                  <span style={{ fontWeight: 500 }}>{p.usuario}</span>
                  <span style={{ 
                    fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, 
                    color: 'var(--verde-principal)', background: 'var(--verde-claro)', 
                    padding: '2px 8px', borderRadius: '4px' 
                  }}>
                    {p.horas}h
                  </span>
                </div>
              ))}
              {produtividade.length === 0 && <p style={{ color: 'var(--texto-secundario)', fontStyle: 'italic' }}>Nenhum registro encontrado</p>}
            </div>
          </div>
        </div>

      </div>

      <ModalDetalheEdificio
        isOpen={detalheEdificioAberto}
        onClose={() => { setDetalheEdificioAberto(false); setDetalheEdificio(null) }}
        detalhe={detalheEdificio}
      />

      <ModalDetalheAtividade
        isOpen={detalheAtividadeAberto}
        onClose={() => { setDetalheAtividadeAberto(false); setDetalheAtividade(null) }}
        detalhe={detalheAtividade}
      />
    </>
  )
}
