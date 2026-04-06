'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { ModalNovaConstrutora } from '@/components/admin/ModalNovaConstrutora';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Plus, Pencil, Trash2, Building2, CalendarDays } from 'lucide-react';
import { Construtora } from '@/types';

export default function ConstrutorasPage() {
  const { addToast } = useToast();
  const [construtoras, setConstrutoras] = useState<Construtora[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editando, setEditando] = useState<Construtora | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState('');
  const [excluindo, setExcluindo] = useState<Construtora | null>(null);
  const [processando, setProcessando] = useState(false);

  const loadConstrutoras = async () => {
    setLoading(true);
    try {
      const data = await api.get<Construtora[]>('/construtoras/');
      setConstrutoras(data);
    } catch (e) {
      addToast('Erro ao carregar construtoras', 'erro');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConstrutoras();
  }, []);

  const abrirEdicao = (construtora: Construtora) => {
    setEditando(construtora);
    setNomeEdicao(construtora.nome);
  };

  const salvarEdicao = async () => {
    if (!editando || !nomeEdicao.trim()) return;
    setProcessando(true);
    try {
      await api.put(`/construtoras/${editando.id}`, { nome: nomeEdicao.trim() });
      addToast('Construtora atualizada com sucesso', 'sucesso');
      setEditando(null);
      setNomeEdicao('');
      await loadConstrutoras();
    } catch (e: any) {
      addToast(e?.message || 'Erro ao atualizar construtora', 'erro');
    } finally {
      setProcessando(false);
    }
  };

  const confirmarExclusao = async () => {
    if (!excluindo) return;
    setProcessando(true);
    try {
      await api.delete(`/construtoras/${excluindo.id}`);
      addToast('Construtora excluída com sucesso', 'sucesso');
      setExcluindo(null);
      await loadConstrutoras();
    } catch (e: any) {
      addToast(e?.message || 'Erro ao excluir construtora', 'erro');
    } finally {
      setProcessando(false);
    }
  };

  return (
    <>
      <PageHeader 
        titulo="Construtoras" 
        subtitulo="Gerencie as construtoras vinculadas aos projetos"
        acoes={
          <Button onClick={() => setIsModalOpen(true)} icon={<Plus size={16} />}>
            Nova construtora
          </Button>
        }
      />
      
      <div style={{ padding: 'var(--espaco-pagina)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <div style={{ background: 'var(--superficie-1)', border: '1px solid var(--borda-padrao)', borderRadius: 'var(--raio-card)', padding: 'var(--espaco-card)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--texto-secundario)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>
                Total de construtoras
              </div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--texto-principal)' }}>{construtoras.length}</div>
            </div>
            <Building2 size={18} color="var(--verde-principal)" />
          </div>
        </div>

        <table style={{ 
          width: '100%', borderCollapse: 'collapse', background: 'var(--superficie-1)', 
          borderRadius: 'var(--raio-card)', overflow: 'hidden', border: '1px solid var(--borda-padrao)' 
        }}>
            <thead>
              <tr style={{ background: 'var(--superficie-2)', textAlign: 'left', borderBottom: '1px solid var(--borda-padrao)' }}>
                <th style={{ padding: 'var(--tabela-padding)', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', fontSize: '12px', color: 'var(--texto-secundario)' }}>ID</th>
                <th style={{ padding: 'var(--tabela-padding)', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', fontSize: '12px', color: 'var(--texto-secundario)' }}>Construtora</th>
                <th style={{ padding: 'var(--tabela-padding)', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', fontSize: '12px', color: 'var(--texto-secundario)' }}>Criado em</th>
                <th style={{ padding: 'var(--tabela-padding)', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', fontSize: '12px', color: 'var(--texto-secundario)' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={{ padding: '32px', textAlign: 'center' }}>Carregando construtoras...</td></tr>
              ) : construtoras.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: 'var(--cinza-300)' }}>Nenhuma construtora cadastrada.</td></tr>
              ) : (
                construtoras.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--cinza-100)', transition: 'background 160ms ease' }}>
                    <td style={{ padding: 'var(--tabela-padding)', color: 'var(--texto-secundario)' }}>#{c.id}</td>
                    <td style={{ padding: 'var(--tabela-padding)', fontWeight: 600 }}>{c.nome}</td>
                    <td style={{ padding: 'var(--tabela-padding)', color: 'var(--texto-secundario)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <CalendarDays size={13} />
                        {new Date(c.criado_em).toLocaleDateString('pt-BR')}
                      </span>
                    </td>
                    <td style={{ padding: 'var(--tabela-padding)' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Button
                          variant="ghost"
                          style={{ fontSize: '13px' }}
                          onClick={() => abrirEdicao(c)}
                          icon={<Pencil size={14} />}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="danger"
                          style={{ fontSize: '13px', padding: '8px 12px' }}
                          onClick={() => setExcluindo(c)}
                          icon={<Trash2 size={14} />}
                        >
                          Excluir
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
      </div>

      <ModalNovaConstrutora 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadConstrutoras}
      />

      <Modal
        isOpen={!!editando}
        onClose={() => {
          setEditando(null);
          setNomeEdicao('');
        }}
        title="Editar construtora"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setEditando(null);
                setNomeEdicao('');
              }}
              disabled={processando}
            >
              Cancelar
            </Button>
            <Button onClick={salvarEdicao} isLoading={processando} disabled={!nomeEdicao.trim()}>
              Salvar
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '12px' }}>
            Nome
          </label>
          <input
            type="text"
            value={nomeEdicao}
            onChange={(e) => setNomeEdicao(e.target.value)}
            placeholder="Nome da construtora"
            style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--cinza-300)' }}
          />
        </div>
      </Modal>

      <Modal
        isOpen={!!excluindo}
        onClose={() => setExcluindo(null)}
        title="Excluir construtora"
        footer={
          <>
            <Button variant="secondary" onClick={() => setExcluindo(null)} disabled={processando}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmarExclusao} isLoading={processando}>
              Excluir
            </Button>
          </>
        }
      >
        Tem certeza que deseja excluir {excluindo?.nome}? Esta ação não pode ser desfeita.
      </Modal>
    </>
  );
}
