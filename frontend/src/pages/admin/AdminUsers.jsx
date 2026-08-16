import React from 'react';
import { useAdmin } from '../../contexts/AdminContext';

export default function AdminUsers() {
  const { users, toggleUserStatus, changeUserPlan } = useAdmin();

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">👥 Gestão de Utilizadores</h1>
        <p className="text-secondary">Controlo das contas ativas na plataforma</p>
      </div>

      <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fc', borderBottom: '1px solid var(--glass-border)' }}>
              <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)' }}>ID</th>
              <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)' }}>Nome</th>
              <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)' }}>E-mail</th>
              <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)' }}>Plano Atual</th>
              <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)' }}>Status</th>
              <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-secondary)' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>#{user.id}</td>
                <td style={{ padding: '1rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{user.nome}</td>
                <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{user.email}</td>
                <td style={{ padding: '1rem' }}>
                  <span style={{ 
                    background: user.plano === 'Premium' ? 'rgba(255, 179, 0, 0.1)' : 'rgba(55, 51, 146, 0.1)', 
                    color: user.plano === 'Premium' ? 'var(--accent-color)' : 'var(--primary-color)',
                    padding: '0.3rem 0.8rem', borderRadius: '15px', fontSize: '0.85rem', fontWeight: 'bold'
                  }}>
                    {user.plano}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>
                  <span style={{ 
                    color: user.status === 'Ativo' ? 'var(--success-color)' : 'var(--danger-color)',
                    fontWeight: 'bold', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '5px'
                  }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: user.status === 'Ativo' ? 'var(--success-color)' : 'var(--danger-color)' }}></span>
                    {user.status}
                  </span>
                </td>
                <td style={{ padding: '1rem', textAlign: 'right', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  {user.plano !== 'Premium' && (
                    <button 
                      onClick={() => {
                        if (window.confirm(`Tem a certeza que deseja dar Premium grátis a ${user.nome}?`)) {
                          changeUserPlan(user.id, 'Premium');
                        }
                      }}
                      className="btn"
                      style={{ 
                        background: 'var(--accent-gradient)',
                        color: 'white',
                        padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', border: 'none', cursor: 'pointer'
                      }}
                    >
                      Dar Premium
                    </button>
                  )}
                  <button 
                    onClick={() => toggleUserStatus(user.id)}
                    className="btn"
                    style={{ 
                      background: user.status === 'Ativo' ? 'rgba(244, 91, 91, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                      color: user.status === 'Ativo' ? 'var(--danger-color)' : 'var(--success-color)',
                      padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', border: 'none', cursor: 'pointer'
                    }}
                  >
                    {user.status === 'Ativo' ? 'Bloquear' : 'Ativar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
