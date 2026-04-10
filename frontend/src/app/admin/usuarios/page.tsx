'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useUsuario } from '@/context/UsuarioContext'
import { useToast } from '@/context/ToastContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { ModalNovoUsuario } from '@/components/admin/ModalNovoUsuario'
import { Button } from '@/components/ui/Button'
import { Plus, Pencil, Trash2, Users, ShieldCheck } from 'lucide-react'
import type { Usuario } from '@/types'

export default function UsuariosAdminPage() {
  const { usuario } = useUsuario()
  const { addToast } = useToast()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [usuarioEdicao, setUsuarioEdicao] = useState<Usuario | null>(null)
  const [excluindoId, setExcluindoId] = useState<number | null>(null)

  const carregar = async () => {
    try {
      const data = await api.get<Usuario[]>('/usuarios/')
      setUsuarios(data)
    } catch (e) {
      console.error('Erro ao carregar usuários')
      addToast('Erro ao carregar usuários', 'erro')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

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
              <th style={{ padding: 'var(--tabela-padding)', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', fontSize: '12px', color: 'var(--texto-secundario)' }}>Status</th>
              <th style={{ padding: 'var(--tabela-padding)', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', fontSize: '12px', color: 'var(--texto-secundario)' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center' }}>Carregando usuários...</td></tr>
            ) : usuarios.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--texto-secundario)' }}>Nenhum usuário cadastrado.</td></tr>
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
    </>
  )
}
