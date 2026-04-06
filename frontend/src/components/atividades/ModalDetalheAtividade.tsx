'use client'

import { Modal } from '@/components/ui/Modal'
import { formatarData } from '@/lib/formatters'
import { formatarLaje, formatarTipoElemento } from '@/lib/constants'
import type { AtividadeDetalhe } from '@/types'

interface Props {
  isOpen: boolean
  onClose: () => void
  detalhe: AtividadeDetalhe | null
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

export function ModalDetalheAtividade({ isOpen, onClose, detalhe }: Props) {
  const atividade = detalhe?.atividade

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Detalhes da atividade"
    >
      {!atividade ? (
        <p>Carregando detalhes...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={linhaStyle}>
            <span style={labelStyle}>Elemento</span>
            <span style={valueStyle}>{formatarTipoElemento(atividade.tipo_elemento, atividade.subtipo)}</span>
          </div>

          <div style={linhaStyle}>
            <span style={labelStyle}>Edifício</span>
            <span style={valueStyle}>{atividade.laje?.edificio?.nome || '—'}</span>
          </div>

          <div style={linhaStyle}>
            <span style={labelStyle}>Laje</span>
            <span style={valueStyle}>{atividade.laje ? formatarLaje(atividade.laje.tipo) : '—'}</span>
          </div>

          <div style={linhaStyle}>
            <span style={labelStyle}>Status atual</span>
            <span style={valueStyle}>{atividade.status_atual}</span>
          </div>

          <div style={linhaStyle}>
            <span style={labelStyle}>Criada em</span>
            <span style={valueStyle}>{formatarData(atividade.criado_em)}</span>
          </div>

          <div style={linhaStyle}>
            <span style={labelStyle}>Primeiro início</span>
            <span style={valueStyle}>{detalhe?.iniciada_em ? formatarData(detalhe.iniciada_em) : '—'}</span>
          </div>

          <div style={linhaStyle}>
            <span style={labelStyle}>Última pausa</span>
            <span style={valueStyle}>{detalhe?.pausada_em ? formatarData(detalhe.pausada_em) : '—'}</span>
          </div>

          <div style={linhaStyle}>
            <span style={labelStyle}>Em andamento desde</span>
            <span style={valueStyle}>{detalhe?.em_andamento_desde ? formatarData(detalhe.em_andamento_desde) : '—'}</span>
          </div>

          <div style={{ ...linhaStyle, borderBottom: 'none' }}>
            <span style={labelStyle}>Usuário vinculado</span>
            <span style={valueStyle}>{detalhe?.usuario_vinculado?.nome || 'Sem vínculo'}</span>
          </div>
        </div>
      )}
    </Modal>
  )
}
