'use client'
import { StatusBadge } from '@/components/ui/Badge'
import { formatarTipoElemento, formatarLaje, vinculaFuncionario } from '@/lib/constants'
import type { Atividade, StatusAtividade } from '@/types'

interface Props {
  atividade: Atividade
  onIniciar: (id: number) => void
  onPausar: () => void
  onSolicitarAvanco: (atividade: Atividade) => void
  onAbrirDetalhe?: (atividadeId: number) => void
  disabled?: boolean
  isAtiva?: boolean
  iniciarLabel?: string
  avancoLabel?: string
  mostrarAvanco?: boolean
}

export function CardAtividade({
  atividade,
  onIniciar,
  onPausar,
  onSolicitarAvanco,
  onAbrirDetalhe,
  disabled,
  isAtiva,
  iniciarLabel,
  avancoLabel,
  mostrarAvanco,
}: Props) {
  const temVinculo = vinculaFuncionario(atividade.tipo_elemento, atividade.subtipo)
  const concluida = atividade.status_atual === 'Ok' || atividade.status_atual === 'Montada' || atividade.status_atual === 'Atendendo comentarios'

  const podeIniciarOuRetomar = temVinculo && !isAtiva && !concluida
  const podePausar = temVinculo && !!isAtiva
  const podeAvancar = !concluida && (mostrarAvanco ?? true)

  const lajeNome = atividade.laje ? formatarLaje(atividade.laje.tipo) : 'Laje'
  const edificioNome = atividade.laje?.edificio?.nome || 'Edifício'

  return (
    <div style={{
      background: 'var(--superficie-1)', border: '1px solid var(--borda-padrao)', borderRadius: '6px',
      padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px',
      transition: 'all 200ms ease', position: 'relative',
      boxShadow: isAtiva ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
      borderLeft: isAtiva ? '4px solid var(--verde-principal)' : '1px solid var(--borda-padrao)',
      cursor: onAbrirDetalhe ? 'pointer' : 'default'
    }} onClick={() => onAbrirDetalhe?.(atividade.id)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <StatusBadge status={atividade.status_atual} />
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11px',
          fontWeight: 600, color: 'var(--cinza-600)', textTransform: 'uppercase',
          letterSpacing: '0.05em', textAlign: 'right'
        }}>
          {lajeNome} · {edificioNome}
        </span>
      </div>

      <h3 style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: '18px',
        fontWeight: 700, color: 'var(--cinza-800)', margin: 0,
        lineHeight: '1.2'
      }}>
        {formatarTipoElemento(atividade.tipo_elemento, atividade.subtipo)}
      </h3>

      <div style={{
        marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--cinza-100)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div style={{ color: 'var(--cinza-600)', fontSize: '12px' }}>
          {isAtiva ? (
            <span style={{ color: 'var(--verde-principal)', fontWeight: 600 }}>Sessão ativa</span>
          ) : (
            (concluida ? 'Atividade concluída' : 'Pronta para ação')
          )}
        </div>

        {podeIniciarOuRetomar && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onIniciar(atividade.id)
            }}
            disabled={disabled}
            style={{
              background: 'var(--verde-principal)', border: 'none',
              color: '#fff', borderRadius: '4px', padding: '8px 16px',
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px',
              fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1
            }}
          >
            {iniciarLabel || 'Play'}
          </button>
        )}

        {podePausar && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onPausar()
            }}
            style={{
              background: 'var(--superficie-2)', border: '1px solid var(--borda-padrao)',
              color: 'var(--texto-principal)', borderRadius: '4px', padding: '8px 14px',
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11px',
              fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
              cursor: 'pointer'
            }}
          >
            Pausar
          </button>
        )}

        {podeAvancar && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onSolicitarAvanco(atividade)
            }}
            disabled={disabled && !isAtiva}
            style={{
              background: 'var(--acao-neutra-bg)', border: 'none',
              color: 'var(--acao-neutra-texto)', borderRadius: '4px', padding: '8px 14px',
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11px',
              fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
              cursor: disabled && !isAtiva ? 'not-allowed' : 'pointer',
              opacity: disabled && !isAtiva ? 0.5 : 1
            }}
          >
            {avancoLabel || 'Avançar'}
          </button>
        )}
      </div>
    </div>
  )
}
