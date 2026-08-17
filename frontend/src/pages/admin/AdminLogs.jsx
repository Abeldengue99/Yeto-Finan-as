import React, { useMemo, useState } from 'react';
import { useAdmin } from '../../contexts/AdminContext';
import PeriodFilter from '../../components/PeriodFilter';
import { createDefaultPeriodFilter, filterByPeriod, getPeriodLabel } from '../../utils/periodFilters';

export default function AdminLogs() {
  const { logs } = useAdmin();
  const [periodFilter, setPeriodFilter] = useState(() => createDefaultPeriodFilter('month'));
  const [typeFilter, setTypeFilter] = useState('todos');

  const filteredLogs = useMemo(() => (
    filterByPeriod(logs, periodFilter, item => item.dataRaw || item.data)
      .filter(item => typeFilter === 'todos' || item.tipo === typeFilter)
  ), [logs, periodFilter, typeFilter]);

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

      <div className="dash-card page-filter-bar">
        <span className="filter-result-note">
          {filteredLogs.length} atividade(s) em {getPeriodLabel(periodFilter)}
        </span>
        <PeriodFilter value={periodFilter} onChange={setPeriodFilter} compact />
        <div className="filter-field">
          <label>Tipo</label>
          <select className="qt-input" value={typeFilter} onChange={event => setTypeFilter(event.target.value)}>
            <option value="todos">Todos</option>
            <option value="user_created">Utilizadores</option>
            <option value="payment_pending">Pagamentos pendentes</option>
            <option value="payment_approved">Pagamentos aprovados</option>
            <option value="payment_rejected">Pagamentos rejeitados</option>
            <option value="assistant_message">Assistente</option>
          </select>
        </div>
      </div>

      <div className="dash-card">
        {filteredLogs.length === 0 ? (
          <p className="text-secondary" style={{ textAlign: 'center', padding: '2rem' }}>
            Ainda não existem atividades para apresentar.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredLogs.map((log) => (
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
