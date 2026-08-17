import React, { useMemo, useState } from 'react';
import { useAdmin } from '../../contexts/AdminContext';
import PeriodFilter from '../../components/PeriodFilter';
import { createDefaultPeriodFilter, filterByPeriod, getPeriodLabel } from '../../utils/periodFilters';

function formatDate(value) {
  if (!value) return 'Sem registo';

  return new Date(value).toLocaleString('pt-AO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function daysUntil(value) {
  if (!value) return null;
  const expiry = new Date(value).getTime();
  if (Number.isNaN(expiry)) return null;
  return Math.ceil((expiry - Date.now()) / (1000 * 60 * 60 * 24));
}

function AdminMetricCard({ label, value, detail, tone = 'neutral' }) {
  return (
    <div className={`admin-metric-card ${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </div>
  );
}

function CommandAlert({ title, message, tone = 'info', actionLabel, onAction }) {
  return (
    <div className={`admin-command-alert ${tone}`}>
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      {actionLabel && (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default function AdminDashboard({ setActiveTab }) {
  const {
    getStats,
    users,
    pendingPayments,
    assistantConversations,
    logs,
    isLoadingAdmin,
    lastAdminRefresh,
    loadAdminData
  } = useAdmin();
  const stats = getStats();
  const [periodFilter, setPeriodFilter] = useState(() => createDefaultPeriodFilter('month'));
  const filteredUsers = useMemo(
    () => filterByPeriod(users, periodFilter, item => item.dataRegisto),
    [users, periodFilter]
  );
  const filteredPayments = useMemo(
    () => filterByPeriod(pendingPayments, periodFilter, item => item.dataSubmissaoRaw),
    [pendingPayments, periodFilter]
  );
  const filteredLogs = useMemo(
    () => filterByPeriod(logs, periodFilter, item => item.dataRaw || item.data),
    [logs, periodFilter]
  );
  const filteredStats = useMemo(() => {
    const nonAdminUsers = filteredUsers.filter(user => user.plano !== 'Admin');
    const premiumUsers = filteredUsers.filter(user => user.plano === 'Premium').length;
    const blockedUsersCount = filteredUsers.filter(user => user.status === 'Bloqueado').length;
    return {
      totalUsers: nonAdminUsers.length,
      premiumUsers,
      blockedUsers: blockedUsersCount,
      pendingApprovals: filteredPayments.length,
      assistantUnread: stats.assistantUnread,
      expiringSoon: stats.expiringSoon,
      conversionRate: nonAdminUsers.length ? Number(((premiumUsers / nonAdminUsers.length) * 100).toFixed(1)) : 0,
      mrr: premiumUsers * 5999
    };
  }, [filteredUsers, filteredPayments, stats.assistantUnread, stats.expiringSoon]);

  const openConversations = useMemo(
    () => assistantConversations.filter(item => item.status === 'open'),
    [assistantConversations]
  );
  const unreadConversations = useMemo(
    () => assistantConversations.filter(item => Number(item.unread_count || 0) > 0),
    [assistantConversations]
  );
  const expiringUsers = useMemo(
    () => users
      .map(user => ({ ...user, daysLeft: daysUntil(user.dataExpiracao) }))
      .filter(user => user.plano !== 'Admin' && user.daysLeft !== null && user.daysLeft >= 0 && user.daysLeft <= 7)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 4),
    [users]
  );
  const blockedUsers = useMemo(
    () => filteredUsers.filter(user => user.status === 'Bloqueado').slice(0, 4),
    [filteredUsers]
  );
  const recentLogs = filteredLogs.slice(0, 5);
  const commandAlerts = [
    {
      show: filteredStats.pendingApprovals > 0,
      title: 'Pagamentos aguardando validação',
      message: `${filteredStats.pendingApprovals} comprovativo(s) precisam de análise para ativar planos Premium.`,
      tone: 'danger',
      actionLabel: 'Ver pagamentos',
      tab: 'admin_payments'
    },
    {
      show: stats.assistantUnread > 0,
      title: 'Mensagens novas no Assistente',
      message: `${stats.assistantUnread} mensagem(ns) de utilizadores ainda não foram lidas.`,
      tone: 'warning',
      actionLabel: 'Abrir Assistente',
      tab: 'assistente'
    },
    {
      show: stats.expiringSoon > 0,
      title: 'Planos próximos do fim',
      message: `${stats.expiringSoon} conta(s) expiram nos próximos 7 dias. É uma boa altura para retenção.`,
      tone: 'info',
      actionLabel: 'Ver utilizadores',
      tab: 'admin_users'
    },
    {
      show: filteredStats.blockedUsers > 0,
      title: 'Contas bloqueadas',
      message: `${filteredStats.blockedUsers} conta(s) estão bloqueadas e devem ser acompanhadas.`,
      tone: 'danger',
      actionLabel: 'Rever contas',
      tab: 'admin_users'
    }
  ].filter(alert => alert.show);

  return (
    <div className="admin-command-page">
      <div className="admin-command-hero">
        <div>
          <span className="admin-command-eyebrow">Centro de Comando</span>
          <h1>Painel Administrativo</h1>
          <p>Operação, receita, suporte e risco numa única visão para decisões rápidas.</p>
        </div>
        <div className="admin-command-refresh">
          <span>{isLoadingAdmin ? 'A atualizar...' : `Atualizado: ${formatDate(lastAdminRefresh)}`}</span>
          <button type="button" onClick={loadAdminData} disabled={isLoadingAdmin}>
            Atualizar
          </button>
        </div>
      </div>

      <div className="admin-metrics-grid">
        <AdminMetricCard
          label="Utilizadores"
          value={stats.totalUsers}
          detail={`+${stats.newUsers7d} nos últimos 7 dias`}
          tone="neutral"
        />
        <AdminMetricCard
          label="Premium ativos"
          value={stats.premiumUsers}
          detail={`${stats.conversionRate}% de conversão`}
          tone="success"
        />
        <AdminMetricCard
          label="Receita estimada"
          value={`Kz ${Number(stats.mrr || 0).toLocaleString('pt-AO')}`}
          detail="MRR calculado por planos ativos"
          tone="accent"
        />
        <AdminMetricCard
          label="Ações pendentes"
          value={stats.pendingApprovals + stats.assistantUnread}
          detail="Pagamentos e mensagens por tratar"
          tone={stats.pendingApprovals + stats.assistantUnread > 0 ? 'danger' : 'success'}
        />
      </div>

      <div className="admin-command-grid">
        <section className="admin-command-panel wide">
          <div className="admin-panel-header">
            <div>
              <h2>Prioridades de hoje</h2>
              <p>Itens que merecem intervenção administrativa.</p>
            </div>
          </div>

          <div className="admin-alert-stack">
            {commandAlerts.length > 0 ? (
              commandAlerts.map(alert => (
                <CommandAlert
                  key={alert.title}
                  title={alert.title}
                  message={alert.message}
                  tone={alert.tone}
                  actionLabel={alert.actionLabel}
                  onAction={() => setActiveTab?.(alert.tab)}
                />
              ))
            ) : (
              <CommandAlert
                title="Operação estável"
                message="Não existem pagamentos, mensagens ou riscos críticos pendentes neste momento."
                tone="success"
              />
            )}
          </div>
        </section>

        <section className="admin-command-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Ações rápidas</h2>
              <p>Atalhos para as rotinas mais importantes.</p>
            </div>
          </div>
          <div className="admin-quick-actions">
            <button type="button" onClick={() => setActiveTab?.('admin_payments')}>
              <span>{pendingPayments.length}</span>
              Validar pagamentos
            </button>
            <button type="button" onClick={() => setActiveTab?.('assistente')}>
              <span>{unreadConversations.length}</span>
              Responder pedidos
            </button>
            <button type="button" onClick={() => setActiveTab?.('admin_users')}>
              <span>{stats.expiringSoon}</span>
              Rever retenção
            </button>
            <button type="button" onClick={() => setActiveTab?.('admin_logs')}>
              <span>{recentLogs.length}</span>
              Ver auditoria
            </button>
          </div>
        </section>

        <section className="admin-command-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Assistente</h2>
              <p>Conversas abertas e mensagens por ler.</p>
            </div>
            <button type="button" onClick={() => setActiveTab?.('assistente')}>Abrir</button>
          </div>
          <div className="admin-list">
            {openConversations.length === 0 ? (
              <p className="admin-empty">Sem conversas abertas.</p>
            ) : (
              openConversations.slice(0, 4).map(item => (
                <div key={item.id} className="admin-list-item">
                  <div>
                    <strong>{item.subject}</strong>
                    <span>{item.user_name || item.user_email}</span>
                  </div>
                  {Number(item.unread_count || 0) > 0 && (
                    <em>{item.unread_count}</em>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="admin-command-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Planos a expirar</h2>
              <p>Contas que podem precisar de contacto.</p>
            </div>
          </div>
          <div className="admin-list">
            {expiringUsers.length === 0 ? (
              <p className="admin-empty">Nenhum plano expira nos próximos 7 dias.</p>
            ) : (
              expiringUsers.map(user => (
                <div key={user.id} className="admin-list-item">
                  <div>
                    <strong>{user.nome}</strong>
                    <span>{user.email}</span>
                  </div>
                  <em>{user.daysLeft}d</em>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="admin-command-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Risco e segurança</h2>
              <p>Contas bloqueadas ou com atenção operacional.</p>
            </div>
          </div>
          <div className="admin-list">
            {blockedUsers.length === 0 ? (
              <p className="admin-empty">Nenhuma conta bloqueada.</p>
            ) : (
              blockedUsers.map(user => (
                <div key={user.id} className="admin-list-item">
                  <div>
                    <strong>{user.nome}</strong>
                    <span>{user.email}</span>
                  </div>
                  <em>Bloqueado</em>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="admin-command-panel wide">
          <div className="admin-panel-header">
            <div>
              <h2>Atividade recente</h2>
              <p>Últimas ações registadas no sistema.</p>
            </div>
            <button type="button" onClick={() => setActiveTab?.('admin_logs')}>Ver tudo</button>
          </div>
          <div className="admin-timeline">
            {recentLogs.length === 0 ? (
              <p className="admin-empty">Ainda não existem registos recentes.</p>
            ) : (
              recentLogs.map(log => (
                <div key={log.id}>
                  <span />
                  <div>
                    <strong>{log.acao}</strong>
                    <p>{log.data}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
