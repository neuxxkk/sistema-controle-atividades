'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUsuario } from '@/context/UsuarioContext'
import { api } from '@/lib/api'
import { CardSelecao } from '@/components/usuario/CardSelecao'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import type { Usuario, UsuarioLocal } from '@/types'

export default function SelecaoUsuario() {
  const router = useRouter()
  const { usuario, salvarUsuario, carregando: loadingUsuario } = useUsuario()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [selecionado, setSelecionado] = useState<Usuario | null>(null)

  useEffect(() => {
    if (!loadingUsuario && usuario) {
      router.push(usuario.role === 'admin' ? '/admin' : '/dashboard')
    }
  }, [usuario, loadingUsuario, router])

  useEffect(() => {
    async function carregar() {
      try {
        const data = await api.get<Usuario[]>('/usuarios/')
        setUsuarios(data.filter(u => u.ativo))
      } catch (e) {
        console.error('Falha ao carregar usuários', e)
      } finally {
        setCarregando(false)
      }
    }
    carregar()
  }, [])

  const handleConfirmar = () => {
    if (selecionado) {
      const uLocal: UsuarioLocal = {
        usuario_id: selecionado.id,
        nome: selecionado.nome,
        role: selecionado.role
      }
      salvarUsuario(uLocal)
    }
  }

  if (loadingUsuario || carregando) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--cinza-100)', color: 'var(--cinza-600)',
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: '20px', letterSpacing: '0.1em',
        textTransform: 'uppercase'
      }}>
        Carregando...
      </div>
    )
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at 10% 10%, #ffffff 0%, #f3f1e9 35%, #ebe8dd 100%)',
      padding: '48px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <section style={{
        width: '100%',
        maxWidth: '980px',
        background: 'rgba(255,255,255,0.85)',
        border: '1px solid #dfddd4',
        borderRadius: '24px',
        padding: '28px',
        boxShadow: '0 18px 40px rgba(30,30,28,0.08)',
        backdropFilter: 'blur(3px)'
      }}>
        <div style={{ marginBottom: '36px', textAlign: 'center' }}>
          <h1 style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: '40px', fontWeight: 700,
            color: 'var(--cinza-800)', letterSpacing: '0.03em', marginBottom: '6px'
          }}>
            <span style={{ color: 'var(--verde-principal)' }}>FÓRMULA</span> ENGENHARIA
          </h1>
          <p style={{ color: 'var(--cinza-600)', fontWeight: 500 }}>Sistema de Controle de Atividades</p>
        </div>

        <h2 style={{
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: '26px', fontWeight: 600,
          color: 'var(--cinza-800)', marginBottom: '26px', textAlign: 'center',
          textTransform: 'uppercase', letterSpacing: '0.04em'
        }}>
          Selecione seu perfil para iniciar
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          width: '100%'
        }}>
          {usuarios.map(u => (
            <CardSelecao
              key={u.id}
              nome={u.nome}
              onClick={() => setSelecionado(u)}
            />
          ))}
        </div>

        {!carregando && usuarios.length === 0 && (
          <p style={{ color: 'var(--cinza-600)', marginTop: '28px', textAlign: 'center' }}>
            Nenhum funcionário ativo encontrado no sistema.
          </p>
        )}
      </section>

      <div style={{
        position: 'fixed',
        zIndex: -1,
        inset: 0,
        background: 'radial-gradient(circle at 80% 10%, rgba(90,138,74,0.14), transparent 40%), radial-gradient(circle at 20% 90%, rgba(60,80,33,0.08), transparent 35%)'
      }} />

      <Modal
        isOpen={!!selecionado}
        onClose={() => setSelecionado(null)}
        title={`Você é ${selecionado?.nome}?`}
        footer={
          <>
            <Button 
              variant="secondary" 
              onClick={() => setSelecionado(null)}
            >
              Não sou eu
            </Button>
            <Button 
              variant="primary" 
              onClick={handleConfirmar}
            >
              Sim, sou eu →
            </Button>
          </>
        }
      >
        Ao confirmar, você terá acesso às suas atividades neste dispositivo e poderá registrar suas sessões de trabalho.
      </Modal>
    </main>
  )
}
