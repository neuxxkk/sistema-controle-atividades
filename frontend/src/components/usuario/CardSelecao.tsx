'use client';

interface CardSelecaoProps {
  nome: string;
  onClick: () => void;
}

export function CardSelecao({ nome, onClick }: CardSelecaoProps) {
  const iniciais = nome
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  const cardStyle: React.CSSProperties = {
    width: '100%',
    minHeight: '168px',
    background: 'var(--superficie-1)',
    border: '1px solid var(--borda-padrao)',
    borderRadius: '16px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '14px',
    cursor: 'pointer',
    transition: 'all 200ms ease',
    boxShadow: '0 2px 8px rgba(30,30,28,0.03)',
  };

  const badgeStyle: React.CSSProperties = {
    width: '64px',
    height: '64px',
    borderRadius: '14px',
    background: 'var(--cinza-100)',
    border: '1px solid var(--borda-padrao)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: '28px',
    color: 'var(--cinza-800)',
    transition: 'all 200ms ease',
  };

  return (
    <button
      onClick={onClick}
      style={cardStyle}
      onMouseOver={(e) => {
        e.currentTarget.style.borderColor = 'var(--verde-principal)';
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 14px 24px rgba(30,30,28,0.12)';
        const badge = e.currentTarget.querySelector('.perfil-badge') as HTMLElement | null;
        const cta = e.currentTarget.querySelector('.perfil-cta') as HTMLElement | null;
        if (badge) {
          badge.style.background = 'var(--verde-claro)';
          badge.style.color = 'var(--verde-texto)';
        }
        if (cta) {
          cta.style.color = 'var(--verde-texto)';
        }
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = 'var(--borda-padrao)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(30,30,28,0.03)';
        const badge = e.currentTarget.querySelector('.perfil-badge') as HTMLElement | null;
        const cta = e.currentTarget.querySelector('.perfil-cta') as HTMLElement | null;
        if (badge) {
          badge.style.background = 'var(--cinza-100)';
          badge.style.color = 'var(--cinza-800)';
        }
        if (cta) {
          cta.style.color = 'var(--cinza-600)';
        }
      }}
    >
      <div className="perfil-badge" style={badgeStyle}>
        {iniciais}
      </div>
      <span style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 600,
        fontSize: '22px',
        color: 'var(--cinza-800)',
        letterSpacing: '0.02em',
        textAlign: 'center',
        lineHeight: 1.1,
      }}>
        {nome}
      </span>
      <span className="perfil-cta" style={{
        fontSize: '11px',
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 600,
        color: 'var(--cinza-600)',
        transition: 'color 200ms ease',
      }}>
        Entrar no perfil
      </span>
    </button>
  );
}
