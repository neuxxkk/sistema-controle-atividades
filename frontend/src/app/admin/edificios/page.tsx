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
import { formatarLaje, formatarNomeEdificio } from '@/lib/constants'
import { ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
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
  const [modoEdicao, setModoEdicao] = useState(false)
  const [novoPavimentoTipo, setNovoPavimentoTipo] = useState('')
  const [editandoLajeId, setEditandoLajeId] = useState<number | null>(null)
  const [tipoEdicaoLaje, setTipoEdicaoLaje] = useState('')
  const [lajesSelecionadas, setLajesSelecionadas] = useState<number[]>([])
  const [dragLajeId, setDragLajeId] = useState<number | null>(null)
  const [dropInsertIndex, setDropInsertIndex] = useState<number | null>(null)

  const lajesOrdenadasEdicao = selecionado
    ? [...selecionado.lajes].sort((a, b) => a.ordem - b.ordem)
    : []

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

  const toggleSelecionada = (lajeId: number) => {
    setLajesSelecionadas(prev => prev.includes(lajeId) ? prev.filter(id => id !== lajeId) : [...prev, lajeId])
  }

  const selecionarTodasLajes = () => {
    if (!selecionado) return
    const ids = lajesOrdenadasEdicao.map(l => l.id)
    setLajesSelecionadas(prev => prev.length === ids.length ? [] : ids)
  }

  const adicionarPavimento = async () => {
    if (!selecionado || !novoPavimentoTipo.trim()) return
    try {
      await api.post(`/edificios/${selecionado.id}/lajes`, { tipo: novoPavimentoTipo.trim() })
      setNovoPavimentoTipo('')
      await selecionarEdificio(selecionado.id)
      await carregarEdificios()
      addToast('Pavimento criado com sucesso', 'sucesso')
    } catch (e: any) {
      addToast(e?.message || 'Erro ao criar pavimento', 'erro')
    }
  }

  const salvarEdicaoPavimento = async (lajeId: number) => {
    if (!selecionado || !tipoEdicaoLaje.trim()) return
    try {
      await api.put(`/edificios/${selecionado.id}/lajes/${lajeId}`, { tipo: tipoEdicaoLaje.trim() })
      setEditandoLajeId(null)
      setTipoEdicaoLaje('')
      await selecionarEdificio(selecionado.id)
      await carregarEdificios()
      addToast('Pavimento atualizado', 'sucesso')
    } catch (e: any) {
      addToast(e?.message || 'Erro ao editar pavimento', 'erro')
    }
  }

  const moverPavimento = async (lajeId: number, direcao: 'cima' | 'baixo') => {
    if (!selecionado) return
    try {
      await api.post(`/edificios/${selecionado.id}/lajes/${lajeId}/mover?direcao=${direcao}`, {})
      await selecionarEdificio(selecionado.id)
      await carregarEdificios()
    } catch (e: any) {
      addToast(e?.message || 'Erro ao mover pavimento', 'erro')
    }
  }

  const reordenarPavimento = async (lajeId: number, novaOrdem: number) => {
    if (!selecionado) return
    try {
      await api.put(`/edificios/${selecionado.id}/lajes/${lajeId}`, { ordem: novaOrdem })
      await selecionarEdificio(selecionado.id)
      await carregarEdificios()
    } catch (e: any) {
      addToast(e?.message || 'Erro ao reordenar pavimento', 'erro')
    }
  }

  const handleDropReordenacao = async (insertIndexRaw: number) => {
    if (!dragLajeId || !selecionado) return
    const ordemAtual = lajesOrdenadasEdicao.map(l => l.id)
    const origemIndex = ordemAtual.indexOf(dragLajeId)

    if (origemIndex < 0) {
      setDragLajeId(null)
      setDropInsertIndex(null)
      return
    }

    const semOrigem = ordemAtual.filter(id => id !== dragLajeId)
    const insertIndex = Math.max(0, Math.min(insertIndexRaw, semOrigem.length))
    const ordemFinal = [...semOrigem]
    ordemFinal.splice(insertIndex, 0, dragLajeId)

    if (ordemFinal.join(',') === ordemAtual.join(',')) {
      setDragLajeId(null)
      setDropInsertIndex(null)
      return
    }

    await reordenarPavimento(dragLajeId, insertIndex + 1)
    setDragLajeId(null)
    setDropInsertIndex(null)
  }

  const excluirPavimento = async (lajeId: number) => {
    if (!selecionado) return
    try {
      await api.delete(`/edificios/${selecionado.id}/lajes/${lajeId}`)
      setLajesSelecionadas(prev => prev.filter(id => id !== lajeId))
      await selecionarEdificio(selecionado.id)
      await carregarEdificios()
      addToast('Pavimento excluído', 'sucesso')
    } catch (e: any) {
      addToast(e?.message || 'Erro ao excluir pavimento', 'erro')
    }
  }

  const excluirSelecionados = async () => {
    if (!selecionado || lajesSelecionadas.length === 0) return
    try {
      await api.post(`/edificios/${selecionado.id}/lajes/delecao-lote`, { laje_ids: lajesSelecionadas })
      setLajesSelecionadas([])
      await selecionarEdificio(selecionado.id)
      await carregarEdificios()
      addToast('Pavimentos selecionados removidos', 'sucesso')
    } catch (e: any) {
      addToast(e?.message || 'Erro ao excluir pavimentos selecionados', 'erro')
    }
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
                  onClick={() => {
                    setModoEdicao(prev => !prev)
                    setEditandoLajeId(null)
                    setTipoEdicaoLaje('')
                    setLajesSelecionadas([])
                  }}
                  style={{ border: '1px solid var(--cinza-400)', background: modoEdicao ? 'var(--cinza-100)' : 'transparent', color: 'var(--cinza-700)', borderRadius: '6px', padding: '10px 12px', cursor: 'pointer', fontWeight: 600 }}
                >
                  {modoEdicao ? 'Sair da edição' : 'Modo de edição'}
                </button>
                <button
                  onClick={() => setExcluindo(selecionado)}
                  style={{ border: '1px solid var(--erro)', background: 'transparent', color: 'var(--erro)', borderRadius: '6px', padding: '10px 12px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Excluir
                </button>
              </div>

              {modoEdicao && (
                <div style={{
                  background: 'var(--superficie-1)', border: '1px solid var(--cinza-300)',
                  borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px',
                }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
                    <strong style={{ fontSize: '13px', color: 'var(--cinza-700)' }}>CRUD de pavimentos (inline)</strong>
                    <span style={{ fontSize: '12px', color: 'var(--cinza-500)' }}>
                      Arraste a linha para alterar o nível do pavimento
                    </span>
                    <button
                      onClick={excluirSelecionados}
                      disabled={lajesSelecionadas.length === 0}
                      style={{ border: '1px solid var(--erro)', background: 'transparent', color: 'var(--erro)', borderRadius: '6px', padding: '6px 10px', cursor: lajesSelecionadas.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: lajesSelecionadas.length === 0 ? 0.5 : 1 }}
                    >
                      Excluir selecionados
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      value={novoPavimentoTipo}
                      onChange={e => setNovoPavimentoTipo(e.target.value)}
                      placeholder="Nome do novo pavimento (ex: Laje_8 ou Cobertura)"
                      style={{ flex: 1, padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--cinza-300)' }}
                    />
                    <button
                      onClick={adicionarPavimento}
                      style={{ border: '1px solid var(--verde-principal)', background: 'var(--verde-principal)', color: '#fff', borderRadius: '6px', padding: '8px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Plus size={14} /> Adicionar
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '40px 60px 1fr 220px', gap: '8px', alignItems: 'center', fontSize: '12px', color: 'var(--cinza-600)', fontWeight: 700 }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selecionado.lajes.length > 0 && lajesSelecionadas.length === selecionado.lajes.length}
                        onChange={selecionarTodasLajes}
                      />
                    </label>
                    <span>Ordem</span>
                    <span>Pavimento</span>
                    <span>Ações</span>
                  </div>

                  <div
                    onDragOver={(e) => {
                      if (dragLajeId === null) return
                      e.preventDefault()
                      setDropInsertIndex(0)
                    }}
                    onDrop={(e) => {
                      if (dragLajeId === null) return
                      e.preventDefault()
                      handleDropReordenacao(0).catch(() => {})
                    }}
                    style={{
                      height: '8px',
                      borderTop: dropInsertIndex === 0 && dragLajeId !== null
                        ? '2px solid var(--verde-principal)'
                        : '2px solid transparent',
                    }}
                  />

                  {lajesOrdenadasEdicao.map((laje, idx) => (
                    <div key={`row-${laje.id}`} style={{ display: 'contents' }}>
                    <div
                      key={laje.id}
                      draggable={editandoLajeId !== laje.id}
                      onDragStart={() => {
                        setDragLajeId(laje.id)
                        setDropInsertIndex(idx)
                      }}
                      onDragOver={(e) => {
                        if (dragLajeId === null) return
                        e.preventDefault()
                        const rect = e.currentTarget.getBoundingClientRect()
                        const meio = rect.top + rect.height / 2
                        const insertIndex = e.clientY < meio ? idx : idx + 1
                        setDropInsertIndex(insertIndex)
                      }}
                      onDrop={(e) => {
                        if (dragLajeId === null) return
                        e.preventDefault()
                        const rect = e.currentTarget.getBoundingClientRect()
                        const meio = rect.top + rect.height / 2
                        const insertIndex = e.clientY < meio ? idx : idx + 1
                        handleDropReordenacao(insertIndex).catch(() => {})
                      }}
                      onDragEnd={() => {
                        setDragLajeId(null)
                        setDropInsertIndex(null)
                      }}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '40px 60px 1fr 220px',
                        gap: '8px',
                        alignItems: 'center',
                        borderRadius: '6px',
                        padding: '2px 0',
                        opacity: dragLajeId === laje.id ? 0.55 : 1,
                      }}
                    >
                      <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <input type="checkbox" checked={lajesSelecionadas.includes(laje.id)} onChange={() => toggleSelecionada(laje.id)} />
                      </label>
                      <span style={{ fontSize: '12px', color: 'var(--cinza-600)' }}>{laje.ordem}</span>
                      {editandoLajeId === laje.id ? (
                        <input
                          value={tipoEdicaoLaje}
                          onChange={e => setTipoEdicaoLaje(e.target.value)}
                          style={{ padding: '7px 9px', borderRadius: '6px', border: '1px solid var(--cinza-300)' }}
                        />
                      ) : (
                        <span style={{ fontSize: '13px', color: 'var(--cinza-800)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <GripVertical size={14} color="var(--cinza-500)" />
                          {formatarLaje(laje.tipo)}
                        </span>
                      )}
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button onClick={() => moverPavimento(laje.id, 'cima')} disabled={idx === 0} style={{ border: '1px solid var(--cinza-300)', background: 'var(--cinza-50)', borderRadius: '6px', padding: '5px 6px', cursor: idx === 0 ? 'not-allowed' : 'pointer' }}><ArrowUp size={14} /></button>
                        <button onClick={() => moverPavimento(laje.id, 'baixo')} disabled={idx === lajesOrdenadasEdicao.length - 1} style={{ border: '1px solid var(--cinza-300)', background: 'var(--cinza-50)', borderRadius: '6px', padding: '5px 6px', cursor: idx === lajesOrdenadasEdicao.length - 1 ? 'not-allowed' : 'pointer' }}><ArrowDown size={14} /></button>
                        {editandoLajeId === laje.id ? (
                          <>
                            <button onClick={() => salvarEdicaoPavimento(laje.id)} style={{ border: '1px solid var(--verde-principal)', background: 'transparent', color: 'var(--verde-principal)', borderRadius: '6px', padding: '5px 6px', cursor: 'pointer' }}><Save size={14} /></button>
                            <button onClick={() => { setEditandoLajeId(null); setTipoEdicaoLaje('') }} style={{ border: '1px solid var(--cinza-300)', background: 'transparent', color: 'var(--cinza-600)', borderRadius: '6px', padding: '5px 6px', cursor: 'pointer' }}><X size={14} /></button>
                          </>
                        ) : (
                          <button onClick={() => { setEditandoLajeId(laje.id); setTipoEdicaoLaje(laje.tipo) }} style={{ border: '1px solid var(--cinza-300)', background: 'transparent', color: 'var(--cinza-700)', borderRadius: '6px', padding: '5px 6px', cursor: 'pointer' }}><Pencil size={14} /></button>
                        )}
                        <button onClick={() => excluirPavimento(laje.id)} style={{ border: '1px solid var(--erro)', background: 'transparent', color: 'var(--erro)', borderRadius: '6px', padding: '5px 6px', cursor: 'pointer' }}><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <div
                      onDragOver={(e) => {
                        if (dragLajeId === null) return
                        e.preventDefault()
                        setDropInsertIndex(idx + 1)
                      }}
                      onDrop={(e) => {
                        if (dragLajeId === null) return
                        e.preventDefault()
                        handleDropReordenacao(idx + 1).catch(() => {})
                      }}
                      style={{
                        height: '8px',
                        borderTop: dropInsertIndex === idx + 1 && dragLajeId !== null
                          ? '2px solid var(--verde-principal)'
                          : '2px solid transparent',
                      }}
                    />
                    </div>
                  ))}
                </div>
              )}

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
        onAtualizou={recarregarSelecionado}
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
