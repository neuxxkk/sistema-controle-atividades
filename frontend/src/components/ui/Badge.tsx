'use client'
import type { StatusAtividade } from '@/types'

const VARIANTES: Record<StatusAtividade, { bg: string; text: string; dot: boolean; label: string }> = {
  'Pendente':              { bg: 'var(--status-pendente-bg)', text: 'var(--status-pendente-text)', dot: false, label: 'Pendente' },
  'Fazendo':               { bg: 'var(--status-fazendo-bg)',  text: 'var(--status-fazendo-text)',  dot: true,  label: 'Fazendo' },
  'Pausado':               { bg: 'var(--status-pausado-bg)',  text: 'var(--status-pausado-text)',  dot: false, label: 'Pausado' },
  'Ok':                    { bg: 'var(--status-ok-bg)',       text: 'var(--status-ok-text)',       dot: false, label: 'Ok' },
  'Atendendo comentarios': { bg: 'var(--status-atend-bg)',    text: 'var(--status-atend-text)',    dot: false, label: 'Atendendo comentários' },
  'Gerado':                { bg: 'var(--status-gerado-bg)',   text: 'var(--status-gerado-text)',   dot: false, label: 'Gerado' },
  'Impresso':              { bg: 'var(--status-impresso-bg)', text: 'var(--status-impresso-text)', dot: false, label: 'Impresso' },
  'Montada':               { bg: 'var(--status-montada-bg)',  text: 'var(--status-montada-text)',  dot: false, label: 'Montada — pronto para imprimir' },
}

interface Props {
  status: StatusAtividade
  onClick?: () => void
}

export function StatusBadge({ status, onClick }: Props) {
  const v = VARIANTES[status]
  if (!v) return null

  return (
    <span
      onClick={onClick}
      aria-label={`Status: ${v.label}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        background: v.bg, color: v.text,
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: '12px', fontWeight: 600,
        letterSpacing: '0.07em', textTransform: 'uppercase',
        padding: '3px 8px', borderRadius: '3px',
        cursor: onClick ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
      }}
    >
      {v.dot && (
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'currentColor',
          animation: 'pulse 1.8s ease-in-out infinite',
          flexShrink: 0,
        }} />
      )}
      {status === 'Ok' && '✓ '}
      {v.label}
    </span>
  )
}
