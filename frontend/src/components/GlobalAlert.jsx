import React, { useEffect, useState } from 'react';
import { useFinance } from '../contexts/FinanceContext';

export default function GlobalAlert() {
  const { alertaGlobal, setAlertaGlobal } = useFinance();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (alertaGlobal) {
      setVisible(true);
      
      // Auto-fechar o alerta após 4 segundos se for sucesso, ou manter se for erro
      if (alertaGlobal.tipo === 'sucesso') {
        const timer = setTimeout(() => {
          handleClose();
        }, 4000);
        return () => clearTimeout(timer);
      }
    }
  }, [alertaGlobal]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => {
      setAlertaGlobal(null);
    }, 300); // tempo da animação
  };

  if (!alertaGlobal) return null;

  const isError = alertaGlobal.tipo === 'erro';
  const isWarning = alertaGlobal.tipo === 'aviso';
  const accentColor = isError
    ? '#E3000F'
    : isWarning
      ? '#f59e0b'
      : 'var(--accent-color)';
  const iconBackground = isError
    ? 'rgba(227, 0, 15, 0.1)'
    : isWarning
      ? 'rgba(245, 158, 11, 0.14)'
      : 'rgba(16, 185, 129, 0.1)';
  const iconText = isError ? 'X' : isWarning ? '!' : 'OK';

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      pointerEvents: visible ? 'auto' : 'none',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.3s ease',
      background: 'rgba(0, 0, 0, 0.4)',
      backdropFilter: 'blur(5px)'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '20px',
        padding: '2.5rem 2rem',
        width: '90%',
        maxWidth: '400px',
        textAlign: 'center',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        transform: visible ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(20px)',
        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
      }}>
        
        <div style={{
          width: '80px', height: '80px',
          borderRadius: '50%',
          background: iconBackground,
          color: accentColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.5rem',
          fontSize: isWarning ? '2.6rem' : '1.7rem',
          fontWeight: '900',
          boxShadow: `0 10px 24px ${isWarning ? 'rgba(245, 158, 11, 0.18)' : 'rgba(0,0,0,0.08)'}`
        }}>
          {iconText}
        </div>
        
        <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)', fontSize: '1.5rem' }}>
          {alertaGlobal.titulo}
        </h3>
        
        <p style={{ margin: '0 0 2rem 0', color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: '1.5' }}>
          {alertaGlobal.mensagem}
        </p>
        
        <button 
          onClick={handleClose}
          style={{
            background: accentColor,
            color: 'white',
            border: 'none',
            padding: '1rem 2rem',
            borderRadius: '30px',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: 'pointer',
            width: '100%',
            transition: 'opacity 0.2s',
            boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
          }}
          onMouseOver={(e) => e.target.style.opacity = '0.9'}
          onMouseOut={(e) => e.target.style.opacity = '1'}
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
