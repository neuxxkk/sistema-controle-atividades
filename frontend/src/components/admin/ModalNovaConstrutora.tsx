'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/context/ToastContext'
import { api } from '@/lib/api'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function ModalNovaConstrutora({ isOpen, onClose, onSuccess }: Props) {
  const { addToast } = useToast()
  const [nome, setNome] = useState('')
  const [enviando, setEnviando] = useState(false)

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!nome) return

    setEnviando(true)
    try {
      await api.post('/construtoras/', { nome })
      onSuccess()
      onClose()
      setNome('')
      addToast('Construtora criada com sucesso', 'sucesso')
    } catch (error) {
      addToast('Erro ao criar construtora', 'erro')
    } finally {
      setEnviando(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: '10px',
    borderRadius: '4px',
    border: '1px solid var(--cinza-300)',
    fontSize: '14px',
    outline: 'none',
    width: '100%',
    transition: 'border-color 200ms ease'
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--cinza-600)',
    marginBottom: '6px',
    display: 'block'
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nova Construtora"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            onClick={() => handleSubmit()}
            isLoading={enviando}
            disabled={!nome}
          >
            Criar Construtora →
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={labelStyle}>Nome da Construtora</label>
          <input
            type="text"
            value={nome}
            onChange={e => setNome(e.target.value)}
            required
            placeholder="Ex: Construtora Silva & Filhos"
            style={inputStyle}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--verde-principal)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--cinza-300)'}
            autoFocus
          />
        </div>
      </form>
    </Modal>
  )
}
