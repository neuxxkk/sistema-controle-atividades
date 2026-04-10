'use client'
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { useUsuario } from '@/context/UsuarioContext'
import { useToast } from '@/context/ToastContext'
import type { SessaoTrabalho, Atividade } from '@/types'

interface SessaoContextData {
  sessaoAtiva: SessaoTrabalho | null
  atividadeAtiva: Atividade | null
  carregando: boolean
  iniciarSessao: (atividadeId: number) => Promise<void>
  pausarSessao: () => Promise<void>
  retomarSessao: (atividadeId: number) => Promise<void>
  avancarEtapa: (atividadeId: number) => Promise<void>
  finalizarAtividade: (atividadeId: number) => Promise<void>
  refreshSessao: () => Promise<void>
}

const SessaoContext = createContext<SessaoContextData>({} as SessaoContextData)

export function SessaoProvider({ children }: { children: React.ReactNode }) {
  const { usuario } = useUsuario()
  const { addToast } = useToast()
  const [sessaoAtiva, setSessaoAtiva] = useState<SessaoTrabalho | null>(null)
  const [atividadeAtiva, setAtividadeAtiva] = useState<Atividade | null>(null)
  const [carregando, setCarregando] = useState(true)

  const refreshSessao = useCallback(async () => {
    if (!usuario?.usuario_id) {
      setSessaoAtiva(null)
      setAtividadeAtiva(null)
      setCarregando(false)
      return
    }
    try {
      const sessao = await api.get<SessaoTrabalho | null>(
        `/sessoes/status-atual?usuario_id=${usuario.usuario_id}`
      )
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
      await api.post(`/atividades/${atividadeId}/iniciar?usuario_id=${usuario.usuario_id}`, {})
      await refreshSessao()
      addToast('Tarefa iniciada!', 'sucesso')
    } catch (error: any) {
      addToast(error.message || 'Erro ao iniciar tarefa', 'erro')
      throw error
    }
  }

  const pausarSessao = async () => {
    if (!atividadeAtiva || !usuario?.usuario_id) return
    try {
      await api.post(`/atividades/${atividadeAtiva.id}/pausar?usuario_id=${usuario.usuario_id}`, {})
      setSessaoAtiva(null)
      setAtividadeAtiva(null)
      await refreshSessao()
      addToast('Tarefa pausada!', 'sucesso')
    } catch (error: any) {
      addToast(error.message || 'Erro ao pausar tarefa', 'erro')
      throw error
    }
  }

  const retomarSessao = async (atividadeId: number) => {
    if (!usuario?.usuario_id) return
    try {
      await api.post(`/atividades/${atividadeId}/retomar?usuario_id=${usuario.usuario_id}`, {})
      await refreshSessao()
      addToast('Tarefa retomada!', 'sucesso')
    } catch (error: any) {
      addToast(error.message || 'Erro ao retomar tarefa', 'erro')
      throw error
    }
  }

  const avancarEtapa = async (atividadeId: number) => {
    if (!usuario?.usuario_id) return
    try {
      await api.post(`/atividades/${atividadeId}/avancar-etapa?usuario_id=${usuario.usuario_id}`, {})
      await refreshSessao()
      addToast('Etapa avançada!', 'sucesso')
    } catch (error: any) {
      addToast(error.message || 'Erro ao avançar etapa', 'erro')
      throw error
    }
  }

  const finalizarAtividade = async (atividadeId: number) => {
    if (!usuario?.usuario_id) return
    try {
      await api.post(`/atividades/${atividadeId}/finalizar?usuario_id=${usuario.usuario_id}`, {})
      setSessaoAtiva(null)
      setAtividadeAtiva(null)
      await refreshSessao()
      addToast('Tarefa finalizada!', 'sucesso')
    } catch (error: any) {
      addToast(error.message || 'Erro ao finalizar tarefa', 'erro')
      throw error
    }
  }

  return (
    <SessaoContext.Provider value={{
      sessaoAtiva, atividadeAtiva, carregando,
      iniciarSessao, pausarSessao, retomarSessao,
      avancarEtapa, finalizarAtividade, refreshSessao,
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
