'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { useUsuario } from '@/context/UsuarioContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { usuario, carregando } = useUsuario();
  const router = useRouter();

  useEffect(() => {
    if (!carregando && !usuario) {
      router.push('/');
    } else if (!carregando && usuario && usuario.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [usuario, carregando, router]);

  if (carregando || !usuario || usuario.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[var(--cinza-100)] flex items-center justify-center">
        <div className="animate-pulse font-condensed text-xl text-[var(--cinza-600)] uppercase tracking-widest">
          Autenticando...
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
    </>
  );
}

