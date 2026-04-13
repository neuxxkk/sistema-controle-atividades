'use client'
import React from 'react'

interface Props {
  titulo: React.ReactNode
  subtitulo?: React.ReactNode
  acoes?: React.ReactNode
}

export function PageHeader({ titulo, subtitulo, acoes }: Props) {
  return (
    <header style={{
      padding: '24px var(--espaco-pagina) 18px var(--espaco-pagina)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      borderBottom: '1px solid var(--borda-padrao)',
      background: 'var(--superficie-1)'
    }}>
      <div>
        <h1 style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: '26px',
          fontWeight: 700,
          color: 'var(--texto-principal)',
          margin: 0,
          textTransform: 'uppercase',
          letterSpacing: '0.03em'
        }}>
          {titulo}
        </h1>
        {subtitulo && (
          <p style={{
            color: 'var(--texto-secundario)',
            marginTop: '6px',
            fontSize: '13px'
          }}>
            {subtitulo}
          </p>
        )}
      </div>
      {acoes && (
        <div style={{ display: 'flex', gap: '12px' }}>
          {acoes}
        </div>
      )}
    </header>
  )
}
