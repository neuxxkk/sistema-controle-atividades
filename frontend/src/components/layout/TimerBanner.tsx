'use client'
import { useTimer } from '@/hooks/useTimer'
import { formatarDuracao, formatarTipoElemento } from '@/lib/formatters'
import type { SessaoTrabalho, Atividade } from '@/types'

interface Props {
  sessao: SessaoTrabalho
  atividade: Atividade
  edificioNome: string
  lajeTipo: string
  onPausar: () => void
  onIrParaAtividade?: (atividadeId: number, edificioId?: number) => void
  onAbrirDetalhe?: (atividadeId: number) => void
}

export function TimerBanner({ sessao, atividade, edificioNome, lajeTipo, onPausar, onIrParaAtividade, onAbrirDetalhe }: Props) {
  const segundos = useTimer(sessao.iniciado_em)
  const edificioId = atividade.laje?.edificio?.id

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 10,
      background: 'var(--verde-principal)', color: '#fff',
      padding: '12px 32px',
      display: 'flex', alignItems: 'center', gap: '16px',
      fontFamily: "'Barlow Condensed', sans-serif",
      fontSize: '15px', fontWeight: 500, letterSpacing: '0.04em',
      animation: 'slide-down 250ms ease',
      cursor: onIrParaAtividade ? 'pointer' : 'default'
    }} onClick={() => onIrParaAtividade?.(atividade.id, edificioId)}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%', background: '#fff', flexShrink: 0,
        animation: 'pulse 1.8s ease-in-out infinite',
      }} />
      <span>Em andamento</span>
      <span style={{ color: 'rgba(255,255,255,0.75)', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
        {formatarTipoElemento(atividade.tipo_elemento, atividade.subtipo)}
        {' · '}{lajeTipo}{' · '}{edificioNome}
        {onAbrirDetalhe && (
          <button
            aria-label="Ver detalhes da tarefa"
            title="Ver detalhes"
            onClick={(e) => {
              e.stopPropagation()
              onAbrirDetalhe(atividade.id)
            }}
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.6)',
              background: 'rgba(255,255,255,0.12)',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 700,
              lineHeight: 1,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            i
          </button>
        )}
      </span>
      <span style={{
        marginLeft: 'auto',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '22px', fontWeight: 500,
      }}
        aria-live="polite"
        aria-label={`Tempo decorrido: ${formatarDuracao(segundos)}`}
      >
        {formatarDuracao(segundos)}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onPausar()
        }}
        style={{
          background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
          color: '#fff', borderRadius: '4px', padding: '6px 16px',
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px',
          fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        Pausar
      </button>
    </div>
  )
}
