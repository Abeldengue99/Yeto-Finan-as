import React from 'react';
import { useAdmin } from '../../contexts/AdminContext';

export default function AdminLogs() {
  const { logs } = useAdmin();

  const getLogIcon = (tipo) => {
    switch (tipo) {
      case 'success':
      case 'payment_approved':
        return '✓';
      case 'danger':
      case 'payment_rejected':
      case 'warning':
      case 'payment_pending':
        return '!';
      case 'user_created':
        return 'U';
      case 'assistant_message':
        return '?';
      case 'info':
      default:
        return 'i';
    }
  };

  const getLogColor = (tipo) => {
    switch (tipo) {
      case 'success':
      case 'payment_approved':
        return 'var(--success-color)';
      case 'danger':
      case 'payment_rejected':
        return 'var(--danger-color)';
      case 'warning':
      case 'payment_pending':
        return '#fca834';
      case 'user_created':
      case 'assistant_message':
      case 'info':
      default:
        return 'var(--accent-color)';
    }
  };

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">Histórico de Atividades</h1>
        <p className="text-secondary">Registo de auditoria de ações críticas, utilizadores, pagamentos e Assistente.</p>
      </div>

      <div className="dash-card">
        {logs.length === 0 ? (
          <p className="text-secondary" style={{ textAlign: 'center', padding: '2rem' }}>
            Ainda não existem atividades para apresentar.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {logs.map((log) => (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1rem',
                  borderBottom: '1px solid var(--glass-border)',
                  background: 'rgba(255,255,255,0.3)',
                  borderRadius: '10px'
                }}
              >
                <div style={{
                  fontSize: '1rem',
                  fontWeight: 900,
                  color: getLogColor(log.tipo),
                  background: '#f2f3f9',
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
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
