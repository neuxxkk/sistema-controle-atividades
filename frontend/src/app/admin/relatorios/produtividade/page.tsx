'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { RelatorioProdutividadeTabela } from '@/components/admin/RelatorioProdutividadeTabela'
import { useToast } from '@/context/ToastContext'
import { ChevronLeft, Filter, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import type { StatusCiclo, TipoElemento, Edificio, ItemRelatorio } from '@/types'

export default function RelatorioProdutividadePage() {
  const { addToast } = useToast()
  const [dados, setDados] = useState<ItemRelatorio[]>([])
  const [edificios, setEdificios] = useState<Edificio[]>([])
  const [pavimentos, setPavimentos] = useState<string[]>([])
  const [carregando, setCarregando] = useState(false)
  const [showPavimentos, setShowPavimentos] = useState(false)

  // Filtros
  const [edificioId, setEdificioId] = useState<number | null>(null)
  const [statusFiltro, setStatusFiltro] = useState<StatusCiclo | 'todos'>('todos')
  const [tipoFiltro, setTipoFiltro] = useState<TipoElemento | 'todos'>('todos')
  const [pavimentoFiltro, setPavimentoFiltro] = useState<string[]>([])

  const carregarRelatorio = useCallback(async () => {
    if (!edificioId) return
    setCarregando(true)
    try {
      const params = new URLSearchParams()
      params.set('edificio_id', String(edificioId))
      if (statusFiltro !== 'todos') params.set('status_ciclo', statusFiltro)
      if (tipoFiltro !== 'todos') params.set('tipo_elemento', tipoFiltro)
      
      // Se não selecionar todos e houver seleção parcial, envia múltiplos params
      if (pavimentoFiltro.length > 0 && pavimentoFiltro.length < pavimentos.length) {
        pavimentoFiltro.forEach(p => params.append('pavimento', p))
      }
      
      const res = await api.get<ItemRelatorio[]>(`/dashboard/relatorio-produtividade?${params.toString()}`)
      setDados(res)
    } catch (e: any) {
      addToast(e?.message || 'Erro ao carregar relatório', 'erro')
    } finally {
      setCarregando(false)
    }
  }, [edificioId, statusFiltro, tipoFiltro, pavimentoFiltro, pavimentos.length, addToast])

  useEffect(() => {
    async function carregarFiltros() {
      try {
        const eds = await api.get<Edificio[]>('/edificios/')
        setEdificios(eds)
        if (eds.length > 0) setEdificioId(eds[0].id)
      } catch (e) {}
    }
    carregarFiltros()
  }, [])

  useEffect(() => {
    if (edificioId) {
      const ed = edificios.find(e => e.id === edificioId)
      if (ed?.lajes) {
        const tipos = Array.from(new Set(ed.lajes.map(l => l.tipo))).sort()
        // Adiciona a opção de elementos gerais do edifício no topo
        const pavs = ['(Edifício)', ...tipos]
        setPavimentos(pavs)
        setPavimentoFiltro(pavs) // Inicia com todos selecionados
      }
    }
  }, [edificioId, edificios])

  const togglePavimento = (p: string) => {
    setPavimentoFiltro(prev => 
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
  }

  const toggleTodosPavimentos = () => {
    setPavimentoFiltro(pavimentoFiltro.length === pavimentos.length ? [] : pavimentos)
  }

  useEffect(() => {
    carregarRelatorio()
  }, [carregarRelatorio])

  const TIPOS: { label: string, value: TipoElemento }[] = [
    { label: 'Vigas', value: 'Vigas' },
    { label: 'Lajes', value: 'Lajes' },
    { label: 'Grelha Refinada', value: 'GrelhaRefinada' },
    { label: 'Cortinas', value: 'Cortinas' },
    { label: 'Escada', value: 'Escada' },
    { label: 'Rampa', value: 'Rampa' },
    { label: 'Blocos de Fundação', value: 'BlocosFundacao' },
  ]

  const STATUS: StatusCiclo[] = ['Pendente', 'Em andamento', 'Pausada', 'Finalizada']

  return (
    <div style={{ background: 'var(--cinza-100)', minHeight: '100vh' }}>
      <div className="no-print">
        <PageHeader 
          titulo="Relatórios" 
          subtitulo="Produtividade detalhada e consolidado de horas por tarefa" 
        />
      </div>

      <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Barra Superior com Filtros */}
        <div className="no-print" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '20px', 
          background: 'var(--superficie-1)', 
          padding: '24px', 
          borderRadius: 'var(--raio-card)', 
          border: '1px solid var(--cinza-300)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Link href="/admin" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              textDecoration: 'none',
              color: 'var(--cinza-600)',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontSize: '14px'
            }}>
              <ChevronLeft size={18} /> Voltar ao Dashboard
            </Link>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              color: 'var(--texto-secundario)',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontSize: '12px'
            }}>
              <Filter size={14} /> Filtros de Relatório
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cinza-600)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: "'Barlow Condensed', sans-serif" }}>
                Edifício
              </label>
              <select 
                value={edificioId || ''} 
                onChange={(e) => setEdificioId(Number(e.target.value))}
                style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--cinza-300)', background: 'var(--cinza-50)', fontSize: '14px', outline: 'none', fontWeight: 600 }}
              >
                {edificios.map(ed => (
                  <option key={ed.id} value={ed.id}>{ed.nome}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cinza-600)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: "'Barlow Condensed', sans-serif" }}>
                Status do Ciclo
              </label>
              <select 
                value={statusFiltro} 
                onChange={(e) => setStatusFiltro(e.target.value as any)}
                style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--cinza-300)', background: 'var(--cinza-50)', fontSize: '14px', outline: 'none' }}
              >
                <option value="todos">Todos os status</option>
                {STATUS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cinza-600)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: "'Barlow Condensed', sans-serif" }}>
                Tipo de Tarefa
              </label>
              <select 
                value={tipoFiltro} 
                onChange={(e) => setTipoFiltro(e.target.value as any)}
                style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--cinza-300)', background: 'var(--cinza-50)', fontSize: '14px', outline: 'none' }}
              >
                <option value="todos">Todos os tipos</option>
                {TIPOS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div 
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '6px', 
                position: 'relative',
                paddingBottom: '8px',
                marginBottom: '-8px'
              }} 
              onMouseLeave={() => setShowPavimentos(false)}
            >
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cinza-600)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: "'Barlow Condensed', sans-serif" }}>
                Pavimentos
              </label>
              
              <button 
                type="button"
                onClick={() => setShowPavimentos(!showPavimentos)}
                style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px', 
                  borderRadius: '8px', 
                  border: '1px solid var(--cinza-300)', 
                  background: 'var(--cinza-50)', 
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  outline: 'none',
                  color: 'var(--cinza-900)'
                }}
              >
                <span style={{ 
                  whiteSpace: 'nowrap', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis',
                  marginRight: '8px'
                }}>
                  {pavimentoFiltro.length === 0 ? 'Nenhum' : 
                   pavimentoFiltro.length === pavimentos.length ? 'Todos selecionados' :
                   pavimentoFiltro.length === 1 && pavimentoFiltro[0] === '(Edifício)' ? 'Geral (Edifício)' :
                   `${pavimentoFiltro.length} item(ns)`}
                </span>
                <ChevronDown size={16} style={{ 
                  transition: 'transform 0.2s', 
                  transform: showPavimentos ? 'rotate(180deg)' : 'none',
                  flexShrink: 0
                }} />
              </button>

              {showPavimentos && (
                <div style={{ 
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 50,
                  marginTop: '4px',
                  background: 'var(--superficie-1)',
                  color: 'var(--texto-principal)',
                  padding: '12px', 
                  borderRadius: '8px', 
                  border: '1px solid var(--borda-padrao)', 
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  maxHeight: '240px',
                  overflowY: 'auto'
                }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '13px', paddingBottom: '8px', borderBottom: '1px solid var(--cinza-100)' }}>
                    <input 
                      type="checkbox" 
                      checked={pavimentos.length > 0 && pavimentoFiltro.length === pavimentos.length} 
                      onChange={toggleTodosPavimentos} 
                    />
                    Selecionar Todos
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {pavimentos.map(p => (
                      <label key={p} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', padding: '2px 0' }}>
                        <input 
                          type="checkbox" 
                          checked={pavimentoFiltro.includes(p)} 
                          onChange={() => togglePavimento(p)} 
                        />
                        {p === '(Edifício)' ? 'Geral (Edifício)' : p}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {carregando ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 0', gap: '16px' }}>
            <div style={{ width: '40px', height: '40px', border: '4px solid var(--cinza-300)', borderTopColor: 'var(--verde-principal)', borderRadius: '50%', animation: 'pulse 1.5s infinite' }} />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', fontWeight: 700, color: 'var(--texto-secundario)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Carregando Dados...
            </span>
          </div>
        ) : (
          <RelatorioProdutividadeTabela 
            dados={dados} 
            nomeEdificio={edificios.find(ed => ed.id === edificioId)?.nome || ''} 
          />
        )}
      </div>
    </div>
  )
}
