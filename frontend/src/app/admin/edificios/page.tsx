'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useUsuario } from '@/context/UsuarioContext'
import { useToast } from '@/context/ToastContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { ModalNovoEdificio } from '@/components/admin/ModalNovoEdificio'
import { ModalDetalheEdificio } from '@/components/admin/ModalDetalheEdificio'
import { ModalDetalheAtividade } from '@/components/atividades/ModalDetalheAtividade'
import { ArvoreEstrutura, type EdificioCompleto } from '@/components/admin/ArvoreEstrutura'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { formatarNomeEdificio } from '@/lib/constants'
import type { Edificio, AcaoAtividade, EdificioDetalhe, AtividadeDetalhe } from '@/types'

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
  const [detalheEdificio, setDetalheEdificio] = useState<EdificioDetalhe | null>(null)
  const [detalheEdificioAberto, setDetalheEdificioAberto] = useState(false)
  const [detalheAtividade, setDetalheAtividade] = useState<AtividadeDetalhe | null>(null)
  const [detalheAtividadeAberto, setDetalheAtividadeAberto] = useState(false)

  const carregarEdificios = async () => {
    try {
      const data = await api.get<Edificio[]>('/edificios/')
      setEdificios(data)
    } catch {
      console.error('Erro ao carregar edifícios')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregarEdificios() }, [])

  const selecionarEdificio = async (id: number) => {
    try {
      const data = await api.get<EdificioCompleto>(`/edificios/${id}/estrutura`)
      setSelecionado(data)
    } catch {
      addToast('Erro ao carregar estrutura do edifício', 'erro')
    }
  }

  const recarregarSelecionado = async () => {
    if (selecionado) await selecionarEdificio(selecionado.id)
  }

  const handleAcao = async (tipo: AcaoAtividade, atividadeId: number) => {
    if (!usuario) return
    try {
      await api.post(`/atividades/${atividadeId}/${tipo.replace('_', '-')}?usuario_id=${usuario.usuario_id}`, {})
      await recarregarSelecionado()
      addToast(`Ação executada: ${tipo}`, 'sucesso')
    } catch (e: any) {
      addToast(e?.message || `Erro ao executar: ${tipo}`, 'erro')
    }
  }

  const abrirDetalheEdificio = async () => {
    if (!selecionado) return
    try {
      const data = await api.get<EdificioDetalhe>(`/edificios/${selecionado.id}/detalhe`)
      setDetalheEdificio(data)
      setDetalheEdificioAberto(true)
    } catch (e: any) {
      addToast(e?.message || 'Erro ao carregar detalhes do edifício', 'erro')
    }
  }

  const abrirDetalheAtividade = async (atividadeId: number) => {
    try {
      const data = await api.get<AtividadeDetalhe>(`/atividades/${atividadeId}/detalhe`)
      setDetalheAtividade(data)
      setDetalheAtividadeAberto(true)
    } catch (e: any) {
      addToast(e?.message || 'Erro ao carregar detalhes da tarefa', 'erro')
    }
  }

  const excluirEdificio = async (hardDelete: boolean) => {
    if (!excluindo) return
    setProcessandoExclusao(true)
    try {
      await api.delete(`/edificios/${excluindo.id}?hard_delete=${hardDelete}`)
      if (selecionado?.id === excluindo.id) setSelecionado(null)
      setExcluindo(null)
      addToast(hardDelete ? 'Edifício excluído definitivamente' : 'Edifício encerrado', 'sucesso')
      await carregarEdificios()
    } catch (e: any) {
      addToast(e?.message || 'Erro ao excluir edifício', 'erro')
    } finally {
      setProcessandoExclusao(false)
    }
  }

  return (
    <>
      <PageHeader
        titulo="Edifícios"
        subtitulo="Gerencie projetos e acompanhe a árvore de atividades"
        acoes={
          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              background: 'var(--verde-principal)', border: 'none', color: '#fff',
              borderRadius: '4px', padding: '10px 24px',
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px',
              fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            + Novo Edifício
          </button>
        }
      />

      <div style={{ padding: '32px', display: 'grid', gridTemplateColumns: '280px 1fr', gap: '32px', alignItems: 'start' }}>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h2 style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px', fontWeight: 700,
            color: 'var(--cinza-600)', textTransform: 'uppercase', letterSpacing: '0.1em',
          }}>
            Projetos Ativos
          </h2>

          {carregando ? <p>Carregando...</p> : edificios.map(ed => (
            <button
              key={ed.id}
              onClick={() => selecionarEdificio(ed.id)}
              style={{
                padding: '14px 16px', textAlign: 'left',
                background: selecionado?.id === ed.id ? 'var(--verde-claro)' : 'var(--superficie-1)',
                border: '1px solid',
                borderColor: selecionado?.id === ed.id ? 'var(--verde-principal)' : 'var(--cinza-300)',
                borderRadius: '6px', cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--cinza-800)', fontSize: '14px' }}>
                {formatarNomeEdificio(ed)}
              </div>
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

        {/* Árvore de estrutura */}
        <div>
          {selecionado ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                background: 'var(--superficie-1)', border: '1px solid var(--cinza-300)',
                borderRadius: '8px', padding: '12px',
              }}>
                <input
                  type="text"
                  value={filtroEstrutura}
                  onChange={e => setFiltroEstrutura(e.target.value)}
                  placeholder="Filtrar por laje, tarefa ou status..."
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: '6px',
                    border: '1px solid var(--cinza-300)', fontSize: '14px',
                  }}
                />
                <button
                  onClick={() => setFiltroEstrutura('')}
                  style={{ border: '1px solid var(--cinza-300)', background: 'var(--cinza-50)', borderRadius: '6px', padding: '10px 12px', cursor: 'pointer' }}
                >
                  Limpar
                </button>
                <button
                  onClick={abrirDetalheEdificio}
                  style={{ border: '1px solid var(--cinza-400)', background: 'transparent', color: 'var(--cinza-700)', borderRadius: '6px', padding: '10px 12px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Detalhes
                </button>
                <button
                  onClick={() => setExcluindo(selecionado)}
                  style={{ border: '1px solid var(--erro)', background: 'transparent', color: 'var(--erro)', borderRadius: '6px', padding: '10px 12px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Excluir
                </button>
              </div>

              <ArvoreEstrutura
                edificio={selecionado}
                usuarioId={usuario?.usuario_id ?? null}
                modoAdmin={true}
                atividadeEmAndamentoId={null}
                onAcao={handleAcao}
                filtroTexto={filtroEstrutura}
                onDetalhe={abrirDetalheAtividade}
              />
            </div>
          ) : (
            <div style={{
              height: '300px', border: '2px dashed var(--cinza-300)', borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--texto-secundario)', fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '18px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
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

      <ModalDetalheEdificio
        isOpen={detalheEdificioAberto}
        onClose={() => { setDetalheEdificioAberto(false); setDetalheEdificio(null) }}
        detalhe={detalheEdificio}
      />

      <ModalDetalheAtividade
        isOpen={detalheAtividadeAberto}
        onClose={() => { setDetalheAtividadeAberto(false); setDetalheAtividade(null) }}
        detalhe={detalheAtividade}
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
        Escolha como deseja remover {formatarNomeEdificio(excluindo)}. Encerrar mantém histórico; excluir definitivo remove tudo.
      </Modal>
    </>
  )
}
