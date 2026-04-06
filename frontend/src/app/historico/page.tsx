'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useUsuarioLocal } from '@/hooks/useUsuarioLocal'
import { PageHeader } from '@/components/layout/PageHeader'
import { formatarDuracao, formatarData } from '@/lib/formatters'
import type { SessaoTrabalho } from '@/types'

export default function HistoricoPage() {
  const { usuario } = useUsuarioLocal()
  const [sessoes, setSessoes] = useState<SessaoTrabalho[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (usuario) {
      api.get<SessaoTrabalho[]>(`/sessoes/?usuario_id=${usuario.usuario_id}`)
        .then(setSessoes)
        .finally(() => setCarregando(false))
    }
  }, [usuario])

  const tempoTotal = sessoes.reduce((acc, s) => acc + (s.duracao_segundos || 0), 0)

  return (
    <>
      <PageHeader 
        titulo="Meu Histórico" 
        subtitulo="Visualize suas sessões de trabalho e o tempo total dedicado"
      />

      <div style={{ padding: 'var(--espaco-pagina)', maxWidth: '1000px' }}>
        
        {/* Resumo */}
        <div style={{ 
          background: 'var(--verde-principal)', color: '#fff', padding: '24px', 
          borderRadius: 'var(--raio-card)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '24px'
        }}>
          <div>
            <div style={{ fontSize: '12px', textTransform: 'uppercase', opacity: 0.8, fontWeight: 600, letterSpacing: '0.05em' }}>
              Tempo Total Registrado
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '32px', fontWeight: 600 }}>
              {formatarDuracao(tempoTotal)}
            </div>
          </div>
          <div style={{ height: '40px', width: '1px', background: 'rgba(255,255,255,0.2)' }} />
          <div>
            <div style={{ fontSize: '12px', textTransform: 'uppercase', opacity: 0.8, fontWeight: 600, letterSpacing: '0.05em' }}>
              Total de Sessões
            </div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '32px', fontWeight: 600 }}>
              {sessoes.length}
            </div>
          </div>
        </div>

        {/* Tabela de Sessões */}
        <div style={{ background: 'var(--superficie-1)', borderRadius: 'var(--raio-card)', border: '1px solid var(--borda-padrao)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--superficie-2)', textAlign: 'left', borderBottom: '1px solid var(--borda-padrao)' }}>
                <th style={{ padding: 'var(--tabela-padding)', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', fontSize: '12px', color: 'var(--texto-secundario)' }}>Início</th>
                <th style={{ padding: 'var(--tabela-padding)', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', fontSize: '12px', color: 'var(--texto-secundario)' }}>Fim</th>
                <th style={{ padding: 'var(--tabela-padding)', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', fontSize: '12px', color: 'var(--texto-secundario)' }}>Duração</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr><td colSpan={3} style={{ padding: '32px', textAlign: 'center' }}>Carregando histórico...</td></tr>
              ) : sessoes.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--cinza-100)' }}>
                  <td style={{ padding: 'var(--tabela-padding)' }}>{formatarData(s.iniciado_em)}</td>
                  <td style={{ padding: 'var(--tabela-padding)' }}>{s.finalizado_em ? formatarData(s.finalizado_em) : 'Em aberto'}</td>
                  <td style={{ padding: 'var(--tabela-padding)', fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>
                    {s.duracao_segundos ? formatarDuracao(s.duracao_segundos) : '--:--:--'}
                  </td>
                </tr>
              ))}
              {!carregando && sessoes.length === 0 && (
                <tr><td colSpan={3} style={{ padding: '48px', textAlign: 'center', color: 'var(--cinza-300)' }}>Nenhuma sessão encontrada</td></tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </>
  )
}
