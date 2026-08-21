import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PeriodFilter from '../../components/PeriodFilter';
import { apiFetch, readJsonResponse } from '../../utils/api';
import { createDefaultPeriodFilter, filterByPeriod, getPeriodLabel } from '../../utils/periodFilters';

const ACTION_LABELS = {
  first_account: 'Primeira conta organizada',
  first_income: 'Primeira receita registada',
  first_expense: 'Despesa com categoria',
  budget_month: 'Orçamento do mês definido',
  shopping_list_month: 'Compra planeada',
  fixed_payment_month: 'Conta fixa em dia',
  debt_paid: 'Dívida liquidada',
  active_days_month: '7 dias de disciplina',
  project_completed: 'Meta concluída',
  redeem_premium_month: 'Resgate de Premium'
};

function formatPoints(value) {
  return Number(value || 0).toLocaleString('pt-AO');
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString('pt-AO') : 'Sem data';
}

function getActionLabel(actionKey) {
  return ACTION_LABELS[actionKey] || String(actionKey || 'Ação').replace(/_/g, ' ');
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function downloadGamificationCsv(events, periodFilter) {
  const headers = [
    'Utilizador',
    'Email',
    'Provincia',
    'Genero',
    'Acao',
    'Pontos',
    'Periodo',
    'Data'
  ];
  const rows = events.map(event => [
    event.nome,
    event.email,
    event.provincia || 'Nao informado',
    event.genero || 'Nao informado',
    getActionLabel(event.actionKey),
    event.pontos,
    event.periodo,
    formatDate(event.dataRaw)
  ]);

  const csv = [headers, ...rows].map(row => row.map(csvCell).join(';')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `relatorio-gamificacao-yeto-${getPeriodLabel(periodFilter).replace(/\s+/g, '-')}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function AdminGamification() {
  const [report, setReport] = useState({
    stats: {},
    events: [],
    topUsers: [],
    actions: []
  });
  const [periodFilter, setPeriodFilter] = useState(() => createDefaultPeriodFilter('month'));
  const [actionFilter, setActionFilter] = useState('todos');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReport = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await apiFetch('/api/admin/gamification');
      const data = await readJsonResponse(response, 'Erro ao carregar relatório de gamificação.');

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar relatório de gamificação.');
      }

      setReport({
        stats: data.stats || {},
        events: data.events || [],
        topUsers: data.topUsers || [],
        actions: data.actions || []
      });
    } catch (err) {
      setError(err.message || 'Erro ao carregar relatório de gamificação.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const filteredEvents = useMemo(() => (
    filterByPeriod(report.events, periodFilter, item => item.dataRaw)
      .filter(item => actionFilter === 'todos' || item.actionKey === actionFilter)
  ), [report.events, periodFilter, actionFilter]);

  const periodStats = useMemo(() => {
    const users = new Set(filteredEvents.map(item => item.userId).filter(Boolean));

    return {
      totalEvents: filteredEvents.length,
      activeUsers: users.size,
      pointsAwarded: filteredEvents
        .filter(item => Number(item.pontos) > 0)
        .reduce((sum, item) => sum + Number(item.pontos || 0), 0),
      pointsRedeemed: filteredEvents
        .filter(item => Number(item.pontos) < 0)
        .reduce((sum, item) => sum + Math.abs(Number(item.pontos || 0)), 0),
      premiumRedemptions: filteredEvents.filter(item => item.actionKey === 'redeem_premium_month').length
    };
  }, [filteredEvents]);

  const periodTopUsers = useMemo(() => {
    const map = new Map();

    filteredEvents.forEach(event => {
      const key = event.userId || event.email;
      if (!key) return;

      const current = map.get(key) || {
        id: key,
        nome: event.nome,
        email: event.email,
        provincia: event.provincia,
        genero: event.genero,
        pontosGanhos: 0,
        pontosResgatados: 0,
        totalEventos: 0,
        ultimoEventoRaw: event.dataRaw
      };

      const points = Number(event.pontos || 0);
      current.totalEventos += 1;
      if (points > 0) current.pontosGanhos += points;
      if (points < 0) current.pontosResgatados += Math.abs(points);
      if (event.dataRaw && (!current.ultimoEventoRaw || new Date(event.dataRaw) > new Date(current.ultimoEventoRaw))) {
        current.ultimoEventoRaw = event.dataRaw;
      }
      map.set(key, current);
    });

    return Array.from(map.values())
      .sort((a, b) => b.pontosGanhos - a.pontosGanhos || b.totalEventos - a.totalEventos)
      .slice(0, 10);
  }, [filteredEvents]);

  const actionOptions = useMemo(() => (
    report.actions.map(action => action.actionKey).filter(Boolean)
  ), [report.actions]);

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div className="admin-payments-header">
        <div>
          <h1 className="page-title">Gamificação dos Utilizadores</h1>
          <p className="text-secondary">
            Acompanhe YetoPoints, missões concluídas, resgates de Premium e utilizadores mais ativos.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-glass btn-pill" onClick={loadReport}>
            Atualizar
          </button>
          <button
            type="button"
            className="btn btn-primary btn-pill"
            onClick={() => downloadGamificationCsv(filteredEvents, periodFilter)}
            disabled={filteredEvents.length === 0}
          >
            Baixar relatório
          </button>
        </div>
      </div>

      {error && (
        <div className="admin-inline-feedback danger">
          {error}
        </div>
      )}

      <div className="admin-payment-metrics">
        <div className="admin-payment-metric success">
          <span>Pontos distribuídos</span>
          <strong>{formatPoints(periodStats.pointsAwarded)}</strong>
          <small>{periodStats.totalEvents} evento(s) em {getPeriodLabel(periodFilter)}</small>
        </div>
        <div className="admin-payment-metric warning">
          <span>Pontos resgatados</span>
          <strong>{formatPoints(periodStats.pointsRedeemed)}</strong>
          <small>{periodStats.premiumRedemptions} resgate(s) Premium</small>
        </div>
        <div className="admin-payment-metric">
          <span>Utilizadores ativos</span>
          <strong>{formatPoints(periodStats.activeUsers)}</strong>
          <small>Com atividade de gamificação</small>
        </div>
        <div className="admin-payment-metric">
          <span>Histórico geral</span>
          <strong>{formatPoints(report.stats.totalEvents)}</strong>
          <small>{formatPoints(report.stats.events7d)} evento(s) nos últimos 7 dias</small>
        </div>
      </div>

      <div className="dash-card page-filter-bar">
        <span className="filter-result-note">
          {filteredEvents.length} registo(s) em {getPeriodLabel(periodFilter)}
        </span>
        <PeriodFilter value={periodFilter} onChange={setPeriodFilter} compact />
        <div className="filter-field">
          <label>Tipo de ação</label>
          <select className="qt-input" value={actionFilter} onChange={event => setActionFilter(event.target.value)}>
            <option value="todos">Todos</option>
            {actionOptions.map(actionKey => (
              <option key={actionKey} value={actionKey}>{getActionLabel(actionKey)}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="dash-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <p className="text-secondary">A carregar relatório de gamificação...</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '1.5rem' }}>
          <div className="dash-card">
            <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Histórico de YetoPoints</h2>
            {filteredEvents.length === 0 ? (
              <p className="text-secondary" style={{ textAlign: 'center', padding: '2rem' }}>
                Ainda não existem registos de gamificação neste período.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {filteredEvents.slice(0, 120).map(event => (
                  <div
                    key={event.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) auto',
                      gap: '1rem',
                      alignItems: 'center',
                      padding: '1rem',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '16px',
                      background: 'rgba(255,255,255,0.45)'
                    }}
                  >
                    <div>
                      <strong style={{ color: 'var(--text-primary)' }}>{event.nome}</strong>
                      <p style={{ margin: '0.25rem 0', color: 'var(--text-secondary)' }}>{event.email}</p>
                      <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                        {getActionLabel(event.actionKey)} - {event.descricao || 'Sem descrição'}
                      </p>
                      <small className="text-secondary">
                        {formatDate(event.dataRaw)} {event.provincia ? `- ${event.provincia}` : ''}
                      </small>
                    </div>
                    <strong style={{
                      color: Number(event.pontos) >= 0 ? 'var(--success-color)' : 'var(--danger-color)',
                      fontSize: '1.1rem'
                    }}>
                      {Number(event.pontos) >= 0 ? '+' : '-'}{formatPoints(Math.abs(Number(event.pontos || 0)))} pts
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="dash-card">
              <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Utilizadores em destaque</h2>
              {(periodTopUsers.length > 0 ? periodTopUsers : report.topUsers).slice(0, 8).map(user => (
                <div key={user.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  padding: '0.85rem 0',
                  borderBottom: '1px solid var(--glass-border)'
                }}>
                  <div>
                    <strong>{user.nome}</strong>
                    <p style={{ margin: '0.2rem 0', color: 'var(--text-secondary)' }}>{user.email}</p>
                    <small className="text-secondary">{user.provincia || 'Sem província'} - {formatDate(user.ultimoEventoRaw)}</small>
                  </div>
                  <strong style={{ color: 'var(--accent-color)' }}>{formatPoints(user.pontosGanhos || user.pontosAtuais)} pts</strong>
                </div>
              ))}
              {periodTopUsers.length === 0 && report.topUsers.length === 0 && (
                <p className="text-secondary">Ainda não há utilizadores com pontos.</p>
              )}
            </div>

            <div className="dash-card">
              <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Ações mais usadas</h2>
              {report.actions.length === 0 ? (
                <p className="text-secondary">Ainda não existem ações registadas.</p>
              ) : (
                report.actions.slice(0, 8).map(action => (
                  <div key={action.actionKey} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    padding: '0.75rem 0',
                    borderBottom: '1px solid var(--glass-border)'
                  }}>
                    <span>{getActionLabel(action.actionKey)}</span>
                    <strong>{formatPoints(action.totalEventos)}</strong>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
