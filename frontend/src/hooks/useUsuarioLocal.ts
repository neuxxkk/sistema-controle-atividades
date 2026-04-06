import { useState, useEffect } from 'react'
import type { UsuarioLocal } from '@/types'

const STORAGE_KEY = 'formula_usuario'

export function useUsuarioLocal() {
  const [usuario, setUsuario] = useState<UsuarioLocal | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    const salvo = localStorage.getItem(STORAGE_KEY)
    if (salvo) {
      try { setUsuario(JSON.parse(salvo)) } catch { localStorage.removeItem(STORAGE_KEY) }
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

  return { usuario, carregando, salvarUsuario, limparUsuario }
}
