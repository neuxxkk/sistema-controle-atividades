import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/layout/Sidebar'
import { SessaoProvider } from '@/context/SessaoContext'
import { ToastProvider } from '@/context/ToastContext'
import { UsuarioProvider } from '@/context/UsuarioContext'

export const metadata: Metadata = {
  title: 'Fórmula Engenharia — Atividades',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body style={{ margin: 0, padding: 0 }} suppressHydrationWarning>
        <ToastProvider>
          <UsuarioProvider>
            <SessaoProvider>
              <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
                <Sidebar />
                <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', background: 'var(--cinza-100)' }}>
                  {children}
                </main>
              </div>
            </SessaoProvider>
          </UsuarioProvider>
        </ToastProvider>
      </body>
    </html>
  )
}
