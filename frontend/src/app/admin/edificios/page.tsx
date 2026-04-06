'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useUsuario } from '@/context/UsuarioContext'
import { useToast } from '@/context/ToastContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { ModalNovoEdificio } from '@/components/admin/ModalNovoEdificio'
import { ArvoreEstrutura } from '@/components/admin/ArvoreEstrutura'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import type { Edificio, Laje, Atividade, ProximosStatusAtividade, StatusAtividade } from '@/types'

type EdificioCompleto = Edificio & { 
  lajes: (Laje & { atividades: Atividade[] })[] 
}

export default function EdificiosPage() {
  const { usuario } = useUsuario()
  const { addToast } = useToast()
  const [edificios, setEdificios] = useState<Edificio[]>([])
  const [selecionado, setSelecionado] = useState<EdificioCompleto | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [filtroEstrutura, setFiltroEstrutura] = useState('')
  const [excluindo, setExcluindo] = useState<Edificio | null>(null)
  const [processandoExclusao, setProcessandoExclusao] = useState(false)
  const [statusOpcoesPorAtividade, setStatusOpcoesPorAtividade] = useState<Record<number, StatusAtividade[]>>({})

  const carregarEdificios = async () => {
    try {
      const data = await api.get<Edificio[]>('/edificios/')
      setEdificios(data)
    } catch (e) {
      console.error('Erro ao carregar edifícios')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarEdificios()
  }, [])

  const excluirEdificio = async (hardDelete: boolean) => {
    if (!excluindo) return
    setProcessandoExclusao(true)
    try {
      await api.delete(`/edificios/${excluindo.id}?hard_delete=${hardDelete ? 'true' : 'false'}`)
      if (selecionado?.id === excluindo.id) {
        setSelecionado(null)
      }
      setExcluindo(null)
      addToast(hardDelete ? 'Edifício excluído definitivamente' : 'Edifício encerrado com sucesso', 'sucesso')
      await carregarEdificios()
    } catch (e: any) {
      addToast(e?.message || 'Erro ao excluir edifício', 'erro')
    } finally {
      setProcessandoExclusao(false)
    }
  }

  const carregarOpcoesStatus = async (estrutura: EdificioCompleto) => {
    const atividades = estrutura.lajes.flatMap(laje => laje.atividades ?? [])
    const resultados = await Promise.allSettled(
      atividades.map(async (atividade) => {
        const data = await api.get<ProximosStatusAtividade>(`/atividades/${atividade.id}/proximos-status?modo_admin=true`)
        const opcoes = [
          atividade.status_atual,
          ...data.opcoes.filter((status) => status !== atividade.status_atual),
        ]
        return { id: atividade.id, opcoes }
      })
    )

    const mapa: Record<number, StatusAtividade[]> = {}
    for (const atividade of atividades) {
      mapa[atividade.id] = [atividade.status_atual]
    }

    for (const resultado of resultados) {
      if (resultado.status === 'fulfilled') {
        mapa[resultado.value.id] = resultado.value.opcoes
      }
    }

    setStatusOpcoesPorAtividade(mapa)
  }

  const selecionarEdificio = async (id: number) => {
    try {
      const data = await api.get<EdificioCompleto>(`/edificios/${id}/estrutura`)
      setSelecionado(data)
      await carregarOpcoesStatus(data)
    } catch (e) {
      addToast('Erro ao carregar estrutura do edifício', 'erro')
    }
  }

  const handleUpdateStatus = async (atividadeId: number, novoStatus: StatusAtividade) => {
    if (!usuario) return
    try {
      const params = new URLSearchParams({
        status_novo: novoStatus,
        usuario_id: String(usuario.usuario_id)
      })
      await api.put(`/atividades/${atividadeId}/status?${params.toString()}`, {})
      if (selecionado) {
        await selecionarEdificio(selecionado.id)
      }
      addToast('Status atualizado com sucesso', 'sucesso')
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : 'Erro ao atualizar status'
      addToast(mensagem, 'erro')
    }
  }

  return (
    <>
      <PageHeader 
        titulo="Edifícios" 
        subtitulo="Gerencie os projetos e acompanhe a estrutura de lajes e atividades"
        acoes={
          <button 
            onClick={() => setIsModalOpen(true)}
            style={{
              background: 'var(--verde-principal)', border: 'none',
              color: '#fff', borderRadius: '4px', padding: '10px 24px',
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px',
              fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
              cursor: 'pointer'
            }}
          >
            + Novo Edifício
          </button>
        }
      />

      <div style={{ padding: '32px', display: 'grid', gridTemplateColumns: '300px 1fr', gap: '32px', alignItems: 'start' }}>
        {/* Lista Lateral */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h2 style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px',
            fontWeight: 700, color: 'var(--cinza-600)', textTransform: 'uppercase',
            letterSpacing: '0.1em', marginBottom: '4px'
          }}>
            Projetos Ativos
          </h2>
          
          {carregando ? (
            <p>Carregando...</p>
          ) : edificios.map(ed => (
            <button
              key={ed.id}
              onClick={() => selecionarEdificio(ed.id)}
              style={{
                padding: '16px', textAlign: 'left', background: selecionado?.id === ed.id ? 'var(--verde-claro)' : 'var(--superficie-1)',
                border: '1px solid', borderColor: selecionado?.id === ed.id ? 'var(--verde-principal)' : 'var(--cinza-300)',
                borderRadius: '6px', cursor: 'pointer', transition: 'all 200ms'
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--cinza-800)' }}>{ed.nome}</div>
              <div style={{ fontSize: '12px', color: 'var(--cinza-600)', marginTop: '4px' }}>
                {ed.descricao || 'Sem descrição'}
              </div>
            </button>
          ))}

          {!carregando && edificios.length === 0 && (
            <p style={{ fontSize: '14px', color: 'var(--cinza-600)', fontStyle: 'italic' }}>
              Nenhum edifício cadastrado.
            </p>
          )}
        </div>

        {/* Detalhes / Árvore */}
        <div>
          {selecionado ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                background: 'var(--superficie-1)',
                border: '1px solid var(--cinza-300)',
                borderRadius: '8px',
                padding: '12px'
              }}>
                <input
                  type="text"
                  value={filtroEstrutura}
                  onChange={(e) => setFiltroEstrutura(e.target.value)}
                  placeholder="Buscar laje, elemento, subtipo ou status..."
                  style={{
                    flex: 1,
                    minWidth: '180px',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--cinza-300)',
                    fontSize: '14px'
                  }}
                />
                <button
                  onClick={() => setFiltroEstrutura('')}
                  style={{
                    border: '1px solid var(--cinza-300)',
                    background: 'var(--cinza-50)',
                    color: 'var(--cinza-800)',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    cursor: 'pointer'
                  }}
                >
                  Limpar
                </button>
                <button
                  onClick={() => setExcluindo(selecionado)}
                  style={{
                    border: '1px solid var(--erro)',
                    background: 'transparent',
                    color: 'var(--erro)',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Excluir edifício
                </button>
              </div>

              <ArvoreEstrutura 
                edificio={selecionado} 
                onUpdateStatus={handleUpdateStatus}
                filtroTexto={filtroEstrutura}
                statusOpcoesPorAtividade={statusOpcoesPorAtividade}
              />
            </div>
          ) : (
            <div style={{
              height: '300px', border: '2px dashed var(--cinza-300)', borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cinza-300)',
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: '18px', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.05em'
            }}>
              Selecione um edifício para ver a estrutura
            </div>
          )}
        </div>
      </div>

      <ModalNovoEdificio 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={carregarEdificios}
      />

      <Modal
        isOpen={!!excluindo}
        onClose={() => setExcluindo(null)}
        title="Excluir edifício"
        footer={
          <>
            <Button variant="secondary" onClick={() => setExcluindo(null)} disabled={processandoExclusao}>
              Cancelar
            </Button>
            <Button variant="secondary" onClick={() => excluirEdificio(false)} disabled={processandoExclusao}>
              Encerrar (soft delete)
            </Button>
            <Button variant="danger" onClick={() => excluirEdificio(true)} isLoading={processandoExclusao}>
              Excluir definitivo
            </Button>
          </>
        }
      >
        Escolha como deseja remover {excluindo?.nome}. Encerrar mantém histórico e oculta dos ativos; excluir definitivo remove a estrutura inteira.
      </Modal>
    </>
  )
}
