import React from 'react';

export default function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(5px)'
    }}>
      <div style={{
        background: 'white',
        padding: '1.5rem',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '450px',
        maxHeight: 'calc(100vh - 2rem)',
        overflowY: 'auto',
        boxSizing: 'border-box',
        boxShadow: '0 15px 50px rgba(55, 51, 146, 0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
          <button 
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
