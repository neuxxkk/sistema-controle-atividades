'use client'

import { Modal } from '@/components/ui/Modal'
import { formatarData, formatarDuracao } from '@/lib/formatters'
import { formatarNomeEdificio } from '@/lib/constants'
import type { EdificioDetalhe } from '@/types'

interface Props {
  isOpen: boolean
  onClose: () => void
  detalhe: EdificioDetalhe | null
}

const linhaStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  padding: '8px 0',
  borderBottom: '1px solid var(--cinza-100)',
}

const labelStyle: React.CSSProperties = {
  color: 'var(--cinza-600)',
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 700,
}

const valueStyle: React.CSSProperties = {
  color: 'var(--cinza-800)',
  fontSize: '14px',
  textAlign: 'right',
  fontWeight: 500,
}

export function ModalDetalheEdificio({ isOpen, onClose, detalhe }: Props) {
  const ed = detalhe?.edificio

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalhes do edifício">
      {!ed ? (
        <p>Carregando detalhes...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={linhaStyle}>
            <span style={labelStyle}>Edifício</span>
            <span style={valueStyle}>{formatarNomeEdificio(ed)}</span>
          </div>
          {ed.construtora && (
            <div style={linhaStyle}>
              <span style={labelStyle}>Construtora</span>
              <span style={valueStyle}>{ed.construtora.nome}</span>
            </div>
          )}
          {ed.descricao && (
            <div style={linhaStyle}>
              <span style={labelStyle}>Descrição</span>
              <span style={valueStyle}>{ed.descricao}</span>
            </div>
          )}
          <div style={linhaStyle}>
            <span style={labelStyle}>Criado em</span>
            <span style={valueStyle}>{formatarData(ed.criado_em)}</span>
          </div>
          <div style={linhaStyle}>
            <span style={labelStyle}>Encerrado em</span>
            <span style={valueStyle}>{ed.encerrado_em ? formatarData(ed.encerrado_em) : '—'}</span>
          </div>
          <div style={linhaStyle}>
            <span style={labelStyle}>Primeiro início</span>
            <span style={valueStyle}>{detalhe.primeiro_inicio ? formatarData(detalhe.primeiro_inicio) : '—'}</span>
          </div>
          <div style={linhaStyle}>
            <span style={labelStyle}>Última finalização</span>
            <span style={valueStyle}>{detalhe.ultima_finalizacao ? formatarData(detalhe.ultima_finalizacao) : '—'}</span>
          </div>
          <div style={linhaStyle}>
            <span style={labelStyle}>Atividades</span>
            <span style={valueStyle}>
              {detalhe.atividades_finalizadas} / {detalhe.total_atividades} finalizadas
            </span>
          </div>

          {detalhe.tempo_por_usuario.length > 0 && (
            <div style={{ marginTop: '20px', borderTop: '2px solid var(--cinza-200)', paddingTop: '12px' }}>
              <h4 style={{ ...labelStyle, marginBottom: '8px', fontSize: '11px', color: 'var(--cinza-900)' }}>
                Tempo por funcionário
              </h4>
              {(() => {
                const total = detalhe.tempo_por_usuario.reduce((s, t) => s + t.tempo_segundos, 0)
                return detalhe.tempo_por_usuario.map((t, idx) => (
                  <div key={idx} style={{ ...linhaStyle, borderBottom: '1px dashed var(--cinza-100)', display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '12px', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: 'var(--cinza-700)' }}>{t.usuario.nome}</span>
                    <span style={{ fontSize: '11px', color: 'var(--cinza-500)', fontFamily: 'monospace' }}>
                      {total > 0 ? `${((t.tempo_segundos / total) * 100).toFixed(1)}%` : '—'}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--verde-principal)', fontFamily: 'monospace' }}>
                      {formatarDuracao(t.tempo_segundos)}
                    </span>
                  </div>
                ))
              })()}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
