'use client'
import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/context/ToastContext'
import { api } from '@/lib/api'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
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
  const [personalizado, setPersonalizado] = useState(false)
  const [secaoAberta, setSecaoAberta] = useState(false)
  const [removerInicio, setRemoverInicio] = useState<number | ''>('')
  const [removerFim, setRemoverFim] = useState<number | ''>('')
  const [customNome, setCustomNome] = useState('')
  const [customPosicao, setCustomPosicao] = useState<number | ''>('')
  const [pavimentosCustomizados, setPavimentosCustomizados] = useState<Array<{ nome: string; posicao: number }>>([])

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
      const basePavimentos = [
        'Fundacao',
        ...Array.from({ length: numPavimentos }).map((_, i) => `Laje_${i + 1}`),
        'FundCX',
        'TampaCX',
      ]

      let pavimentosFinais = [...basePavimentos]
      if (personalizado && removerInicio !== '' && removerFim !== '') {
        const ini = Number(removerInicio)
        const fim = Number(removerFim)
        if (Number.isFinite(ini) && Number.isFinite(fim) && ini >= 1 && fim >= ini) {
          pavimentosFinais = pavimentosFinais.filter((tipo) => {
            const m = tipo.match(/^Laje_(\d+)$/)
            if (!m) return true
            const n = Number(m[1])
            return n < ini || n > fim
          })
        }
      }

      if (personalizado && pavimentosCustomizados.length > 0) {
        const lista = [...pavimentosFinais]
        const inserts = [...pavimentosCustomizados].sort((a, b) => a.posicao - b.posicao)
        inserts.forEach(item => {
          const idx = Math.max(0, Math.min(item.posicao - 1, lista.length))
          lista.splice(idx, 0, item.nome)
        })
        pavimentosFinais = lista
      }

      await api.post('/edificios/', {
        nome,
        descricao,
        num_pavimentos: numPavimentos,
        construtora_id: construtoraId,
        lajes_customizadas: personalizado
          ? pavimentosFinais.map(tipo => ({ tipo }))
          : null,
      })
      onSuccess()
      onClose()
      setNome('')
      setDescricao('')
      setNumPavimentos(1)
      setPersonalizado(false)
      setSecaoAberta(false)
      setRemoverInicio('')
      setRemoverFim('')
      setCustomNome('')
      setCustomPosicao('')
      setPavimentosCustomizados([])
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

        <div style={{ border: '1px solid var(--cinza-300)', borderRadius: '8px', overflow: 'hidden' }}>
          <button
            type="button"
            onClick={() => setSecaoAberta(prev => !prev)}
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 12px',
              border: 'none',
              background: 'var(--cinza-50)',
              cursor: 'pointer',
              fontWeight: 700,
              color: 'var(--cinza-700)',
            }}
          >
            <span>Edifício personalizado</span>
            {secaoAberta ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          {secaoAberta && (
            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px' }}>
                <input type="checkbox" checked={personalizado} onChange={(e) => setPersonalizado(e.target.checked)} />
                Ativar configuração manual de pavimentos
              </label>

              {personalizado && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <input
                      type="number"
                      min={1}
                      value={removerInicio}
                      onChange={e => setRemoverInicio(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Remover lajes: início (x)"
                      style={inputStyle}
                    />
                    <input
                      type="number"
                      min={1}
                      value={removerFim}
                      onChange={e => setRemoverFim(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Remover lajes: fim (y)"
                      style={inputStyle}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px auto', gap: '8px' }}>
                    <input
                      value={customNome}
                      onChange={e => setCustomNome(e.target.value)}
                      placeholder="Nome pavimento personalizado"
                      style={inputStyle}
                    />
                    <input
                      type="number"
                      min={1}
                      value={customPosicao}
                      onChange={e => setCustomPosicao(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Posição"
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!customNome.trim() || customPosicao === '') return
                        setPavimentosCustomizados(prev => [...prev, { nome: customNome.trim(), posicao: Number(customPosicao) }])
                        setCustomNome('')
                        setCustomPosicao('')
                      }}
                      style={{ border: '1px solid var(--verde-principal)', background: 'var(--verde-principal)', color: '#fff', borderRadius: '6px', padding: '8px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Plus size={14} /> Adicionar
                    </button>
                  </div>

                  {pavimentosCustomizados.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {pavimentosCustomizados.map((p, idx) => (
                        <div key={`${p.nome}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--cinza-50)', border: '1px solid var(--cinza-200)', borderRadius: '6px', padding: '6px 8px' }}>
                          <span style={{ fontSize: '12px' }}>{p.nome} · posição {p.posicao}</span>
                          <button
                            type="button"
                            onClick={() => setPavimentosCustomizados(prev => prev.filter((_, i) => i !== idx))}
                            style={{ border: '1px solid var(--erro)', background: 'transparent', color: 'var(--erro)', borderRadius: '6px', padding: '4px 6px', cursor: 'pointer' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </form>
    </Modal>
  )
}
