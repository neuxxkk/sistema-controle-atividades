'use client';

import { PageHeader } from '@/components/layout/PageHeader';

export default function ConfiguracoesPage() {
  return (
    <>
      <PageHeader titulo="Configurações" />
      <div className="p-8 max-w-[1200px] mx-auto w-full">
        <div className="bg-white border border-[var(--cinza-300)] rounded-md p-8">
           <h2 className="font-condensed font-bold text-xl text-[var(--cinza-800)] mb-4 uppercase">Configurações do Sistema</h2>
           <p className="text-[var(--cinza-600)] mb-8">Esta seção estará disponível em breve para ajustes de parâmetros globais do sistema.</p>
           
           <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between border-b border-[var(--cinza-100)] pb-4">
                 <div>
                    <h3 className="font-bold text-sm">Modo Escuro</h3>
                    <p className="text-xs text-[var(--cinza-300)]">Ativar interface com cores escuras (opcional)</p>
                 </div>
                 <div className="w-10 h-5 bg-[var(--cinza-300)] rounded-full relative">
                    <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full"></div>
                 </div>
              </div>

              <div className="flex items-center justify-between border-b border-[var(--cinza-100)] pb-4">
                 <div>
                    <h3 className="font-bold text-sm">Notificações</h3>
                    <p className="text-xs text-[var(--cinza-300)]">Alertas sonoros ao finalizar atividades</p>
                 </div>
                 <div className="w-10 h-5 bg-[var(--verde-principal)] rounded-full relative">
                    <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </>
  );
}
