'use client'
import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/context/ToastContext'
import { api } from '@/lib/api'
import type { Construtora } from '@/types'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function ModalNovoEdificio({ isOpen, onClose, onSuccess }: Props) {
  const { addToast } = useToast()
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [numPavimentos, setNumPavimentos] = useState(1)
  const [construtoraId, setConstrutoraId] = useState<number>(0)
  const [construtoras, setConstrutoras] = useState<Construtora[]>([])
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (isOpen) {
      api.get<Construtora[]>('/construtoras/').then(setConstrutoras)
    }
  }, [isOpen])

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!construtoraId) {
      addToast('Selecione uma construtora', 'aviso')
      return
    }
    if (!nome) return
    
    setEnviando(true)
    try {
      await api.post('/edificios/', {
        nome,
        descricao,
        num_pavimentos: numPavimentos,
        construtora_id: construtoraId
      })
      onSuccess()
      onClose()
      setNome('')
      setDescricao('')
      setNumPavimentos(1)
      addToast('Edifício criado com sucesso', 'sucesso')
    } catch (error) {
      addToast('Erro ao criar edifício', 'erro')
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
      title="Novo Edifício"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button 
            onClick={() => handleSubmit()} 
            isLoading={enviando}
            disabled={!nome || !construtoraId}
          >
            Criar Edifício →
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={labelStyle}>Construtora</label>
          <select 
            value={construtoraId} 
            onChange={e => setConstrutoraId(Number(e.target.value))}
            required
            style={{ ...inputStyle, background: 'var(--superficie-1)' }}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--verde-principal)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--cinza-300)'}
          >
            <option value={0}>Selecione...</option>
            {construtoras.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Nome do Edifício</label>
          <input 
            type="text" 
            value={nome} 
            onChange={e => setNome(e.target.value)} 
            required
            placeholder="Ex: Ed. Sol Nascente"
            style={inputStyle}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--verde-principal)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--cinza-300)'}
            autoFocus
          />
        </div>

        <div>
          <label style={labelStyle}>Número de Pavimentos</label>
          <input 
            type="number" 
            min={1} 
            max={100}
            value={numPavimentos} 
            onChange={e => setNumPavimentos(Number(e.target.value))} 
            required
            style={inputStyle}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--verde-principal)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--cinza-300)'}
          />
          <p style={{ fontSize: '11px', color: 'var(--cinza-600)', marginTop: '4px', fontStyle: 'italic' }}>
            O sistema gerará automaticamente Fundação, Lajes e Reservatórios.
          </p>
        </div>

        <div>
          <label style={labelStyle}>Descrição (opcional)</label>
          <textarea 
            value={descricao} 
            onChange={e => setDescricao(e.target.value)}
            placeholder="Notas sobre o projeto..."
            style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--verde-principal)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--cinza-300)'}
          />
        </div>
      </form>
    </Modal>
  )
}
