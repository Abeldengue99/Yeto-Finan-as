import React, { useMemo, useState } from 'react';
import { useAdmin } from '../../contexts/AdminContext';
import { useFinance } from '../../contexts/FinanceContext';
import Modal from '../../components/Modal';
import PeriodFilter from '../../components/PeriodFilter';
import { createDefaultPeriodFilter, filterByPeriod, getPeriodLabel } from '../../utils/periodFilters';

const ADMIN_PERMISSION_OPTIONS = [
  { key: 'users', label: 'Utilizadores', description: 'Ver perfis, bloquear contas, reenviar códigos e gerir utilizadores.' },
  { key: 'payments', label: 'Pagamentos', description: 'Validar, aprovar ou rejeitar comprovativos de subscrição.' },
  { key: 'assistant', label: 'Assistente', description: 'Responder conversas e acompanhar pedidos dos utilizadores.' },
  { key: 'reports', label: 'Relatórios', description: 'Consultar logs, auditoria e baixar relatórios administrativos.' },
  { key: 'settings', label: 'Definições', description: 'Gerir configurações globais e permissões de outros admins.' },
  { key: 'marketing', label: 'Marketing', description: 'Enviar comunicados e campanhas para utilizadores verificados.' }
];

const DEFAULT_PERMISSIONS = {
  dashboard: false,
  users: false,
  payments: false,
  assistant: false,
  reports: false,
  settings: false,
  marketing: false
};

function formatDate(value) {
  if (!value) return 'Sem data';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem data';
  return date.toLocaleDateString('pt-AO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

function formatDateTime(value) {
  if (!value) return 'Sem registo';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem registo';
  return date.toLocaleString('pt-AO');
}

function daysUntil(value) {
  if (!value) return null;
  const expiry = new Date(value).getTime();
  if (Number.isNaN(expiry)) return null;
  return Math.ceil((expiry - Date.now()) / (1000 * 60 * 60 * 24));
}

function normalizePermissions(user) {
  return {
    ...DEFAULT_PERMISSIONS,
    ...(user?.adminPermissions || {})
  };
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function downloadUsersCsv(users) {
  const headers = [
    'Nome',
    'Email',
    'Email verificado',
    'Plano',
    'Pacote',
    'Estado',
    'Provincia',
    'Municipio',
    'Cidade/Bairro',
    'Genero',
    'Profissao',
    'Data de registo',
    'Validade',
    'Ultimo acesso',
    'Dispositivos'
  ];

  const rows = users.map(user => [
    user.nome,
    user.email,
    user.emailVerificado ? 'Sim' : 'Nao',
    user.plano,
    user.pacote,
    user.status,
    user.provincia || 'Nao informada',
    user.municipio || '',
    user.cidade || '',
    user.genero || 'Nao informado',
    user.ocupacao || '',
    formatDateTime(user.dataRegisto),
    user.plano === 'Admin' ? 'Admin' : formatDateTime(user.dataExpiracao),
    formatDateTime(user.ultimoLogin),
    user.totalDispositivos || 0
  ]);

  const csv = [headers, ...rows].map(row => row.map(csvCell).join(';')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `relatorio-utilizadores-yeto-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function AdminUsers() {
  const {
    users,
    toggleUserStatus,
    changeUserPlan,
    deleteUser,
    resendVerificationCode,
    remindUnverifiedUsers,
    updateAdminPermissions,
    revokeAdminPermissions
  } = useAdmin();
  const { usuario } = useFinance();
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [permissionUser, setPermissionUser] = useState(null);
  const [permissionDraft, setPermissionDraft] = useState(DEFAULT_PERMISSIONS);
  const [permissionFeedback, setPermissionFeedback] = useState(null);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [periodFilter, setPeriodFilter] = useState(() => createDefaultPeriodFilter('month'));
  const [statusFilter, setStatusFilter] = useState('todos');
  const [emailFilter, setEmailFilter] = useState('todos');
  const [provinceFilter, setProvinceFilter] = useState('todas');
  const [genderFilter, setGenderFilter] = useState('todos');
  const [feedback, setFeedback] = useState(null);
  const [isSendingReminder, setIsSendingReminder] = useState(false);

  const provinceOptions = useMemo(() => (
    [...new Set(users.map(user => user.provincia).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-AO'))
  ), [users]);

  const adminUserInsights = useMemo(() => {
    const normalUsers = users.filter(user => user.plano !== 'Admin');
    const provinceCounts = normalUsers.reduce((acc, user) => {
      const key = user.provincia || 'Não informada';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const genderCounts = normalUsers.reduce((acc, user) => {
      const key = user.genero || 'Não informado';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const provinceRanking = Object.entries(provinceCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-AO'));

    return {
      total: normalUsers.length,
      verified: normalUsers.filter(user => user.emailVerificado).length,
      unverified: normalUsers.filter(user => !user.emailVerificado).length,
      withLocation: normalUsers.filter(user => user.provincia).length,
      withoutLocation: normalUsers.filter(user => !user.provincia).length,
      withDevices: normalUsers.filter(user => Number(user.totalDispositivos || 0) > 0).length,
      provinceRanking,
      genderCounts
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return filterByPeriod(users, periodFilter, user => user.dataRegisto)
      .filter(user => statusFilter === 'todos' || user.status === statusFilter)
      .filter(user => {
        if (emailFilter === 'todos') return true;
        if (emailFilter === 'verificado') return user.emailVerificado;
        return !user.emailVerificado;
      })
      .filter(user => provinceFilter === 'todas' || (user.provincia || 'Não informada') === provinceFilter)
      .filter(user => genderFilter === 'todos' || (user.genero || 'Não informado') === genderFilter)
      .filter(user => {
        if (!query) return true;
        return (
          user.nome?.toLowerCase().includes(query) ||
          user.email?.toLowerCase().includes(query) ||
          user.plano?.toLowerCase().includes(query) ||
          user.status?.toLowerCase().includes(query) ||
          user.provincia?.toLowerCase().includes(query) ||
          user.municipio?.toLowerCase().includes(query) ||
          user.cidade?.toLowerCase().includes(query)
        );
      });
  }, [search, users, periodFilter, statusFilter, emailFilter, provinceFilter, genderFilter]);

  const profileDaysLeft = selectedUser ? daysUntil(selectedUser.dataExpiracao) : null;
  const actionUser = pendingAction?.user || null;
  const actionTitle = pendingAction?.type === 'delete' ? 'Eliminar Utilizador' : 'Confirmar Premium';
  const actionText = pendingAction?.type === 'delete'
    ? `Eliminar definitivamente ${actionUser?.nome}? Esta ação remove a conta e os dados associados.`
    : `Dar Premium grátis a ${actionUser?.nome}?`;

  const openPermissionModal = (user) => {
    setPermissionUser(user);
    setPermissionDraft(normalizePermissions(user));
    setFeedback(null);
    setPermissionFeedback(null);
  };

  const handleReminder = async () => {
    setIsSendingReminder(true);
    const result = await remindUnverifiedUsers();
    setIsSendingReminder(false);
    setFeedback({
      type: result ? 'success' : 'danger',
      text: result?.message || 'Não foi possível enviar os lembretes.'
    });
  };

  const handleResendCode = async (userId) => {
    const ok = await resendVerificationCode(userId);
    setFeedback({
      type: ok ? 'success' : 'danger',
      text: ok ? 'Código enviado para o email do utilizador.' : 'Não foi possível reenviar o código.'
    });
  };

  const handleToggleStatus = async (user) => {
    const updated = await toggleUserStatus(user.id);
    if (updated && selectedUser?.id === updated.id) setSelectedUser(updated);
  };

  const confirmAction = async () => {
    if (!pendingAction?.user) return;

    if (pendingAction.type === 'delete') {
      const ok = await deleteUser(pendingAction.user.id);
      if (ok && selectedUser?.id === pendingAction.user.id) setSelectedUser(null);
      setFeedback({
        type: ok ? 'success' : 'danger',
        text: ok ? 'Utilizador eliminado com sucesso.' : 'Não foi possível eliminar o utilizador.'
      });
    }

    if (pendingAction.type === 'premium') {
      const updated = await changeUserPlan(pendingAction.user.id, 'Premium');
      if (updated && selectedUser?.id === pendingAction.user.id) setSelectedUser(updated);
      setFeedback({
        type: updated ? 'success' : 'danger',
        text: updated ? 'Plano Premium atribuído com sucesso.' : 'Não foi possível atribuir Premium.'
      });
    }

    setPendingAction(null);
  };

  const savePermissions = async () => {
    const hasArea = ADMIN_PERMISSION_OPTIONS.some(option => permissionDraft[option.key]);
    if (!hasArea) {
      setPermissionFeedback({ type: 'danger', text: 'Selecione pelo menos uma área para este admin.' });
      return;
    }

    setIsSavingPermissions(true);
    setPermissionFeedback(null);
    const updated = await updateAdminPermissions(permissionUser.id, permissionDraft);
    setIsSavingPermissions(false);
    if (updated && !updated.__error) {
      if (selectedUser?.id === updated.id) setSelectedUser(updated);
      setPermissionUser(null);
      setFeedback({ type: 'success', text: 'Permissões administrativas guardadas.' });
    } else {
      setPermissionFeedback({ type: 'danger', text: updated?.__error || 'Não foi possível guardar as permissões. Verifique se o backend foi reiniciado e tente novamente.' });
    }
  };

  const removeAdminAccess = async () => {
    setIsSavingPermissions(true);
    setPermissionFeedback(null);
    const updated = await revokeAdminPermissions(permissionUser.id);
    setIsSavingPermissions(false);
    if (updated && !updated.__error) {
      if (selectedUser?.id === updated.id) setSelectedUser(updated);
      setPermissionUser(null);
      setFeedback({ type: 'success', text: 'Acesso administrativo removido.' });
    } else {
      setPermissionFeedback({ type: 'danger', text: updated?.__error || 'Não foi possível remover o acesso administrativo.' });
    }
  };

  return (
    <div>
      <div className="admin-users-header">
        <div>
          <h1 className="page-title">Gestão de Utilizadores</h1>
          <p className="text-secondary" style={{ margin: 0 }}>
            Controlo das contas, verificação, localização, relatórios e permissões administrativas.
          </p>
        </div>
        <div className="admin-users-header-actions">
          <input
            className="qt-input"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Pesquisar por nome, email, plano ou estado..."
          />
          <button type="button" className="btn btn-glass btn-pill" onClick={() => downloadUsersCsv(filteredUsers)}>
            Baixar relatório
          </button>
          <button
            type="button"
            className="btn btn-primary btn-pill"
            onClick={handleReminder}
            disabled={isSendingReminder || adminUserInsights.unverified === 0}
          >
            {isSendingReminder ? 'A enviar...' : 'Lembrar não verificados'}
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`admin-inline-feedback ${feedback.type}`}>
          {feedback.text}
        </div>
      )}

      <div className="dash-card page-filter-bar">
        <span className="filter-result-note">
          {filteredUsers.length} utilizador(es) registado(s) em {getPeriodLabel(periodFilter)}
        </span>
        <PeriodFilter value={periodFilter} onChange={setPeriodFilter} compact />
        <div className="filter-field">
          <label>Estado</label>
          <select className="qt-input" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
            <option value="todos">Todos</option>
            <option value="Ativo">Ativos</option>
            <option value="Bloqueado">Bloqueados</option>
          </select>
        </div>
        <div className="filter-field">
          <label>Email</label>
          <select className="qt-input" value={emailFilter} onChange={event => setEmailFilter(event.target.value)}>
            <option value="todos">Todos</option>
            <option value="verificado">Verificados</option>
            <option value="nao_verificado">Não verificados</option>
          </select>
        </div>
        <div className="filter-field">
          <label>Província</label>
          <select className="qt-input" value={provinceFilter} onChange={event => setProvinceFilter(event.target.value)}>
            <option value="todas">Todas</option>
            <option value="Não informada">Não informada</option>
            {provinceOptions.map(province => (
              <option key={province} value={province}>{province}</option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <label>Género</label>
          <select className="qt-input" value={genderFilter} onChange={event => setGenderFilter(event.target.value)}>
            <option value="todos">Todos</option>
            <option value="feminino">Feminino</option>
            <option value="masculino">Masculino</option>
            <option value="outro">Outro</option>
            <option value="Não informado">Não informado</option>
          </select>
        </div>
      </div>

      <div className="admin-user-insights">
        <div className="admin-user-insight-card">
          <span>Total cadastrados</span>
          <strong>{adminUserInsights.total}</strong>
          <small>Sem contar contas administrativas</small>
        </div>
        <div className="admin-user-insight-card success">
          <span>Email verificado</span>
          <strong>{adminUserInsights.verified}</strong>
          <small>{adminUserInsights.total ? `${Math.round((adminUserInsights.verified / adminUserInsights.total) * 100)}% dos utilizadores` : 'Sem dados'}</small>
        </div>
        <div className="admin-user-insight-card warning">
          <span>Não verificados</span>
          <strong>{adminUserInsights.unverified}</strong>
          <small>Podem receber lembrete por email</small>
        </div>
        <div className="admin-user-insight-card">
          <span>Com localização</span>
          <strong>{adminUserInsights.withLocation}</strong>
          <small>{adminUserInsights.total ? `${Math.round((adminUserInsights.withLocation / adminUserInsights.total) * 100)}% dos utilizadores` : 'Sem dados'}</small>
        </div>
        <div className="admin-user-insight-card">
          <span>Sem localização</span>
          <strong>{adminUserInsights.withoutLocation}</strong>
          <small>Podem completar depois no Perfil</small>
        </div>
        <div className="admin-user-insight-card">
          <span>Com dispositivo</span>
          <strong>{adminUserInsights.withDevices}</strong>
          <small>Útil para suporte e segurança</small>
        </div>
        <div className="admin-user-insight-card wide">
          <span>Utilizadores por província</span>
          <div className="province-report-list">
            {adminUserInsights.provinceRanking.slice(0, 5).map(item => (
              <div key={item.name}>
                <strong>{item.name}</strong>
                <em>{item.count}</em>
              </div>
            ))}
            {adminUserInsights.provinceRanking.length === 0 && <small>Sem dados para apresentar.</small>}
          </div>
        </div>
        <div className="admin-user-insight-card wide">
          <span>Distribuição por género</span>
          <div className="province-report-list">
            {Object.entries(adminUserInsights.genderCounts).map(([name, count]) => (
              <div key={name}>
                <strong>{name}</strong>
                <em>{count}</em>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1240px' }}>
            <thead>
              <tr style={{ background: '#f8f9fc', borderBottom: '1px solid var(--glass-border)' }}>
                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)' }}>Utilizador</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)' }}>Plano</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)' }}>Email</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)' }}>Localização</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)' }}>Estado</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)' }}>Validade</th>
                <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-secondary)' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Nenhum utilizador encontrado.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const remaining = daysUntil(user.dataExpiracao);
                  const isExpiring = remaining !== null && remaining >= 0 && remaining <= 7;
                  const isExpired = remaining !== null && remaining < 0;
                  const isAdminUser = user.plano === 'Admin';
                  const isCurrentUser = usuario?.id === user.id;
                  const isDelegatedAdmin = isAdminUser && Object.keys(user.adminPermissions || {}).length > 0;

                  return (
                    <tr key={user.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                      <td style={{ padding: '1rem' }}>
                        <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{user.nome}</strong>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{user.email}</span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span className={`admin-plan-pill ${user.plano === 'Premium' ? 'premium' : isAdminUser ? 'admin' : ''}`}>
                          {isDelegatedAdmin ? 'Admin delegado' : user.plano}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ color: user.emailVerificado ? 'var(--success-color)' : '#d97706', fontWeight: 800 }}>
                          {user.emailVerificado ? 'Verificado' : 'Não verificado'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
                        <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{user.provincia || 'Não informada'}</strong>
                        <span>{[user.municipio, user.cidade].filter(Boolean).join(', ') || 'Sem detalhe'}</span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ color: user.status === 'Ativo' ? 'var(--success-color)' : 'var(--danger-color)', fontWeight: 800 }}>
                          {user.status}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', color: isExpired ? 'var(--danger-color)' : isExpiring ? '#d97706' : 'var(--text-secondary)', fontWeight: isExpired || isExpiring ? 800 : 500 }}>
                        {isAdminUser ? 'Admin' : remaining === null ? 'Sem data' : isExpired ? 'Expirado' : `${remaining} dia(s)`}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <div className="admin-user-row-actions">
                          <button type="button" onClick={() => setSelectedUser(user)} className="btn btn-glass">
                            Perfil 360
                          </button>
                          {!user.emailVerificado && !isAdminUser && (
                            <button type="button" onClick={() => handleResendCode(user.id)} className="btn btn-glass warning">
                              Reenviar código
                            </button>
                          )}
                          {user.emailVerificado && !isCurrentUser && (
                            <button type="button" onClick={() => openPermissionModal(user)} className="btn btn-glass">
                              {isAdminUser ? 'Permissões' : 'Tornar admin'}
                            </button>
                          )}
                          {user.plano !== 'Premium' && !isAdminUser && (
                            <button type="button" onClick={() => setPendingAction({ type: 'premium', user })} className="btn btn-primary">
                              Dar Premium
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(user)}
                            disabled={isAdminUser}
                            className={`btn ${user.status === 'Ativo' ? 'danger-soft' : 'success-soft'}`}
                          >
                            {user.status === 'Ativo' ? 'Bloquear' : 'Ativar'}
                          </button>
                          {!isAdminUser && (
                            <button type="button" onClick={() => setPendingAction({ type: 'delete', user })} className="btn danger-soft">
                              Eliminar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={Boolean(selectedUser)} onClose={() => setSelectedUser(null)} title="Perfil 360" maxWidth="620px">
        {selectedUser && (
          <div className="admin-profile360">
            <div className="admin-profile360-header">
              <div className="admin-profile360-avatar">
                {selectedUser.foto ? (
                  <img src={selectedUser.foto} alt={selectedUser.nome} />
                ) : (
                  <span>{selectedUser.nome?.charAt(0)?.toUpperCase() || 'U'}</span>
                )}
              </div>
              <div>
                <strong>{selectedUser.nome}</strong>
                <span>{selectedUser.email}</span>
              </div>
              <em>{selectedUser.status}</em>
            </div>

            <div className="admin-profile360-grid">
              <div><span>Plano</span><strong>{selectedUser.plano}</strong></div>
              <div><span>Email</span><strong>{selectedUser.emailVerificado ? 'Verificado' : 'Não verificado'}</strong></div>
              <div><span>Validade</span><strong>{selectedUser.plano === 'Admin' ? 'Admin' : profileDaysLeft === null ? 'Sem data' : `${profileDaysLeft} dia(s)`}</strong></div>
              <div><span>Registo</span><strong>{formatDate(selectedUser.dataRegisto)}</strong></div>
              <div><span>Profissão</span><strong>{selectedUser.ocupacao || 'Não informada'}</strong></div>
              <div><span>Género</span><strong>{selectedUser.genero || 'Não informado'}</strong></div>
              <div><span>Localização</span><strong>{[selectedUser.provincia, selectedUser.municipio, selectedUser.cidade].filter(Boolean).join(', ') || 'Não informada'}</strong></div>
              <div><span>Dispositivos</span><strong>{selectedUser.totalDispositivos || 0}</strong></div>
              <div><span>Último acesso</span><strong>{formatDateTime(selectedUser.ultimoLogin)}</strong></div>
              <div><span>Último dispositivo</span><strong>{selectedUser.ultimoDispositivo || 'Não identificado'}</strong></div>
              <div><span>IP recente</span><strong>{selectedUser.ultimoIp || 'Não registado'}</strong></div>
              <div><span>Admin concedido por</span><strong>{selectedUser.adminGrantedBy || 'Não aplicável'}</strong></div>
              <div><span>Permissões admin</span><strong>{ADMIN_PERMISSION_OPTIONS.filter(option => selectedUser.adminPermissions?.[option.key]).map(option => option.label).join(', ') || 'Acesso total ou não aplicável'}</strong></div>
              <div><span>Navegador / User-Agent</span><strong>{selectedUser.ultimoUserAgent || 'Não registado'}</strong></div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              {!selectedUser.emailVerificado && selectedUser.plano !== 'Admin' && (
                <button type="button" className="btn btn-glass btn-pill" onClick={() => handleResendCode(selectedUser.id)} style={{ color: '#d97706' }}>
                  Reenviar código de email
                </button>
              )}
              {selectedUser.emailVerificado && usuario?.id !== selectedUser.id && (
                <button type="button" className="btn btn-glass btn-pill" onClick={() => openPermissionModal(selectedUser)}>
                  Gerir permissões
                </button>
              )}
              {selectedUser.plano !== 'Premium' && selectedUser.plano !== 'Admin' && (
                <button type="button" className="btn btn-primary btn-pill" onClick={() => setPendingAction({ type: 'premium', user: selectedUser })}>
                  Dar Premium
                </button>
              )}
              {selectedUser.plano !== 'Admin' && (
                <button type="button" className="btn btn-glass btn-pill" onClick={() => handleToggleStatus(selectedUser)} style={{ color: selectedUser.status === 'Ativo' ? 'var(--danger-color)' : 'var(--success-color)' }}>
                  {selectedUser.status === 'Ativo' ? 'Bloquear conta' : 'Ativar conta'}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={Boolean(permissionUser)} onClose={() => setPermissionUser(null)} title="Permissões administrativas" maxWidth="560px">
        {permissionUser && (
          <div className="admin-permission-modal">
            <div className="admin-permission-user">
              <strong>{permissionUser.nome}</strong>
              <span>{permissionUser.email}</span>
              {!permissionUser.emailVerificado && <em>Este utilizador precisa verificar o email primeiro.</em>}
            </div>

            {permissionFeedback && (
              <div className={`admin-inline-feedback ${permissionFeedback.type}`}>
                {permissionFeedback.text}
              </div>
            )}

            <div className="admin-permission-list">
              {ADMIN_PERMISSION_OPTIONS.map(option => (
                <label key={option.key} className="admin-permission-option">
                  <input
                    type="checkbox"
                    checked={Boolean(permissionDraft[option.key])}
                    onChange={event => setPermissionDraft(prev => ({ ...prev, [option.key]: event.target.checked }))}
                    disabled={!permissionUser.emailVerificado}
                  />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                </label>
              ))}
            </div>

            <div className="admin-permission-actions">
              <button type="button" className="btn btn-glass btn-pill" onClick={() => setPermissionUser(null)}>
                Cancelar
              </button>
              {permissionUser.plano === 'Admin' && Object.keys(permissionUser.adminPermissions || {}).length > 0 && (
                <button type="button" className="btn danger-soft btn-pill" onClick={removeAdminAccess}>
                  Remover admin
                </button>
              )}
              <button type="button" className="btn btn-primary btn-pill" onClick={savePermissions} disabled={!permissionUser.emailVerificado || isSavingPermissions}>
                {isSavingPermissions ? 'A guardar...' : 'Guardar permissões'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={Boolean(pendingAction)} onClose={() => setPendingAction(null)} title={actionTitle}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 1.25rem 0' }}>
            {actionText}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-glass btn-pill" onClick={() => setPendingAction(null)}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary btn-pill" onClick={confirmAction}>
              Confirmar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
