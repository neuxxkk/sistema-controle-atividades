'use client';

import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ isOpen, onClose, title, children, footer }: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '24px',
        }}>
          {/* Overlay (Fundo escurecido) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)', // Suporte para Safari
            }}
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              position: 'relative',
              background: 'var(--superficie-1)',
              border: '1px solid var(--borda-padrao)',
              borderRadius: '8px',
              padding: '32px',
              width: '100%',
              maxWidth: '480px',
              boxShadow: 'var(--sombra-elevada)',
              zIndex: 10000,
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}
          >
            {/* Header */}
            <div>
              <h2 style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 700,
                fontSize: '24px',
                color: 'var(--cinza-800)',
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
                margin: 0,
              }}>
                {title}
              </h2>
              <div style={{
                width: '40px',
                height: '3px',
                background: 'var(--verde-principal)',
                marginTop: '8px',
                borderRadius: '2px',
              }} />
            </div>

            {/* Body */}
            <div style={{
              fontSize: '15px',
              color: 'var(--cinza-600)',
              lineHeight: '1.5',
            }}>
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
                gap: '12px',
                rowGap: '8px',
                marginTop: '8px',
              }}>
                {footer}
              </div>
            )}

            {/* Botão fechar (X) no topo opcional pode ser adicionado aqui */}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
