'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { Usuario } from '@/types';

interface ModalNovoUsuarioProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  usuarioEdicao?: Usuario | null;
}

export function ModalNovoUsuario({ isOpen, onClose, onSuccess, usuarioEdicao }: ModalNovoUsuarioProps) {
  const { addToast } = useToast();
  const [formData, setFormData] = useState({
    nome: '',
    role: 'funcionario' as 'funcionario' | 'admin',
    ativo: true
  });
  const [loading, setLoading] = useState(false);

  const isEdicao = !!usuarioEdicao;

  useEffect(() => {
    if (!isOpen) return;

    if (usuarioEdicao) {
      setFormData({
        nome: usuarioEdicao.nome,
        role: usuarioEdicao.role,
        ativo: usuarioEdicao.ativo
      });
    } else {
      setFormData({ nome: '', role: 'funcionario', ativo: true });
    }
  }, [isOpen, usuarioEdicao]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData.nome) return;

    setLoading(true);
    try {
      if (isEdicao && usuarioEdicao) {
        await api.put(`/usuarios/${usuarioEdicao.id}`, formData);
      } else {
        await api.post('/usuarios/', formData);
      }
      onSuccess();
      onClose();
      setFormData({ nome: '', role: 'funcionario', ativo: true });
      addToast(isEdicao ? 'Usuário atualizado com sucesso' : 'Usuário criado com sucesso', 'sucesso');
    } catch (err) {
      console.error(err);
      addToast(isEdicao ? 'Erro ao editar usuário' : 'Erro ao criar usuário', 'erro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdicao ? 'Editar Usuário' : 'Cadastrar Novo Usuário'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            onClick={() => handleSubmit()} 
            isLoading={loading}
            disabled={!formData.nome}
          >
            {isEdicao ? 'Salvar Alterações' : 'Cadastrar Usuário'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ 
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, 
            fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', 
            color: 'var(--cinza-600)' 
          }}>
            Nome Completo
          </label>
          <input
            required
            type="text"
            placeholder="Ex: João da Silva"
            value={formData.nome}
            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            style={{
              padding: '10px', borderRadius: '4px', border: '1px solid var(--cinza-300)',
              outline: 'none', transition: 'border-color 200ms ease',
              fontSize: '14px'
            }}
            autoFocus
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ 
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, 
            fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', 
            color: 'var(--cinza-600)' 
          }}>
            Papel (Role)
          </label>
          <div style={{ display: 'flex', gap: '24px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
              <input
                type="radio"
                name="role"
                value="funcionario"
                checked={formData.role === 'funcionario'}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as 'funcionario' | 'admin' })}
              />
              Funcionário
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
              <input
                type="radio"
                name="role"
                value="admin"
                checked={formData.role === 'admin'}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as 'funcionario' | 'admin' })}
              />
              Administrador
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
            fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em',
            color: 'var(--cinza-600)'
          }}>
            Status
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={formData.ativo}
              onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
            />
            Usuário ativo
          </label>
        </div>
      </form>
    </Modal>
  );
}
