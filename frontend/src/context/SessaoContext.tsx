'use client'
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { useUsuario } from '@/context/UsuarioContext'
import { useToast } from '@/context/ToastContext'
import type { SessaoTrabalho, Atividade, Edificio, Laje } from '@/types'

interface SessaoContextData {
  sessaoAtiva: SessaoTrabalho | null
  atividadeAtiva: Atividade | null
  edificioAtivo: Edificio | null
  lajeAtiva: Laje | null
  carregando: boolean
  iniciarSessao: (atividadeId: number) => Promise<void>
  pausarSessao: () => Promise<void>
  finalizarSessao: () => Promise<void>
  refreshSessao: () => Promise<void>
}

const SessaoContext = createContext<SessaoContextData>({} as SessaoContextData)

export function SessaoProvider({ children }: { children: React.ReactNode }) {
  const { usuario } = useUsuario()
  const { addToast } = useToast()
  const [sessaoAtiva, setSessaoAtiva] = useState<SessaoTrabalho | null>(null)
  const [atividadeAtiva, setAtividadeAtiva] = useState<Atividade | null>(null)
  const [edificioAtivo, setEdificioAtivo] = useState<Edificio | null>(null)
  const [lajeAtiva, setLajeAtiva] = useState<Laje | null>(null)
  const [carregando, setCarregando] = useState(true)

  const refreshSessao = useCallback(async () => {
    if (!usuario?.usuario_id) {
      setSessaoAtiva(null)
      setAtividadeAtiva(null)
      setCarregando(false)
      return
    }

    try {
      // Garantindo que a URL seja exatamente /api/sessoes/status-atual
      const sessao = await api.get<SessaoTrabalho | null>(`/sessoes/status-atual?usuario_id=${usuario.usuario_id}`)
      setSessaoAtiva(sessao)

      if (sessao) {
        const atividade = await api.get<Atividade>(`/atividades/${sessao.atividade_id}`)
        setAtividadeAtiva(atividade)
      } else {
        setAtividadeAtiva(null)
      }
    } catch (error) {
      console.error('Erro ao buscar sessão ativa:', error)
    } finally {
      setCarregando(false)
    }
  }, [usuario])

  useEffect(() => {
    refreshSessao()
  }, [refreshSessao])

  const iniciarSessao = async (atividadeId: number) => {
    if (!usuario?.usuario_id) return
    try {
      const novaSessao = await api.post<SessaoTrabalho>('/sessoes/', {
        atividade_id: atividadeId,
        usuario_id: usuario.usuario_id
      })
      setSessaoAtiva(novaSessao)
      await refreshSessao()
      addToast('Sessão iniciada!', 'sucesso')
    } catch (error: any) {
      addToast(error.message || 'Erro ao iniciar sessão', 'erro')
    }
  }

  const pausarSessao = async () => {
    if (!sessaoAtiva || !usuario?.usuario_id) return
    try {
      await api.put<SessaoTrabalho>(`/sessoes/${sessaoAtiva.id}/pausar?usuario_id=${usuario.usuario_id}`, {})
      setSessaoAtiva(null)
      setAtividadeAtiva(null)
      await refreshSessao()
      addToast('Atividade pausada!', 'sucesso')
    } catch (error: any) {
      addToast(error.message || 'Erro ao pausar atividade', 'erro')
    }
  }

  const finalizarSessao = async () => {
    await pausarSessao()
  }

  return (
    <SessaoContext.Provider value={{
      sessaoAtiva, atividadeAtiva, edificioAtivo, lajeAtiva, carregando,
      iniciarSessao, pausarSessao, finalizarSessao, refreshSessao
    }}>
      {children}
    </SessaoContext.Provider>
  )
}

export function useSessao() {
  const context = useContext(SessaoContext)
  if (context === undefined) {
    throw new Error('useSessao deve ser usado dentro de um SessaoProvider')
  }
  return context
}
