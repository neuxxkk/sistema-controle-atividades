'use client'
import React, { useEffect } from 'react'

export type ToastType = 'sucesso' | 'erro' | 'aviso'

interface ToastProps {
  id: string
  mensagem: string
  tipo: ToastType
  onClose: (id: string) => void
}

export function Toast({ id, mensagem, tipo, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => onClose(id), 5000)
    return () => clearTimeout(timer)
  }, [id, onClose])

  const cores: Record<ToastType, string> = {
    sucesso: 'var(--sucesso)',
    erro: 'var(--erro)',
    aviso: 'var(--aviso)'
  }

  return (
    <div style={{
      background: 'var(--superficie-1)',
      border: '1px solid var(--borda-padrao)',
      borderLeft: `4px solid ${cores[tipo]}`,
      padding: '16px 20px',
      borderRadius: '4px',
      boxShadow: 'var(--sombra-elevada)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      minWidth: '300px',
      animation: 'toast-in 300ms ease-out',
      pointerEvents: 'auto'
    }}>
      <span style={{ 
        fontSize: '14px', 
        fontWeight: 500, 
        color: 'var(--cinza-800)',
        fontFamily: "'DM Sans', sans-serif" 
      }}>
        {mensagem}
      </span>
      <button 
        onClick={() => onClose(id)}
        aria-label="Fechar"
        style={{ 
          background: 'none', 
          border: 'none', 
          color: 'var(--cinza-300)', 
          cursor: 'pointer',
          fontSize: '18px',
          padding: '0 4px'
        }}
      >
        ×
      </button>
    </div>
  )
}
