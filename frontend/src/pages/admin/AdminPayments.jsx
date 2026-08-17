import React, { useMemo, useState } from 'react';
import { useAdmin } from '../../contexts/AdminContext';
import Modal from '../../components/Modal';
import PeriodFilter from '../../components/PeriodFilter';
import { createDefaultPeriodFilter, filterByPeriod, getPeriodLabel } from '../../utils/periodFilters';

export default function AdminPayments() {
  const { pendingPayments, approvePayment, rejectPayment } = useAdmin();
  const [selectedProof, setSelectedProof] = useState(null);
  const [periodFilter, setPeriodFilter] = useState(() => createDefaultPeriodFilter('month'));
  const [planFilter, setPlanFilter] = useState('todos');

  const filteredPayments = useMemo(() => (
    filterByPeriod(pendingPayments, periodFilter, item => item.dataSubmissaoRaw)
      .filter(item => planFilter === 'todos' || item.plano === planFilter)
  ), [pendingPayments, periodFilter, planFilter]);

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">💳 Aprovação de Pagamentos</h1>
        <p className="text-secondary">Validação de comprovativos para ativação do Plano Premium</p>
      </div>

      <div className="dash-card page-filter-bar">
        <span className="filter-result-note">
          {filteredPayments.length} pagamento(s) pendente(s) em {getPeriodLabel(periodFilter)}
        </span>
        <PeriodFilter value={periodFilter} onChange={setPeriodFilter} compact />
        <div className="filter-field">
          <label>Plano</label>
          <select className="qt-input" value={planFilter} onChange={event => setPlanFilter(event.target.value)}>
            <option value="todos">Todos</option>
            <option value="semestral">Semestral</option>
            <option value="anual">Anual</option>
          </select>
        </div>
      </div>

      {pendingPayments.length === 0 ? (
        <div className="dash-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Nenhum pagamento pendente!</h2>
          <p className="text-secondary">Todos os comprovativos submetidos já foram avaliados.</p>
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="dash-card" style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--text-secondary)' }}>
          Nenhum pagamento encontrado para este filtro.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
          {filteredPayments.map(payment => (
            <div key={payment.id} className="dash-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: '0 0 0.3rem 0', color: 'var(--text-primary)' }}>{payment.nome}</h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>ID: #{payment.userId} • Plano: {payment.plano === 'semestral' ? 'Semestral' : 'Anual'}</p>
                </div>
                <div style={{ 
                  background: 'var(--accent-gradient)', color: 'white', fontWeight: 'bold', 
                  padding: '0.4rem 0.8rem', borderRadius: '10px', fontSize: '1.1rem' 
                }}>
                  {payment.valor.toLocaleString()} Kz
                </div>
              </div>

              <div style={{ background: '#f8f9fc', padding: '1rem', borderRadius: '10px', fontSize: '0.85rem', color: '#555' }}>
                <strong>Data de Submissão:</strong> {payment.dataSubmissao}
              </div>

              <button 
                onClick={() => setSelectedProof(payment.comprovativoUrl)}
                className="btn btn-glass" 
                style={{ width: '100%', padding: '0.8rem', border: '1px solid var(--accent-color)', color: 'var(--accent-color)' }}
              >
                📄 Ver Comprovativo
              </button>

              <div style={{ display: 'flex', gap: '1rem', marginTop: 'auto' }}>
                <button 
                  onClick={() => rejectPayment(payment.id)}
                  className="btn" 
                  style={{ flex: 1, background: 'rgba(244, 91, 91, 0.1)', color: 'var(--danger-color)', border: 'none', padding: '0.8rem', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  ❌ Rejeitar
                </button>
                <button 
                  onClick={() => approvePayment(payment.id)}
                  className="btn" 
                  style={{ flex: 1, background: 'var(--success-color)', color: 'white', border: 'none', padding: '0.8rem', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  ✅ Aprovar Plano
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal para visualizar o comprovativo */}
      <Modal isOpen={!!selectedProof} onClose={() => setSelectedProof(null)} title="Visualizar Comprovativo">
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <img src={selectedProof} alt="Comprovativo de Pagamento" style={{ maxWidth: '100%', borderRadius: '10px', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }} />
          <p className="text-secondary" style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
            Verifique se os dados da transferência correspondem ao plano escolhido e se a conta de destino é a do Yeto Finanças.
          </p>
        </div>
      </Modal>

    </div>
  );
}
