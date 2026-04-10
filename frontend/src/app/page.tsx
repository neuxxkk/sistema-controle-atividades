'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUsuario } from '@/context/UsuarioContext'
import { useToast } from '@/context/ToastContext'
import { api } from '@/lib/api'
import { CardSelecao } from '@/components/usuario/CardSelecao'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import type { PrimeiroAcessoRequest, PrimeiroAcessoResponse, Usuario, UsuarioLocal } from '@/types'

export default function SelecaoUsuario() {
  const router = useRouter()
  const { addToast } = useToast()
  const { usuario, salvarUsuario, carregando: loadingUsuario } = useUsuario()
  const [admins, setAdmins] = useState<Usuario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [selecionado, setSelecionado] = useState<Usuario | null>(null)
  const [salvandoPrimeiroAcesso, setSalvandoPrimeiroAcesso] = useState(false)
  const [detectandoAmbiente, setDetectandoAmbiente] = useState(false)
  const [diagnostico, setDiagnostico] = useState({
    ipAuto: false,
    dispositivoSugerido: false,
    usernameCache: false,
  })
  const [form, setForm] = useState<PrimeiroAcessoRequest>({
    nome_completo: '',
    nome_dispositivo: '',
    ip: '',
    windows_username: '',
    confirmar_maquina_anterior: false,
  })

  const detectarAmbiente = async () => {
    setDetectandoAmbiente(true)
    try {
      const ambiente = await api.get<{ ip: string; user_agent: string }>('/usuarios/ambiente-atual')
      const plataforma = (navigator as any).userAgentData?.platform || navigator.platform || 'Dispositivo local'
      const usernameSalvo = localStorage.getItem('formula_windows_username') || ''
      const dispositivoSalvo = localStorage.getItem('formula_nome_dispositivo') || ''

      setDiagnostico({
        ipAuto: !!ambiente.ip,
        dispositivoSugerido: !!(dispositivoSalvo || plataforma),
        usernameCache: !!usernameSalvo,
      })

      setForm(prev => ({
        ...prev,
        ip: ambiente.ip || prev.ip,
        nome_dispositivo: prev.nome_dispositivo || dispositivoSalvo || String(plataforma),
        windows_username: prev.windows_username || usernameSalvo,
      }))
    } catch {
      addToast('Não foi possível detectar automaticamente os dados da máquina', 'aviso')
    } finally {
      setDetectandoAmbiente(false)
    }
  }

  useEffect(() => {
    if (!loadingUsuario && usuario) {
      router.push(usuario.role === 'admin' ? '/admin' : '/dashboard')
    }
  }, [usuario, loadingUsuario, router])

  useEffect(() => {
    async function carregar() {
      try {
        const data = await api.get<Usuario[]>('/usuarios/')
        const ativos = data.filter(u => u.ativo)
        setAdmins(ativos.filter(u => u.role === 'admin'))
      } catch (e) {
        console.error('Falha ao carregar usuários', e)
      } finally {
        setCarregando(false)
      }
    }
    carregar()
  }, [])

  useEffect(() => {
    if (!loadingUsuario) {
      detectarAmbiente()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingUsuario])

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

  const handlePrimeiroAcesso = async (e: React.FormEvent) => {
    e.preventDefault()
    setSalvandoPrimeiroAcesso(true)
    try {
      const data = await api.post<PrimeiroAcessoResponse>('/usuarios/primeiro-acesso', form)
      localStorage.setItem('formula_windows_username', form.windows_username)
      localStorage.setItem('formula_nome_dispositivo', form.nome_dispositivo)
      const uLocal: UsuarioLocal = {
        usuario_id: data.usuario.id,
        nome: data.usuario.nome,
        role: data.usuario.role,
      }
      salvarUsuario(uLocal)
      addToast(data.primeiro_acesso ? 'Primeiro acesso registrado com sucesso' : 'Login realizado com sucesso', 'sucesso')
    } catch (err: any) {
      addToast(err?.message || 'Erro no primeiro acesso', 'erro')
    } finally {
      setSalvandoPrimeiroAcesso(false)
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
      background: 'var(--selecao-bg-gradient)',
      padding: '48px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <section style={{
        width: '100%',
        maxWidth: '980px',
        background: 'var(--selecao-card-bg)',
        border: '1px solid var(--selecao-card-border)',
        borderRadius: '24px',
        padding: '28px',
        boxShadow: 'var(--selecao-card-shadow)',
        backdropFilter: 'blur(3px)'
      }}>
        <div style={{ marginBottom: '36px', textAlign: 'center' }}>
          <h1 style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: '40px', fontWeight: 700,
            color: 'var(--cinza-800)', letterSpacing: '0.03em', marginBottom: '6px'
          }}>
            <span style={{ color: 'var(--verde-principal)', display: 'flex', justifyContent: 'center' }}>
              <img 
              src="/banner.png" 
              alt="Fórmula Engenharia"
              style={{ width: '50%', height: 'auto' }}
              onError={(e) => {
              e.currentTarget.style.display = 'none'
              if (e.currentTarget.parentElement) {
                const fallback = e.currentTarget.parentElement.querySelector('.logo-fallback') as HTMLElement
                if (fallback) fallback.style.display = 'block'
              }
              }}
              />
            </span>
            <span className="logo-fallback" style={{ display: 'none' }}>Fórmula Engenharia</span>

          </h1>
          <p style={{ color: 'var(--cinza-600)', fontWeight: 500 }}>Sistema de Controle de Atividades</p>
        </div>

        <h2 style={{
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: '26px', fontWeight: 600,
          color: 'var(--cinza-800)', marginBottom: '26px', textAlign: 'center',
          textTransform: 'uppercase', letterSpacing: '0.04em'
        }}>
          Primeiro acesso do funcionário
        </h2>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
          <Button variant="secondary" onClick={detectarAmbiente} isLoading={detectandoAmbiente}>
            Detectar dados da máquina
          </Button>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <span style={{
            fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
            padding: '3px 8px', borderRadius: '999px',
            background: diagnostico.ipAuto ? 'var(--verde-claro)' : 'var(--cinza-100)',
            color: diagnostico.ipAuto ? 'var(--verde-texto)' : 'var(--cinza-600)',
          }}>
            IP: {diagnostico.ipAuto ? 'auto' : 'manual'}
          </span>
          <span style={{
            fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
            padding: '3px 8px', borderRadius: '999px',
            background: diagnostico.dispositivoSugerido ? 'var(--verde-claro)' : 'var(--cinza-100)',
            color: diagnostico.dispositivoSugerido ? 'var(--verde-texto)' : 'var(--cinza-600)',
          }}>
            Dispositivo: {diagnostico.dispositivoSugerido ? 'sugerido' : 'manual'}
          </span>
          <span style={{
            fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
            padding: '3px 8px', borderRadius: '999px',
            background: diagnostico.usernameCache ? 'var(--verde-claro)' : 'var(--cinza-100)',
            color: diagnostico.usernameCache ? 'var(--verde-texto)' : 'var(--cinza-600)',
          }}>
            Windows User: {diagnostico.usernameCache ? 'cache local' : 'manual'}
          </span>
        </div>

        <form onSubmit={handlePrimeiroAcesso} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <input
            required
            placeholder="Nome completo"
            value={form.nome_completo}
            onChange={e => setForm(prev => ({ ...prev, nome_completo: e.target.value }))}
            style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--borda-padrao)', gridColumn: '1 / -1' }}
          />
          <input
            required
            placeholder="Nome do dispositivo"
            value={form.nome_dispositivo}
            onChange={e => setForm(prev => ({ ...prev, nome_dispositivo: e.target.value }))}
            style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--borda-padrao)' }}
          />
          <input
            required
            placeholder="IP da máquina"
            value={form.ip}
            onChange={e => setForm(prev => ({ ...prev, ip: e.target.value }))}
            style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--borda-padrao)' }}
          />
          <input
            required
            placeholder="Windows username"
            value={form.windows_username}
            onChange={e => setForm(prev => ({ ...prev, windows_username: e.target.value }))}
            style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--borda-padrao)', gridColumn: '1 / -1' }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--cinza-700)', gridColumn: '1 / -1' }}>
            <input
              type="checkbox"
              checked={!!form.confirmar_maquina_anterior}
              onChange={e => setForm(prev => ({ ...prev, confirmar_maquina_anterior: e.target.checked }))}
            />
            Confirmo que esta é minha máquina anterior (mesmo dispositivo com IP alterado)
          </label>

          <Button variant="primary" isLoading={salvandoPrimeiroAcesso} disabled={salvandoPrimeiroAcesso}>
            Entrar
          </Button>
        </form>

        <div style={{ marginTop: '22px', borderTop: '1px solid var(--cinza-200)', paddingTop: '18px' }}>
          <h3 style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: '20px', fontWeight: 600,
            color: 'var(--cinza-800)', marginBottom: '12px',
            textTransform: 'uppercase', letterSpacing: '0.04em'
          }}>
            Acesso administrativo
          </h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px',
            width: '100%'
          }}>
            {admins.map(u => (
              <CardSelecao
                key={u.id}
                nome={u.nome}
                onClick={() => setSelecionado(u)}
              />
            ))}
          </div>
        </div>

        {!carregando && admins.length === 0 && (
          <p style={{ color: 'var(--cinza-600)', marginTop: '28px', textAlign: 'center' }}>
            Nenhum admin ativo encontrado no sistema.
          </p>
        )}
      </section>

      <div style={{
        position: 'fixed',
        zIndex: -1,
        inset: 0,
        background: 'var(--selecao-overlay-bg)'
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
