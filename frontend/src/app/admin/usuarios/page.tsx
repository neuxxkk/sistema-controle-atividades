'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useUsuario } from '@/context/UsuarioContext'
import { useToast } from '@/context/ToastContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { ModalNovoUsuario } from '@/components/admin/ModalNovoUsuario'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { formatarData } from '@/lib/formatters'
import { Plus, Pencil, Trash2, Users, ShieldCheck } from 'lucide-react'
import type { AlterarVinculoMaquinaRequest, Usuario, VinculoMaquina, VinculoMaquinaHistorico } from '@/types'

type UsuarioComVinculoResponse = {
  usuario: Usuario
  vinculo_maquina: VinculoMaquina | null
}

export default function UsuariosAdminPage() {
  const { usuario } = useUsuario()
  const { addToast } = useToast()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [usuarioEdicao, setUsuarioEdicao] = useState<Usuario | null>(null)
  const [excluindoId, setExcluindoId] = useState<number | null>(null)
  const [vinculosPorUsuario, setVinculosPorUsuario] = useState<Record<number, VinculoMaquina | null>>({})
  const [ultimoHistoricoPorUsuario, setUltimoHistoricoPorUsuario] = useState<Record<number, VinculoMaquinaHistorico | null>>({})
  const [usuarioVinculoEdicao, setUsuarioVinculoEdicao] = useState<Usuario | null>(null)
  const [salvandoVinculo, setSalvandoVinculo] = useState(false)
  const [formVinculo, setFormVinculo] = useState({
    nome_dispositivo: '',
    ip: '',
    windows_username: '',
  })

  const carregarVinculos = async (lista: Usuario[]) => {
    if (!usuario?.usuario_id) return
    const respostasVinculo = await Promise.allSettled(
      lista.map(async (u) => {
        const data = await api.get<UsuarioComVinculoResponse>(
          `/usuarios/${u.id}/vinculo-maquina?solicitante_id=${usuario.usuario_id}`
        )
        return { usuario_id: u.id, vinculo: data.vinculo_maquina }
      })
    )


    const respostasHistorico = await Promise.allSettled(
      lista.map(async (u) => {
        const data = await api.get<VinculoMaquinaHistorico[]>(
          `/usuarios/${u.id}/vinculo-maquina/historico?solicitante_id=${usuario.usuario_id}`
        )
        return { usuario_id: u.id, historico: data[0] ?? null }
      })
    )

    const map: Record<number, VinculoMaquina | null> = {}
    for (const r of respostasVinculo) {
      if (r.status === 'fulfilled') {
        map[r.value.usuario_id] = r.value.vinculo
      }
    }
    const mapHistorico: Record<number, VinculoMaquinaHistorico | null> = {}
    for (const r of respostasHistorico) {
      if (r.status === 'fulfilled') {
        mapHistorico[r.value.usuario_id] = r.value.historico
      }
    }

    setVinculosPorUsuario(map)
    setUltimoHistoricoPorUsuario(mapHistorico)
  }

  const labelAcaoHistorico = (acao: string) => {
    if (acao === 'primeiro_acesso') return 'Primeiro acesso'
    if (acao === 'alteracao_admin') return 'Alteração admin'
    if (acao === 'atualizacao_ip_confirmada') return 'Atualização de IP'
    return acao
  }

  const carregar = async () => {
    try {
      const data = await api.get<Usuario[]>('/usuarios/')
      setUsuarios(data)
      await carregarVinculos(data)
    } catch (e) {
      console.error('Erro ao carregar usuários')
      addToast('Erro ao carregar usuários', 'erro')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [usuario?.usuario_id])

  const abrirCriacao = () => {
    setUsuarioEdicao(null)
    setIsModalOpen(true)
  }

  const abrirEdicao = (usuario: Usuario) => {
    setUsuarioEdicao(usuario)
    setIsModalOpen(true)
  }

  const fecharModal = () => {
    setIsModalOpen(false)
    setUsuarioEdicao(null)
  }

  const handleExcluir = async (usuarioSelecionado: Usuario) => {
    if (usuarioSelecionado.id === usuario?.usuario_id) {
      addToast('Não é permitido deletar seu próprio usuário logado', 'aviso')
      return
    }

    const confirmou = confirm(`Deseja realmente deletar o usuário \"${usuarioSelecionado.nome}\"?`)
    if (!confirmou) return

    setExcluindoId(usuarioSelecionado.id)
    try {
      await api.delete(`/usuarios/${usuarioSelecionado.id}`)
      await carregar()
      addToast('Usuário deletado com sucesso', 'sucesso')
    } catch (e: any) {
      addToast(e?.message || 'Erro ao deletar usuário', 'erro')
    } finally {
      setExcluindoId(null)
    }
  }

  const abrirEdicaoVinculo = (u: Usuario) => {
    const vinculo = vinculosPorUsuario[u.id]
    setUsuarioVinculoEdicao(u)
    setFormVinculo({
      nome_dispositivo: vinculo?.nome_dispositivo || '',
      ip: vinculo?.ip || '',
      windows_username: vinculo?.windows_username || '',
    })
  }

  const salvarVinculo = async () => {
    if (!usuarioVinculoEdicao || !usuario?.usuario_id) return
    const payload: AlterarVinculoMaquinaRequest = {
      admin_id: usuario.usuario_id,
      nome_dispositivo: formVinculo.nome_dispositivo,
      ip: formVinculo.ip,
      windows_username: formVinculo.windows_username,
    }
    setSalvandoVinculo(true)
    try {
      const data = await api.put<UsuarioComVinculoResponse>(`/usuarios/${usuarioVinculoEdicao.id}/vinculo-maquina`, payload)
      setVinculosPorUsuario(prev => ({ ...prev, [usuarioVinculoEdicao.id]: data.vinculo_maquina }))
      await carregarVinculos(usuarios)
      setUsuarioVinculoEdicao(null)
      addToast('Vínculo de máquina atualizado', 'sucesso')
    } catch (e: any) {
      addToast(e?.message || 'Erro ao atualizar vínculo', 'erro')
    } finally {
      setSalvandoVinculo(false)
    }
  }

  return (
    <>
      <PageHeader 
        titulo="Usuários" 
        subtitulo="Gerencie os funcionários e permissões do sistema"
        acoes={
          <Button onClick={abrirCriacao} icon={<Plus size={16} />}>
            Novo Usuário
          </Button>
        }
      />

      <div style={{ padding: 'var(--espaco-pagina)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <div style={{ background: 'var(--superficie-1)', border: '1px solid var(--borda-padrao)', borderRadius: 'var(--raio-card)', padding: 'var(--espaco-card)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--texto-secundario)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>
                Total de usuários
              </div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--texto-principal)' }}>{usuarios.length}</div>
            </div>
            <Users size={18} color="var(--verde-principal)" />
          </div>
          <div style={{ background: 'var(--superficie-1)', border: '1px solid var(--borda-padrao)', borderRadius: 'var(--raio-card)', padding: 'var(--espaco-card)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--texto-secundario)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>
                Ativos
              </div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--texto-principal)' }}>{usuarios.filter(u => u.ativo).length}</div>
            </div>
            <ShieldCheck size={18} color="var(--sucesso)" />
          </div>
        </div>

        <table style={{ 
          width: '100%', borderCollapse: 'collapse', background: 'var(--superficie-1)', 
          borderRadius: 'var(--raio-card)', overflow: 'hidden', border: '1px solid var(--borda-padrao)' 
        }}>
          <thead>
            <tr style={{ background: 'var(--superficie-2)', textAlign: 'left', borderBottom: '1px solid var(--borda-padrao)' }}>
              <th style={{ padding: 'var(--tabela-padding)', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', fontSize: '12px', color: 'var(--texto-secundario)' }}>ID</th>
              <th style={{ padding: 'var(--tabela-padding)', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', fontSize: '12px', color: 'var(--texto-secundario)' }}>Nome</th>
              <th style={{ padding: 'var(--tabela-padding)', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', fontSize: '12px', color: 'var(--texto-secundario)' }}>Role</th>
              <th style={{ padding: 'var(--tabela-padding)', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', fontSize: '12px', color: 'var(--texto-secundario)' }}>Dispositivo</th>
              <th style={{ padding: 'var(--tabela-padding)', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', fontSize: '12px', color: 'var(--texto-secundario)' }}>IP</th>
              <th style={{ padding: 'var(--tabela-padding)', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', fontSize: '12px', color: 'var(--texto-secundario)' }}>Windows User</th>
              <th style={{ padding: 'var(--tabela-padding)', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', fontSize: '12px', color: 'var(--texto-secundario)' }}>Última alteração</th>
              <th style={{ padding: 'var(--tabela-padding)', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', fontSize: '12px', color: 'var(--texto-secundario)' }}>Status</th>
              <th style={{ padding: 'var(--tabela-padding)', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', fontSize: '12px', color: 'var(--texto-secundario)' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr><td colSpan={9} style={{ padding: '32px', textAlign: 'center' }}>Carregando usuários...</td></tr>
            ) : usuarios.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: 'var(--texto-secundario)' }}>Nenhum usuário cadastrado.</td></tr>
            ) : usuarios.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--cinza-100)', transition: 'background 160ms ease' }}>
                <td style={{ padding: 'var(--tabela-padding)', color: 'var(--texto-secundario)' }}>#{u.id}</td>
                <td style={{ padding: 'var(--tabela-padding)', fontWeight: 600 }}>{u.nome}</td>
                <td style={{ padding: 'var(--tabela-padding)' }}>
                  <span style={{ 
                    fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', 
                    padding: '2px 6px', borderRadius: '4px', background: 'var(--superficie-2)' 
                  }}>
                    {u.role}
                  </span>
                </td>
                <td style={{ padding: 'var(--tabela-padding)', color: 'var(--texto-secundario)' }}>
                  {vinculosPorUsuario[u.id]?.nome_dispositivo || '—'}
                </td>
                <td style={{ padding: 'var(--tabela-padding)', color: 'var(--texto-secundario)' }}>
                  {vinculosPorUsuario[u.id]?.ip || '—'}
                </td>
                <td style={{ padding: 'var(--tabela-padding)', color: 'var(--texto-secundario)' }}>
                  {vinculosPorUsuario[u.id]?.windows_username || '—'}
                </td>
                <td style={{ padding: 'var(--tabela-padding)', color: 'var(--texto-secundario)' }}>
                  {ultimoHistoricoPorUsuario[u.id] ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span>{labelAcaoHistorico(ultimoHistoricoPorUsuario[u.id]!.acao)}</span>
                      <span style={{ fontSize: '11px', color: 'var(--cinza-500)' }}>
                        {formatarData(ultimoHistoricoPorUsuario[u.id]!.criado_em)}
                      </span>
                    </div>
                  ) : '—'}
                </td>
                <td style={{ padding: 'var(--tabela-padding)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ 
                      width: '8px', height: '8px', borderRadius: '50%', 
                      background: u.ativo ? 'var(--sucesso)' : 'var(--erro)' 
                    }} />
                    {u.ativo ? 'Ativo' : 'Inativo'}
                  </div>
                </td>
                <td style={{ padding: 'var(--tabela-padding)' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button variant="ghost" style={{ fontSize: '13px' }} onClick={() => abrirEdicao(u)} icon={<Pencil size={14} />}>
                      Editar
                    </Button>
                    <Button variant="secondary" style={{ fontSize: '13px' }} onClick={() => abrirEdicaoVinculo(u)}>
                      Vincular máquina
                    </Button>
                    <Button
                      variant="danger"
                      style={{ fontSize: '13px', padding: '8px 12px' }}
                      icon={<Trash2 size={14} />}
                      onClick={() => handleExcluir(u)}
                      disabled={excluindoId === u.id || usuario?.usuario_id === u.id}
                      isLoading={excluindoId === u.id}
                    >
                      Deletar
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ModalNovoUsuario
        isOpen={isModalOpen}
        onClose={fecharModal}
        onSuccess={carregar}
        usuarioEdicao={usuarioEdicao}
      />

      <Modal
        isOpen={!!usuarioVinculoEdicao}
        onClose={() => setUsuarioVinculoEdicao(null)}
        title={`Vínculo de máquina - ${usuarioVinculoEdicao?.nome || ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setUsuarioVinculoEdicao(null)} disabled={salvandoVinculo}>
              Cancelar
            </Button>
            <Button onClick={salvarVinculo} isLoading={salvandoVinculo}>
              Salvar vínculo
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            placeholder="Nome do dispositivo"
            value={formVinculo.nome_dispositivo}
            onChange={e => setFormVinculo(prev => ({ ...prev, nome_dispositivo: e.target.value }))}
            style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--borda-padrao)' }}
          />
          <input
            placeholder="IP"
            value={formVinculo.ip}
            onChange={e => setFormVinculo(prev => ({ ...prev, ip: e.target.value }))}
            style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--borda-padrao)' }}
          />
          <input
            placeholder="Windows username"
            value={formVinculo.windows_username}
            onChange={e => setFormVinculo(prev => ({ ...prev, windows_username: e.target.value }))}
            style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--borda-padrao)' }}
          />
        </div>
      </Modal>
    </>
  )
}
