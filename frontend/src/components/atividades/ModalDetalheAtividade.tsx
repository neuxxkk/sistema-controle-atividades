'use client'

import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useUsuario } from '@/context/UsuarioContext'
import { useToast } from '@/context/ToastContext'
import { api } from '@/lib/api'
import { formatarData, formatarDuracao } from '@/lib/formatters'
import { LABEL_ACAO, formatarLaje, formatarNomeEdificio, formatarTipoElemento, nomeEtapa } from '@/lib/constants'
import type { AcaoAtividade, AtividadeDetalhe, Usuario } from '@/types'

type AcaoVinculo = '' | 'desvincular' | 'cancelar_vinculo' | 'vincular'

interface Props {
  isOpen: boolean
  onClose: () => void
  detalhe: AtividadeDetalhe | null
  onAtualizou?: () => Promise<void> | void
}

const linhaStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  padding: '8px 0',
  borderBottom: '1px solid var(--cinza-100)',
}

const labelStyle: React.CSSProperties = {
  color: 'var(--cinza-600)',
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 700,
}

const valueStyle: React.CSSProperties = {
  color: 'var(--cinza-800)',
  fontSize: '14px',
  textAlign: 'right',
  fontWeight: 500,
}

const tabButtonStyle = (ativo: boolean): React.CSSProperties => ({
  border: '1px solid var(--cinza-300)',
  background: ativo ? 'var(--verde-principal)' : 'var(--superficie-1)',
  color: ativo ? '#fff' : 'var(--cinza-700)',
  borderRadius: '6px',
  padding: '8px 12px',
  fontSize: '12px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  cursor: 'pointer',
})

export function ModalDetalheAtividade({ isOpen, onClose, detalhe, onAtualizou }: Props) {
  const { usuario } = useUsuario()
  const { addToast } = useToast()
  const [aba, setAba] = useState<'detalhes' | 'gerenciamento'>('detalhes')
  const [detalheLocal, setDetalheLocal] = useState<AtividadeDetalhe | null>(detalhe)
  const [carregandoGerenciamento, setCarregandoGerenciamento] = useState(false)
  const [acoesDisponiveis, setAcoesDisponiveis] = useState<AcaoAtividade[]>([])
  const [usuariosFuncionario, setUsuariosFuncionario] = useState<Usuario[]>([])
  const [usuariosAlvoGerenciamento, setUsuariosAlvoGerenciamento] = useState<Usuario[]>([])
  const [etapaSelecionada, setEtapaSelecionada] = useState(1)
  const [usuarioVinculoSelecionado, setUsuarioVinculoSelecionado] = useState<number | null>(null)
  const [usuarioAlvoGerenciamentoSelecionado, setUsuarioAlvoGerenciamentoSelecionado] = useState<number | null>(null)
  const [acaoBasicaSelecionada, setAcaoBasicaSelecionada] = useState<AcaoAtividade | ''>('')
  const [aplicarDefinirEtapa, setAplicarDefinirEtapa] = useState(false)
  const [acaoVinculoSelecionada, setAcaoVinculoSelecionada] = useState<AcaoVinculo>('')
  const [executandoAcao, setExecutandoAcao] = useState<string | null>(null)

  const atividade = detalheLocal?.atividade
  const isAdmin = usuario?.role === 'admin'

  useEffect(() => {
    setDetalheLocal(detalhe)
    if (detalhe?.atividade?.etapa_atual) {
      setEtapaSelecionada(detalhe.atividade.etapa_atual)
    }
    setAcaoBasicaSelecionada('')
    setAplicarDefinirEtapa(false)
    setAcaoVinculoSelecionada('')
    setAba('detalhes')
  }, [detalhe])

  const podeGerenciar = useMemo(() => {
    if (!usuario || !atividade) return false
    if (isAdmin) return true
    return atividade.usuario_responsavel_id === usuario.usuario_id
  }, [atividade, isAdmin, usuario])

  const recarregarDetalhe = async () => {
    if (!atividade) return
    const novo = await api.get<AtividadeDetalhe>(`/atividades/${atividade.id}/detalhe`)
    setDetalheLocal(novo)
    setEtapaSelecionada(novo.atividade.etapa_atual)
  }

  const carregarGerenciamento = async () => {
    if (!usuario || !atividade) return
    setCarregandoGerenciamento(true)
    try {
      const [acoes, usuarios] = await Promise.all([
        api.get<{ acoes: AcaoAtividade[] }>(`/atividades/${atividade.id}/acoes?usuario_id=${usuario.usuario_id}`),
        isAdmin ? api.get<Usuario[]>('/usuarios/') : Promise.resolve([] as Usuario[]),
      ])
      setAcoesDisponiveis(acoes.acoes)
      setAcaoBasicaSelecionada(acoes.acoes[0] ?? '')
      const funcionariosTodos = (usuarios || []).filter(u => u.role === 'funcionario')
      const funcionariosAtivos = funcionariosTodos.filter(u => u.ativo)
      setUsuariosAlvoGerenciamento(funcionariosTodos)
      setUsuariosFuncionario(funcionariosAtivos)

      const alvoPadrao = atividade.usuario_responsavel_id
        ?? funcionariosTodos[0]?.id
        ?? null
      setUsuarioAlvoGerenciamentoSelecionado(alvoPadrao)

      if (funcionariosAtivos.length > 0) {
        setUsuarioVinculoSelecionado(funcionariosAtivos[0].id)
      }
    } catch (e: any) {
      addToast(e?.message || 'Erro ao carregar opções de gerenciamento', 'erro')
    } finally {
      setCarregandoGerenciamento(false)
    }
  }

  useEffect(() => {
    if (!isOpen || aba !== 'gerenciamento') return
    carregarGerenciamento().catch(() => {})
  }, [aba, isOpen])

  const usuarioAlvoSelecionado = useMemo(
    () => usuariosAlvoGerenciamento.find(u => u.id === usuarioAlvoGerenciamentoSelecionado) ?? null,
    [usuariosAlvoGerenciamento, usuarioAlvoGerenciamentoSelecionado],
  )

  const usuarioAlvoEstaVinculado = atividade?.usuario_responsavel_id === usuarioAlvoGerenciamentoSelecionado
  const usuarioAlvoTemHistorico = useMemo(() => {
    if (!usuarioAlvoGerenciamentoSelecionado) return false
    return (detalheLocal?.tempo_por_usuario ?? []).some(t => t.usuario.id === usuarioAlvoGerenciamentoSelecionado)
  }, [detalheLocal?.tempo_por_usuario, usuarioAlvoGerenciamentoSelecionado])

  const opcoesAcaoVinculo = useMemo(() => {
    if (!atividade) return [] as Array<{ id: AcaoVinculo; label: string }>

    const opcoes: Array<{ id: AcaoVinculo; label: string }> = []

    if (atividade.status_ciclo === 'Pausada') {
      if (usuarioAlvoEstaVinculado) {
        opcoes.push({ id: 'desvincular', label: 'Desvincular mantendo histórico' })
      }
      if (usuarioAlvoTemHistorico || usuarioAlvoEstaVinculado) {
        opcoes.push({ id: 'cancelar_vinculo', label: 'Cancelar vínculo e remover registros' })
      }
    }

    const podeVincularStatus = ['Pendente', 'Pausada', 'Etapa concluida'].includes(atividade.status_ciclo)
    if (
      isAdmin
      && podeVincularStatus
      && !!usuarioAlvoSelecionado
      && usuarioAlvoSelecionado.ativo
      && !usuarioAlvoEstaVinculado
    ) {
      opcoes.push({ id: 'vincular', label: 'Vincular à atividade' })
    }

    return opcoes
  }, [atividade, isAdmin, usuarioAlvoSelecionado, usuarioAlvoEstaVinculado, usuarioAlvoTemHistorico])

  useEffect(() => {
    if (!opcoesAcaoVinculo.some(op => op.id === acaoVinculoSelecionada)) {
      setAcaoVinculoSelecionada(opcoesAcaoVinculo[0]?.id ?? '')
    }
  }, [opcoesAcaoVinculo, acaoVinculoSelecionada])

  const aplicarOperacao = async () => {
    if (!usuario || !atividade) return

    if (acaoVinculoSelecionada === 'cancelar_vinculo') {
      const alvoQuery = isAdmin && usuarioAlvoGerenciamentoSelecionado
        ? `&alvo_usuario_id=${usuarioAlvoGerenciamentoSelecionado}`
        : ''
      await executar('cancelar_vinculo', async () => {
        await api.post(`/atividades/${atividade.id}/gerenciamento/cancelar-vinculo?usuario_id=${usuario.usuario_id}${alvoQuery}`, {})
      })
      return
    }

    if (acaoVinculoSelecionada === 'desvincular') {
      const alvoQuery = isAdmin && usuarioAlvoGerenciamentoSelecionado
        ? `&alvo_usuario_id=${usuarioAlvoGerenciamentoSelecionado}`
        : ''
      await executar('desvincular', async () => {
        await api.post(`/atividades/${atividade.id}/gerenciamento/desvincular?usuario_id=${usuario.usuario_id}${alvoQuery}`, {})
      })
      return
    }

    if (acaoVinculoSelecionada === 'vincular') {
      if (!usuarioAlvoGerenciamentoSelecionado) {
        addToast('Selecione um funcionário para vínculo', 'erro')
        return
      }
      await executar('vincular', async () => {
        await api.post(`/atividades/${atividade.id}/gerenciamento/vincular?usuario_id=${usuario.usuario_id}&novo_usuario_id=${usuarioAlvoGerenciamentoSelecionado}`, {})
      })
      return
    }

    if (aplicarDefinirEtapa) {
      await executar('definir_etapa', async () => {
        await api.post(`/atividades/${atividade.id}/gerenciamento/definir-etapa?usuario_id=${usuario.usuario_id}&etapa_nova=${etapaSelecionada}`, {})
      })
      return
    }

    if (acaoBasicaSelecionada) {
      await executar(acaoBasicaSelecionada, async () => {
        await api.post(`/atividades/${atividade.id}/${acaoBasicaSelecionada.replace('_', '-')}?usuario_id=${usuario.usuario_id}`, {})
      })
      return
    }

    addToast('Selecione uma operação para aplicar', 'aviso')
  }

  const executar = async (chave: string, fn: () => Promise<void>) => {
    setExecutandoAcao(chave)
    try {
      await fn()
      await recarregarDetalhe()
      await carregarGerenciamento()
      await onAtualizou?.()
      addToast('Alteração aplicada com sucesso', 'sucesso')
    } catch (e: any) {
      addToast(e?.message || 'Erro ao executar ação', 'erro')
    } finally {
      setExecutandoAcao(null)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Detalhes da atividade"
    >
      {!atividade ? (
        <p>Carregando detalhes...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <button style={tabButtonStyle(aba === 'detalhes')} onClick={() => setAba('detalhes')}>Detalhes</button>
            {podeGerenciar && (
              <button style={tabButtonStyle(aba === 'gerenciamento')} onClick={() => setAba('gerenciamento')}>Gerenciamento</button>
            )}
          </div>

          {aba === 'detalhes' ? (
            <>
          <div style={linhaStyle}>
            <span style={labelStyle}>Elemento</span>
            <span style={valueStyle}>{formatarTipoElemento(atividade.tipo_elemento, atividade.subtipo)}</span>
          </div>

          <div style={linhaStyle}>
            <span style={labelStyle}>Edifício</span>
            <span style={valueStyle}>{formatarNomeEdificio(atividade.laje?.edificio, '—')}</span>
          </div>

          <div style={linhaStyle}>
            <span style={labelStyle}>Laje</span>
            <span style={valueStyle}>{atividade.laje ? formatarLaje(atividade.laje.tipo) : '—'}</span>
          </div>

          <div style={linhaStyle}>
            <span style={labelStyle}>Status atual</span>
            <span style={valueStyle}>{atividade.status_atual}</span>
          </div>

          <div style={linhaStyle}>
            <span style={labelStyle}>Criada em</span>
            <span style={valueStyle}>{formatarData(atividade.criado_em)}</span>
          </div>

          <div style={linhaStyle}>
            <span style={labelStyle}>Primeiro início</span>
            <span style={valueStyle}>{detalhe?.iniciada_em ? formatarData(detalhe.iniciada_em) : '—'}</span>
          </div>

          <div style={linhaStyle}>
            <span style={labelStyle}>
              {atividade.status_ciclo === 'Finalizada' ? 'Conclusão em' : 'Última pausa'}
            </span>
            <span style={valueStyle}>{detalhe?.finalizada_em ? formatarData(detalhe.finalizada_em) : '—'}</span>
          </div>

          <div style={linhaStyle}>
            <span style={labelStyle}>Em andamento desde</span>
            <span style={valueStyle}>{detalhe?.em_andamento_desde ? formatarData(detalhe.em_andamento_desde) : '—'}</span>
          </div>

          <div style={{ ...linhaStyle, borderBottom: 'none' }}>
            <span style={labelStyle}>Usuário vinculado</span>
            <span style={valueStyle}>{detalhe?.usuario_vinculado?.nome || 'Sem vínculo'}</span>
          </div>

          {/* Seção de Tempos */}
          {detalhe?.tempo_por_usuario && detalhe.tempo_por_usuario.length > 0 && (
            <div style={{ marginTop: '20px', borderTop: '2px solid var(--cinza-200)', paddingTop: '12px' }}>
              <h4 style={{ ...labelStyle, marginBottom: '8px', fontSize: '11px', color: 'var(--cinza-900)' }}>
                Tempo por funcionário
              </h4>
              {(() => {
                const total = detalhe.tempo_por_usuario.reduce((s, t) => s + t.tempo_segundos, 0)
                return detalhe.tempo_por_usuario.map((t, idx) => (
                  <div key={idx} style={{ ...linhaStyle, borderBottom: '1px dashed var(--cinza-100)', display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '12px', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: 'var(--cinza-700)' }}>{t.usuario.nome}</span>
                    <span style={{ fontSize: '11px', color: 'var(--cinza-500)', fontFamily: 'monospace' }}>
                      {total > 0 ? `${((t.tempo_segundos / total) * 100).toFixed(1)}%` : '—'}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--verde-principal)', fontFamily: 'monospace' }}>
                      {formatarDuracao(t.tempo_segundos)}
                    </span>
                  </div>
                ))
              })()}
            </div>
          )}
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {carregandoGerenciamento ? (
                <p>Carregando opções...</p>
              ) : (
                <>
                  <div style={{ ...linhaStyle, borderBottom: 'none', flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                    <span style={labelStyle}>Ação básica</span>
                    <select
                      value={acaoBasicaSelecionada}
                      onChange={(e) => setAcaoBasicaSelecionada(e.target.value as AcaoAtividade | '')}
                      style={{ border: '1px solid var(--cinza-300)', borderRadius: '6px', padding: '8px' }}
                    >
                      <option value="">Não aplicar</option>
                      {acoesDisponiveis.map(acao => (
                        <option key={acao} value={acao}>{LABEL_ACAO[acao]}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ ...linhaStyle, borderBottom: 'none', flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                    <span style={labelStyle}>Escolher etapa</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        id="aplicar-definir-etapa"
                        type="checkbox"
                        checked={aplicarDefinirEtapa}
                        onChange={(e) => setAplicarDefinirEtapa(e.target.checked)}
                      />
                      <label htmlFor="aplicar-definir-etapa" style={{ fontSize: '12px', color: 'var(--cinza-700)' }}>
                        Aplicar definição de etapa
                      </label>
                    </div>
                    <select
                      value={etapaSelecionada}
                      onChange={(e) => setEtapaSelecionada(Number(e.target.value))}
                      style={{ border: '1px solid var(--cinza-300)', borderRadius: '6px', padding: '8px' }}
                    >
                      {Array.from({ length: atividade.etapa_total }).map((_, idx) => {
                        const etapa = idx + 1
                        return (
                          <option key={etapa} value={etapa}>
                            {nomeEtapa(atividade.tipo_elemento, etapa, atividade.subtipo)} ({etapa}/{atividade.etapa_total})
                          </option>
                        )
                      })}
                    </select>
                  </div>

                  {(isAdmin || atividade.status_ciclo === 'Pausada') && (
                    <div style={{ ...linhaStyle, borderBottom: 'none', flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                      <span style={labelStyle}>Gerenciamento de vínculo</span>
                      {isAdmin ? (
                        <>
                          <select
                            value={usuarioAlvoGerenciamentoSelecionado ?? ''}
                            onChange={(e) => setUsuarioAlvoGerenciamentoSelecionado(Number(e.target.value))}
                            style={{ border: '1px solid var(--cinza-300)', borderRadius: '6px', padding: '8px' }}
                          >
                            {usuariosAlvoGerenciamento.map(u => (
                              <option key={u.id} value={u.id}>
                                {u.nome}{u.ativo ? '' : ' (inativo)'}
                              </option>
                            ))}
                          </select>

                          {opcoesAcaoVinculo.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {opcoesAcaoVinculo.map(op => (
                                <label key={op.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--cinza-700)' }}>
                                  <input
                                    type="radio"
                                    name="acao-vinculo-admin"
                                    checked={acaoVinculoSelecionada === op.id}
                                    onChange={() => setAcaoVinculoSelecionada(op.id)}
                                  />
                                  {op.label}
                                </label>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--cinza-500)' }}>
                              Nenhuma ação de vínculo disponível para o funcionário selecionado.
                            </span>
                          )}
                        </>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--cinza-700)' }}>
                            <input
                              type="radio"
                              name="acao-vinculo-func"
                              checked={acaoVinculoSelecionada === 'desvincular'}
                              onChange={() => setAcaoVinculoSelecionada('desvincular')}
                            />
                            Desvincular mantendo histórico
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--cinza-700)' }}>
                            <input
                              type="radio"
                              name="acao-vinculo-func"
                              checked={acaoVinculoSelecionada === 'cancelar_vinculo'}
                              onChange={() => setAcaoVinculoSelecionada('cancelar_vinculo')}
                            />
                            Cancelar vínculo e remover registros
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ ...linhaStyle, borderBottom: 'none', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => aplicarOperacao()}
                      disabled={
                        executandoAcao !== null
                        || (!acaoBasicaSelecionada
                          && !aplicarDefinirEtapa
                          && !acaoVinculoSelecionada)
                        || (!!acaoVinculoSelecionada && isAdmin && !usuarioAlvoGerenciamentoSelecionado)
                      }
                      style={{ border: '1px solid var(--cinza-300)', background: 'var(--superficie-1)', borderRadius: '6px', padding: '8px 12px', cursor: 'pointer', fontWeight: 700 }}
                    >
                      {executandoAcao ? 'Aplicando...' : 'Aplicar'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
