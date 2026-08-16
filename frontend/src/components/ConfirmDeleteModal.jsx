import React from 'react';

export default function ConfirmDeleteModal({ isOpen, onClose, onConfirm, title, message }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9998, background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(5px)',
      animation: 'fadeIn 0.3s ease'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '20px',
        padding: '2.5rem 2rem', width: '90%', maxWidth: '420px', textAlign: 'center',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        animation: 'fadeIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
      }}>
        <div style={{
          width: '70px', height: '70px', borderRadius: '50%',
          background: 'rgba(244, 91, 91, 0.1)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.5rem', fontSize: '2.5rem'
        }}>
          🗑️
        </div>

        <h3 style={{ margin: '0 0 0.8rem 0', color: 'var(--text-primary)', fontSize: '1.3rem' }}>
          {title || 'Confirmar Eliminação'}
        </h3>

        <p style={{ margin: '0 0 2rem 0', color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5' }}>
          {message || 'Tem a certeza que deseja eliminar este registo? Esta ação não pode ser desfeita.'}
        </p>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '0.9rem', borderRadius: '30px', border: '1px solid var(--glass-border)',
              background: 'transparent', color: 'var(--text-primary)', fontSize: '0.95rem',
              fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: '0.9rem', borderRadius: '30px', border: 'none',
              background: 'var(--danger-color)', color: 'white', fontSize: '0.95rem',
              fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s',
              boxShadow: '0 4px 15px rgba(244, 91, 91, 0.3)'
            }}
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}
