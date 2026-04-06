'use client'
import React, { createContext, useContext, useState, useCallback } from 'react'
import { Toast, ToastType } from '@/components/ui/Toast'

interface ToastMessage {
  id: string
  mensagem: string
  tipo: ToastType
}

interface ToastContextData {
  addToast: (mensagem: string, tipo: ToastType) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextData>({} as ToastContextData)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = useCallback((mensagem: string, tipo: ToastType) => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts(prev => [...prev, { id, mensagem, tipo }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div style={{
        position: 'fixed',
        bottom: '32px',
        right: '32px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        pointerEvents: 'none'
      }}>
        {toasts.map(t => (
          <Toast 
            key={t.id} 
            id={t.id} 
            mensagem={t.mensagem} 
            tipo={t.tipo} 
            onClose={removeToast} 
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast deve ser usado dentro de um ToastProvider')
  return context
}
