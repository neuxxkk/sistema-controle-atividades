'use client'
import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  isLoading?: boolean
  icon?: React.ReactNode
}

export function Button({ 
  children, 
  variant = 'primary', 
  isLoading, 
  icon, 
  style,
  ...props 
}: ButtonProps) {
  const getStyles = () => {
    const base: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      padding: '10px 24px',
      borderRadius: '4px',
      fontFamily: "'Barlow Condensed', sans-serif",
      fontSize: '14px',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      cursor: props.disabled || isLoading ? 'not-allowed' : 'pointer',
      transition: 'all 200ms ease',
      border: 'none',
      opacity: props.disabled || isLoading ? 0.6 : 1,
      outline: 'none',
      whiteSpace: 'nowrap',
    }

    const variants: Record<string, React.CSSProperties> = {
      primary: {
        background: 'var(--verde-principal)',
        color: '#fff',
      },
      secondary: {
        background: 'var(--superficie-2)',
        border: '1px solid var(--borda-padrao)',
        color: 'var(--texto-principal)',
      },
      danger: {
        background: 'var(--erro)',
        color: '#fff',
      },
      ghost: {
        background: 'transparent',
        color: 'var(--texto-secundario)',
        padding: '8px 12px',
      }
    }

    return { ...base, ...variants[variant], ...style }
  }

  return (
    <button 
      style={getStyles()} 
      {...props}
      onMouseOver={(e) => {
        if (props.disabled || isLoading) return
        if (variant === 'primary') e.currentTarget.style.background = 'var(--verde-hover)'
        if (variant === 'secondary') e.currentTarget.style.background = 'var(--superficie-1)'
      }}
      onMouseOut={(e) => {
        if (props.disabled || isLoading) return
        if (variant === 'primary') e.currentTarget.style.background = 'var(--verde-principal)'
        if (variant === 'secondary') e.currentTarget.style.background = 'var(--superficie-2)'
      }}
    >
      {isLoading ? (
        <span style={{ animation: 'pulse 1.5s infinite' }}>Carregando...</span>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  )
}
