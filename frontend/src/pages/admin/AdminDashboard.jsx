import React from 'react';
import { useAdmin } from '../../contexts/AdminContext';

export default function AdminDashboard() {
  const { getStats, pendingPayments } = useAdmin();
  const stats = getStats();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title">👑 Painel Administrativo</h1>
          <p className="text-secondary">Visão geral do desempenho do Yeto Finanças</p>
        </div>
      </div>

      {/* Cartões de Estatísticas */}
      <div className="dashboard-grid-top" style={{ marginBottom: '2rem' }}>
        <div className="dash-card">
          <p className="card-label">Total de Utilizadores</p>
          <h2 className="card-value">{stats.totalUsers}</h2>
          <div className="card-trend positive">Crescimento constante</div>
        </div>
        <div className="dash-card primary-card">
          <p className="card-label">Receita Mensal Recorrente (MRR)</p>
          <h2 className="card-value">Kz {stats.mrr.toLocaleString()}</h2>
          <div className="card-trend positive">+ {stats.premiumUsers} subscritores ativos</div>
        </div>
        <div className="dash-card" style={{ border: stats.pendingApprovals > 0 ? '1px solid var(--danger-color)' : 'none' }}>
          <p className="card-label">Pagamentos a Aprovar</p>
          <h2 className="card-value danger">{stats.pendingApprovals}</h2>
          <div className="card-trend warning">Requerem atenção manual</div>
        </div>
      </div>

      {/* Secção de Alertas Admin */}
      <div className="dash-card">
        <h3 className="section-title">Avisos do Sistema</h3>
        {stats.pendingApprovals > 0 ? (
          <div style={{ background: 'rgba(244, 91, 91, 0.1)', padding: '1rem', borderRadius: '10px', borderLeft: '4px solid var(--danger-color)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>💳</span>
            <div>
              <h4 style={{ margin: '0 0 0.3rem 0', color: 'var(--danger-color)' }}>Aprovações Pendentes</h4>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Existem {stats.pendingApprovals} pagamentos de plano Premium a aguardar verificação de comprovativo. 
                Por favor, valide os depósitos na página de "Aprovação de Pagamentos".
              </p>
            </div>
          </div>
        ) : (
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '10px', borderLeft: '4px solid var(--success-color)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>✅</span>
            <div>
              <h4 style={{ margin: '0 0 0.3rem 0', color: 'var(--success-color)' }}>Tudo em Dia</h4>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Não existem aprovações de pagamento pendentes. O sistema está a funcionar corretamente.
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
