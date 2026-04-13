'use client'
import React, { useMemo, useRef, useState } from 'react'
import { useReactToPrint } from 'react-to-print'
import { Download, Printer, Settings2 } from 'lucide-react'
import { formatarLaje, nomeEtapa } from '@/lib/constants'
import type { ItemRelatorio } from '@/types'

interface Props {
  dados: ItemRelatorio[]
  nomeEdificio: string
}

type ColunaID = 'pavimento' | 'tarefa' | 'etapa' | 'status' | 'total' | 'contribuicoes'
type LinhaRelatorio = ItemRelatorio & { _unificada?: boolean }

export function RelatorioProdutividadeTabela({ dados, nomeEdificio }: Props) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [colunasVisiveis, setColunasVisiveis] = useState<Record<ColunaID, boolean>>({
    pavimento: true,
    tarefa: true,
    etapa: true,
    status: true,
    total: true,
    contribuicoes: true
  })
  const [showConfig, setShowConfig] = useState(false)
  const [unificarRelatorio, setUnificarRelatorio] = useState(false)

  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle: `Relatório de Produtividade - ${nomeEdificio}`,
  })

  // Função para pegar a etapa em uma só palavra
  const getEtapaCurta = (item: ItemRelatorio) => {
    const nomeCompleto = nomeEtapa(item.tipo_original, item.etapa_atual)
    // Pega a primeira palavra (ex: "Elaboração Inicial" -> "Elaboração")
    return nomeCompleto.split(' ')[0]
  }

  const dadosTabela = useMemo<LinhaRelatorio[]>(() => {
    if (!unificarRelatorio) return dados

    const agrupado = new Map<string, ItemRelatorio[]>()
    for (const item of dados) {
      const atual = agrupado.get(item.laje) ?? []
      atual.push(item)
      agrupado.set(item.laje, atual)
    }

    const resultado: LinhaRelatorio[] = []
    for (const item of dados) {
      const grupo = agrupado.get(item.laje)
      if (!grupo) continue

      const statusUnicos = new Set(grupo.map(g => g.status))
      const statusDoGrupo = grupo[0]?.status ?? ''
      const podeUnificar = statusUnicos.size === 1 && (statusDoGrupo === 'Pendente' || statusDoGrupo === 'Finalizada')

      if (podeUnificar) {
        const horasTotais = grupo.reduce((acc, atual) => acc + atual.horas_totais, 0)
        const contribMap = new Map<string, number>()
        for (const g of grupo) {
          for (const c of g.contribuicoes) {
            contribMap.set(c.usuario, (contribMap.get(c.usuario) ?? 0) + c.horas)
          }
        }

        const contribuicoes = Array.from(contribMap.entries()).map(([usuario, horas]) => ({ usuario, horas }))
        const base = grupo[0]

        resultado.push({
          ...base,
          tarefa: 'Todas',
          horas_totais: horasTotais,
          contribuicoes,
          _unificada: true,
        })
      } else {
        resultado.push(...grupo)
      }

      agrupado.delete(item.laje)
    }

    return resultado
  }, [dados, unificarRelatorio])

  const exportToXLSX = async () => {
    try {
      const XLSX = (await import('xlsx-js-style')).default
      
      const headerStyle: any = {
        fill: { fgColor: { rgb: "166534" } },
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin" }, bottom: { style: "thin" },
          left: { style: "thin" }, right: { style: "thin" }
        }
      }

      const cellStyle: any = {
        font: { sz: 10 },
        border: {
          top: { style: "thin" }, bottom: { style: "thin" },
          left: { style: "thin" }, right: { style: "thin" }
        }
      }

      // Preparar os dados (matriz de objetos com estilo)
      const wsData: any[][] = [
        [{ v: "FÓRMULA ENGENHARIA", s: { font: { bold: true, sz: 14, color: { rgb: "166534" } }, alignment: { horizontal: "center" } } }],
        [{ v: `RELATÓRIO DE PRODUTIVIDADE - ${nomeEdificio}`, s: { font: { bold: true, sz: 12 }, alignment: { horizontal: "center" } } }],
        [{ v: `Gerado em: ${new Date().toLocaleString('pt-BR')}`, s: { font: { italic: true, sz: 9, color: { rgb: "9CA3AF" } }, alignment: { horizontal: "center" } } }],
        [], // Espaço
        [
          { v: "PAVIMENTO", s: headerStyle },
          { v: "TAREFA", s: headerStyle },
          { v: "ETAPA", s: headerStyle },
          { v: "STATUS", s: headerStyle },
          { v: "TOTAL (H)", s: headerStyle },
          { v: "CONTRIBUIÇÕES POR FUNCIONÁRIO", s: headerStyle }
        ]
      ]

      // Adicionar linhas de dados
      dadosTabela.forEach(item => {
        wsData.push([
          { v: formatarLaje(item.laje), s: cellStyle },
          { v: item.tarefa, s: { ...cellStyle, font: { ...cellStyle.font, bold: true } } },
          { v: item._unificada ? '—' : getEtapaCurta(item), s: cellStyle },
          { v: item.status, s: { ...cellStyle, alignment: { horizontal: "center" } } },
          { v: item.horas_totais, s: { ...cellStyle, alignment: { horizontal: "right" }, numFmt: "0.00" } },
          { v: item.contribuicoes.map(c => `${c.usuario}: ${c.horas.toFixed(2)}h`).join('; '), s: cellStyle }
        ])
      })

      const ws = XLSX.utils.aoa_to_sheet(wsData)

      // Configurar mesclagem (Título e Subtítulo)
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } }
      ]

      // Largura das colunas
      ws['!cols'] = [
        { wch: 18 }, { wch: 30 }, { wch: 15 },
        { wch: 15 }, { wch: 12 }, { wch: 60 }
      ]

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Produtividade")
      
      const fileName = `Relatorio_Produtividade_${nomeEdificio.replace(/\s+/g, '_')}.xlsx`
      XLSX.writeFile(wb, fileName)
    } catch (err) {
      console.error('Erro ao gerar Excel:', err)
      alert('Não foi possível gerar o arquivo Excel. Tente usar a opção de Imprimir.')
    }
  }

  const toggleColuna = (id: ColunaID) => {
    if (id === 'tarefa' || id === 'status') return
    setColunasVisiveis(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const getStatusStyle = (status: string): React.CSSProperties => {
    const base: React.CSSProperties = {
      padding: '1px 6px',
      borderRadius: '3px',
      fontSize: '9px',
      fontWeight: 700,
      fontFamily: "'Barlow Condensed', sans-serif",
      textTransform: 'uppercase',
      border: '1px solid'
    }
    if (status === 'Finalizada') return { ...base, background: 'var(--verde-claro)', color: 'var(--verde-texto)', borderColor: 'var(--verde-principal)' }
    if (status === 'Em andamento') return { ...base, background: '#e6f1fb', color: '#185fa5', borderColor: '#185fa5' }
    if (status === 'Pausada') return { ...base, background: '#fef3c7', color: '#f59e0b', borderColor: '#f59e0b' }
    if (status === 'Etapa concluida') return { ...base, background: '#dbeafe', color: '#2563eb', borderColor: '#2563eb' }
    return { ...base, background: 'var(--status-pendente-bg)', color: 'var(--status-pendente-text)', borderColor: 'var(--cinza-300)' }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Barra de Ações */}
      <div className="no-print" style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        background: 'var(--superficie-1)', padding: '12px 16px', borderRadius: 'var(--raio-card)', 
        border: '1px solid var(--cinza-300)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
      }}>
        <button onClick={() => setShowConfig(!showConfig)} style={ACTION_BTN_STYLE}>
          <Settings2 size={14} /> Colunas
        </button>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={exportToXLSX} style={{ ...ACTION_BTN_STYLE, background: '#2563eb', color: 'white', border: 'none' }}>
            <Download size={14} /> XLSX
          </button>
          <button onClick={() => handlePrint()} style={{ ...ACTION_BTN_STYLE, background: 'var(--verde-principal)', color: 'white', border: 'none' }}>
            <Printer size={14} /> Imprimir / PDF
          </button>
        </div>
      </div>

      {showConfig && (
        <div className="no-print" style={CONFIG_PANEL_STYLE}>
          <span style={CONFIG_TITLE_STYLE}>Visibilidade</span>
          {(['pavimento', 'etapa', 'total', 'contribuicoes'] as ColunaID[]).map(id => (
            <label key={id} style={CONFIG_LABEL_STYLE}>
              <input type="checkbox" checked={colunasVisiveis[id]} onChange={() => toggleColuna(id)} />
              <span style={{ textTransform: 'capitalize' }}>{id}</span>
            </label>
          ))}
          <label style={CONFIG_LABEL_STYLE}>
            <input type="checkbox" checked={unificarRelatorio} onChange={(e) => setUnificarRelatorio(e.target.checked)} />
            <span>Unificar por pavimento (pendente/finalizada)</span>
          </label>
        </div>
      )}

      {/* Área de Impressão Compacta */}
      <div ref={contentRef} style={REPORT_CONTAINER_STYLE}>
        {/* Cabeçalho Minimalista */}
        <div style={HEADER_STYLE}>
          <div>
            <h1 style={TITLE_STYLE}>Relatório de Produtividade - {nomeEdificio}</h1>
            <p style={SUBTITLE_STYLE}>Fórmula Engenharia — Gestão de Atividades</p>
            <p style={DATE_STYLE}>Gerado em {new Date().toLocaleString('pt-BR')}</p>
          </div>
          <img src="/banner.png" alt="Logo" style={{ height: '40px', objectFit: 'contain' }} />
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
          <thead>
            <tr style={{ background: 'var(--cinza-50)', borderTop: '1px solid var(--cinza-300)', borderBottom: '1px solid var(--cinza-300)' }}>
              {colunasVisiveis.pavimento && <th style={TH_STYLE}>Pavimento</th>}
              {colunasVisiveis.tarefa && <th style={TH_STYLE}>Tarefa</th>}
              {colunasVisiveis.etapa && <th style={TH_STYLE}>Etapa</th>}
              {colunasVisiveis.status && <th style={TH_STYLE}>Status</th>}
              {colunasVisiveis.total && <th style={{ ...TH_STYLE, textAlign: 'right' }}>Total (h)</th>}
              {colunasVisiveis.contribuicoes && <th style={TH_STYLE}>Contribuições</th>}
            </tr>
          </thead>
          <tbody>
            {dadosTabela.map((item) => (
              <tr key={item.id} style={{ borderBottom: '1px solid var(--cinza-100)' }}>
                {colunasVisiveis.pavimento && <td style={TD_STYLE}>{formatarLaje(item.laje)}</td>}
                {colunasVisiveis.tarefa && <td style={{ ...TD_STYLE, fontWeight: 700, color: 'var(--cinza-900)' }}>{item.tarefa}</td>}
                {colunasVisiveis.etapa && <td style={TD_STYLE}>{item._unificada ? '—' : getEtapaCurta(item)}</td>}
                {colunasVisiveis.status && (
                  <td style={TD_STYLE}>
                    <span style={getStatusStyle(item.status)}>{item.status}</span>
                  </td>
                )}
                {colunasVisiveis.total && (
                  <td style={{ ...TD_STYLE, textAlign: 'right', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: 'var(--verde-principal)' }}>
                    {item.horas_totais.toFixed(2)}
                  </td>
                )}
                {colunasVisiveis.contribuicoes && (
                  <td style={TD_STYLE}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {item.contribuicoes.length > 0 ? item.contribuicoes.map((c, cidx) => (
                        <div key={cidx} style={CHIP_STYLE}>
                          {c.usuario}: {c.horas.toFixed(2)}h
                        </div>
                      )) : <span style={{ color: 'var(--cinza-300)', fontStyle: 'italic', fontSize: '9px' }}>—</span>}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        <div style={FOOTER_STYLE}>
          <span>Fórmula Engenharia — Uso Interno</span>
          <span>Página 1 / 1</span>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; padding: 0 !important; margin: 0 !important; }
          * { -webkit-print-color-adjust: exact; }
          @page { size: A4; margin: 1cm; }
        }
      `}</style>
    </div>
  )
}

// Estilos constantes para legibilidade
const ACTION_BTN_STYLE: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
  background: 'var(--cinza-50)', border: '1px solid var(--cinza-300)', borderRadius: '6px',
  cursor: 'pointer', fontWeight: 700, color: 'var(--cinza-600)',
  fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', fontSize: '11px'
}

const CONFIG_PANEL_STYLE: React.CSSProperties = {
  background: 'var(--superficie-1)', padding: '12px 16px', borderRadius: 'var(--raio-card)', 
  border: '1px solid var(--cinza-300)', display: 'flex', flexWrap: 'wrap', gap: '16px'
}

const CONFIG_TITLE_STYLE: React.CSSProperties = {
  width: '100%', fontSize: '10px', fontWeight: 700, color: 'var(--cinza-600)', 
  textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'Barlow Condensed', sans-serif"
}

const CONFIG_LABEL_STYLE: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600
}

const REPORT_CONTAINER_STYLE: React.CSSProperties = {
  background: 'white', padding: '20px', borderRadius: 'var(--raio-card)', 
  border: '1px solid var(--cinza-300)', minHeight: 'auto', color: 'var(--cinza-800)'
}

const HEADER_STYLE: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'start', 
  marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--cinza-100)'
}

const TITLE_STYLE: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif", fontSize: '18px', 
  fontWeight: 700, textTransform: 'uppercase', margin: 0, color: 'var(--cinza-900)'
}

const SUBTITLE_STYLE: React.CSSProperties = { color: 'var(--cinza-600)', fontSize: '11px', margin: '2px 0 0' }
const DATE_STYLE: React.CSSProperties = { color: 'var(--cinza-300)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', margin: '4px 0 0' }

const TH_STYLE: React.CSSProperties = {
  padding: '8px 6px', textAlign: 'left', fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 700, textTransform: 'uppercase', color: 'var(--cinza-600)', fontSize: '9px'
}

const TD_STYLE: React.CSSProperties = { padding: '6px 6px', verticalAlign: 'top', fontSize: '10px' }

const CHIP_STYLE: React.CSSProperties = {
  background: 'var(--cinza-50)', padding: '1px 4px', borderRadius: '3px', 
  border: '1px solid var(--cinza-300)', fontSize: '8px', fontWeight: 600, color: 'var(--cinza-600)'
}

const FOOTER_STYLE: React.CSSProperties = {
  marginTop: '24px', paddingTop: '8px', borderTop: '1px solid var(--cinza-100)',
  fontSize: '8px', color: 'var(--cinza-300)', display: 'flex', justifyContent: 'space-between', 
  fontStyle: 'italic', fontWeight: 600, textTransform: 'uppercase'
}
