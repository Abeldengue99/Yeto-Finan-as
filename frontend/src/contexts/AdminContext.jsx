import React, { createContext, useContext, useState } from 'react';
import { apiFetch } from '../utils/api';

const AdminContext = createContext();

export function useAdmin() {
  return useContext(AdminContext);
}

function mapAdminUser(user) {
  const planMap = { premium: 'Premium', free: 'Grátis', admin: 'Admin' };

  return {
    id: user.id,
    nome: user.name,
    email: user.email,
    emailVerificado: Boolean(user.email_verified),
    foto: user.avatar_url || '',
    ocupacao: user.occupation || '',
    genero: user.gender || '',
    provincia: user.province || '',
    municipio: user.municipality || '',
    cidade: user.city || '',
    ultimoLogin: user.last_login_at || '',
    ultimoIp: user.last_login_ip || '',
    ultimoDispositivo: user.last_login_device || '',
    ultimoUserAgent: user.last_login_user_agent || '',
    totalDispositivos: Number(user.device_count || 0),
    ultimoDispositivoEm: user.last_device_seen_at || '',
    atualizadoEm: user.updated_at || '',
    adminPermissions: user.admin_permissions || {},
    adminGrantedAt: user.admin_granted_at || '',
    adminPermissionsUpdatedAt: user.admin_permissions_updated_at || '',
    adminGrantedBy: user.admin_granted_by_name || '',
    plano: planMap[user.plan_type] || user.plan_type,
    pacote: user.subscription_plan || user.plan_type,
    status: user.status === 'active' ? 'Ativo' : 'Bloqueado',
    dataRegisto: user.created_at,
    dataExpiracao: user.plan_expires_at
  };
}

export function AdminProvider({ children, isAdmin = false }) {
  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [assistantConversations, setAssistantConversations] = useState([]);
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(false);
  const [lastAdminRefresh, setLastAdminRefresh] = useState(null);
  const [planPrices, setPlanPrices] = useState({
    semestral: 4999,
    anual: 7999
  });

  const [systemSettings, setSystemSettings] = useState({
    maintenanceMode: false,
    allowRegistrations: true,
    globalAlert: { active: false, type: 'info', message: '' }
  });
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    premiumUsers: 0,
    pendingApprovals: 0,
    mrr: 0,
    conversionRate: 0,
    blockedUsers: 0,
    expiredUsers: 0,
    expiringSoon: 0,
    newUsers7d: 0,
    newUsersToday: 0,
    verifiedUsers: 0,
    unverifiedUsers: 0,
    assistantUnread: 0
  });

  const loadAdminData = React.useCallback(async () => {
    if (!isAdmin) return;

    setIsLoadingAdmin(true);
    try {
      let loadedUsers = [];
      let loadedLogs = [];
      const [statsRes, usersRes, logsRes, paymentsRes, assistantRes] = await Promise.all([
        apiFetch('/api/admin/stats'),
        apiFetch('/api/admin/users'),
        apiFetch('/api/admin/logs'),
        apiFetch('/api/admin/payments'),
        apiFetch('/api/assistant/conversations')
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats({
          totalUsers: data.totalUsers || 0,
          premiumUsers: data.activeSubscriptions || 0,
          pendingApprovals: data.pendingApprovals || 0,
          mrr: data.monthlyRevenue || 0,
          conversionRate: data.conversionRate || 0,
          blockedUsers: data.blockedUsers || 0,
          expiredUsers: data.expiredUsers || 0,
          expiringSoon: data.expiringSoon || 0,
          newUsers7d: data.newUsers7d || 0,
          newUsersToday: data.newUsersToday || 0,
          verifiedUsers: data.verifiedUsers || 0,
          unverifiedUsers: data.unverifiedUsers || 0,
          assistantUnread: data.assistantUnread || 0
        });
      }

      if (usersRes.ok) {
        const data = await usersRes.json();
        loadedUsers = data;
        const planMap = { premium: 'Premium', free: 'Grátis', admin: 'Admin' };
        void planMap;
        setUsers(data.map(mapAdminUser));
      }

      if (paymentsRes.ok) {
        const data = await paymentsRes.json();
        const mappedPayments = data.map(payment => {
          const plano = payment.plan_requested === 'semestral' ? 'semestral' : 'anual';
          return {
            id: payment.id,
            userId: payment.user_id,
            nome: payment.user_name,
            email: payment.user_email,
            banco: 'Comprovativo enviado',
            plano,
            valor: plano === 'semestral' ? planPrices.semestral : planPrices.anual,
            status: payment.status || 'pending',
            motivoRejeicao: payment.rejection_reason || '',
            aprovadoPor: payment.approved_by_name || '',
            rejeitadoPor: payment.rejected_by_name || '',
            comprovativoUrl: payment.proof_image,
            dataSubmissaoRaw: payment.submitted_at,
            dataSubmissao: payment.submitted_at ? new Date(payment.submitted_at).toLocaleString('pt-AO') : '',
            dataAprovacaoRaw: payment.approved_at,
            dataAprovacao: payment.approved_at ? new Date(payment.approved_at).toLocaleString('pt-AO') : '',
            dataRejeicaoRaw: payment.rejected_at,
            dataRejeicao: payment.rejected_at ? new Date(payment.rejected_at).toLocaleString('pt-AO') : ''
          };
        });
        setPayments(mappedPayments);
        setPendingPayments(mappedPayments.filter(payment => payment.status === 'pending'));
      }

      if (logsRes.ok) {
        const data = await logsRes.json();
        loadedLogs = data.map(log => ({
          id: log.id,
          dataRaw: log.created_at,
          data: new Date(log.created_at).toLocaleString('pt-AO'),
          acao: log.description,
          tipo: log.action_type
        }));
      }

      if (loadedLogs.length === 0 && loadedUsers.length > 0) {
        loadedLogs = loadedUsers
          .filter(user => user.plan_type !== 'admin')
          .map(user => ({
            id: `user-${user.id}`,
            dataRaw: user.created_at,
            data: user.created_at ? new Date(user.created_at).toLocaleString('pt-AO') : '',
            acao: `Conta criada: ${user.name || user.email}`,
            tipo: 'user_created'
          }));
      }

      setLogs(loadedLogs);

      if (assistantRes.ok) {
        const data = await assistantRes.json();
        setAssistantConversations(data.conversations || []);
      }

      setLastAdminRefresh(new Date().toISOString());
    } catch (err) {
      console.error('Erro ao carregar dados admin:', err);
    } finally {
      setIsLoadingAdmin(false);
    }
  }, [isAdmin, planPrices.anual, planPrices.semestral]);

  React.useEffect(() => {
    if (!isAdmin) {
      setUsers([]);
      setPayments([]);
      setPendingPayments([]);
      setAssistantConversations([]);
      return undefined;
    }

    loadAdminData();
    const intervalId = setInterval(loadAdminData, 30000);
    return () => clearInterval(intervalId);
  }, [isAdmin, loadAdminData]);

  const getStats = () => stats;

  const addLog = (acao, tipo = 'info') => {
    const newLog = {
      id: Date.now(),
      data: new Date().toLocaleString('pt-AO'),
      acao,
      tipo
    };
    setLogs(prev => [newLog, ...prev]);
  };

  const approvePayment = async (paymentId) => {
    const payment = payments.find(item => item.id === paymentId) || pendingPayments.find(item => item.id === paymentId);
    if (!payment) return;

    try {
      const response = await apiFetch(`/api/admin/payments/${paymentId}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao aprovar pagamento.');

      setUsers(prev => prev.map(user => (
        user.id === payment.userId
          ? { ...user, plano: 'Premium', status: 'Ativo', dataExpiracao: data.user?.plan_expires_at }
          : user
      )));
      setPendingPayments(prev => prev.filter(item => item.id !== paymentId));
      setPayments(prev => prev.map(item => item.id === paymentId ? { ...item, status: 'approved', dataAprovacaoRaw: new Date().toISOString() } : item));
      addLog(`Aprovado pagamento ${payment.plano} de ${payment.nome}`, 'success');
      await loadAdminData();
    } catch (err) {
      console.error('Erro ao aprovar pagamento:', err);
      addLog(err.message, 'danger');
    }
  };

  const rejectPayment = async (paymentId, reason = '') => {
    const payment = payments.find(item => item.id === paymentId) || pendingPayments.find(item => item.id === paymentId);
    if (!payment) return;

    try {
      const response = await apiFetch(`/api/admin/payments/${paymentId}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao rejeitar pagamento.');

      addLog(`Rejeitado comprovativo de pagamento de ${payment.nome}`, 'danger');
      setPendingPayments(prev => prev.filter(item => item.id !== paymentId));
      setPayments(prev => prev.map(item => item.id === paymentId ? { ...item, status: 'rejected', motivoRejeicao: reason, dataRejeicaoRaw: new Date().toISOString() } : item));
      await loadAdminData();
      return true;
    } catch (err) {
      console.error('Erro ao rejeitar pagamento:', err);
      addLog(err.message, 'danger');
      return false;
    }
  };

  const toggleUserStatus = async (userId) => {
    const user = users.find(item => item.id === userId);
    if (!user) return null;

    const nextStatus = user.status === 'Ativo' ? 'blocked' : 'active';

    try {
      const response = await apiFetch(`/api/admin/users/${userId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao atualizar estado do utilizador.');

      const updated = mapAdminUser(data.user);
      setUsers(prev => prev.map(item => item.id === userId ? updated : item));
      await loadAdminData();
      return updated;
    } catch (err) {
      console.error('Erro ao atualizar estado:', err);
      addLog(err.message, 'danger');
      return null;
    }
  };

  const changeUserPlan = async (userId, novoPlano) => {
    if (novoPlano !== 'Premium') return null;

    try {
      const response = await apiFetch(`/api/admin/users/${userId}/premium`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao conceder Premium.');

      const updated = mapAdminUser(data.user);
      setUsers(prev => prev.map(item => item.id === userId ? updated : item));
      await loadAdminData();
      return updated;
    } catch (err) {
      console.error('Erro ao conceder Premium:', err);
      addLog(err.message, 'danger');
      return null;
    }
  };

  const deleteUser = async (userId) => {
    try {
      const response = await apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Erro ao eliminar utilizador.');

      setUsers(prev => prev.filter(user => user.id !== userId));
      await loadAdminData();
      return true;
    } catch (err) {
      console.error('Erro ao eliminar utilizador:', err);
      addLog(err.message, 'danger');
      return false;
    }
  };

  const resendVerificationCode = async (userId) => {
    try {
      const response = await apiFetch(`/api/admin/users/${userId}/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Erro ao reenviar código.');

      addLog(data.message || 'Código de verificação reenviado.', 'success');
      await loadAdminData();
      return true;
    } catch (err) {
      console.error('Erro ao reenviar verificação:', err);
      addLog(err.message, 'danger');
      return false;
    }
  };

  const remindUnverifiedUsers = async () => {
    try {
      const response = await apiFetch('/api/admin/users/remind-unverified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Erro ao enviar lembretes.');

      addLog(data.message || 'Lembretes enviados.', 'success');
      await loadAdminData();
      return data;
    } catch (err) {
      console.error('Erro ao enviar lembretes:', err);
      addLog(err.message, 'danger');
      return null;
    }
  };

  const updateAdminPermissions = async (userId, permissions) => {
    try {
      const response = await apiFetch(`/api/admin/admin-access/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Erro ao guardar permissoes.');

      const updated = mapAdminUser(data.user);
      setUsers(prev => prev.map(item => item.id === userId ? updated : item));
      await loadAdminData();
      return updated;
    } catch (err) {
      console.error('Erro ao guardar permissoes admin:', err);
      addLog(err.message, 'danger');
      return { __error: err.message };
    }
  };

  const revokeAdminPermissions = async (userId) => {
    try {
      const response = await apiFetch(`/api/admin/admin-access/${userId}`, {
        method: 'DELETE'
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Erro ao remover acesso admin.');

      const updated = mapAdminUser(data.user);
      setUsers(prev => prev.map(item => item.id === userId ? updated : item));
      await loadAdminData();
      return updated;
    } catch (err) {
      console.error('Erro ao remover acesso admin:', err);
      addLog(err.message, 'danger');
      return { __error: err.message };
    }
  };

  const value = {
    users,
    payments,
    pendingPayments,
    assistantConversations,
    isLoadingAdmin,
    lastAdminRefresh,
    planPrices,
    setPlanPrices,
    systemSettings,
    setSystemSettings,
    logs,
    addLog,
    loadAdminData,
    getStats,
    approvePayment,
    rejectPayment,
    toggleUserStatus,
    changeUserPlan,
    deleteUser,
    resendVerificationCode,
    remindUnverifiedUsers,
    updateAdminPermissions,
    revokeAdminPermissions
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
}
