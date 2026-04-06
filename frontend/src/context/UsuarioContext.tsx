'use client'
import React, { createContext, useContext, useState, useEffect } from 'react'
import type { UsuarioLocal } from '@/types'

const STORAGE_KEY = 'formula_usuario'

interface UsuarioContextType {
  usuario: UsuarioLocal | null
  carregando: boolean
  salvarUsuario: (u: UsuarioLocal) => void
  limparUsuario: () => void
}

const UsuarioContext = createContext<UsuarioContextType | undefined>(undefined)

export function UsuarioProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioLocal | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    const salvo = localStorage.getItem(STORAGE_KEY)
    if (salvo) {
      try {
        setUsuario(JSON.parse(salvo))
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
    setCarregando(false)
  }, [])

  function salvarUsuario(u: UsuarioLocal) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
    setUsuario(u)
  }

  function limparUsuario() {
    localStorage.removeItem(STORAGE_KEY)
    setUsuario(null)
  }

  return (
    <UsuarioContext.Provider value={{ usuario, carregando, salvarUsuario, limparUsuario }}>
      {children}
    </UsuarioContext.Provider>
  )
}

export function useUsuario() {
  const context = useContext(UsuarioContext)
  if (context === undefined) {
    throw new Error('useUsuario deve ser usado dentro de um UsuarioProvider')
  }
  return context
}
