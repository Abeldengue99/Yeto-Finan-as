import React from 'react';
import { useAdmin } from '../../contexts/AdminContext';

export default function AdminLogs() {
  const { logs } = useAdmin();

  const getLogIcon = (tipo) => {
    switch(tipo) {
      case 'success': return '✅';
      case 'danger': return '❌';
      case 'warning': return '⚠️';
      case 'info':
      default: return 'ℹ️';
    }
  };

  const getLogColor = (tipo) => {
    switch(tipo) {
      case 'success': return 'var(--success-color)';
      case 'danger': return 'var(--danger-color)';
      case 'warning': return '#fca834'; // Yeto Orange
      case 'info':
      default: return 'var(--primary-color)';
    }
  };

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">📜 Histórico de Atividades</h1>
        <p className="text-secondary">Registo de auditoria (Logs) de todas as ações críticas da plataforma.</p>
      </div>

      <div className="dash-card">
        {logs.length === 0 ? (
          <p className="text-secondary" style={{ textAlign: 'center', padding: '2rem' }}>Não existem registos no histórico.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {logs.map((log) => (
              <div 
                key={log.id} 
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', 
                  borderBottom: '1px solid var(--glass-border)',
                  background: 'rgba(255,255,255,0.3)',
                  borderRadius: '10px'
                }}
              >
                <div style={{ fontSize: '1.5rem', background: '#f2f3f9', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {getLogIcon(log.tipo)}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 'bold', color: getLogColor(log.tipo), fontSize: '1rem' }}>
                    {log.acao}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Registado a: {log.data}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
