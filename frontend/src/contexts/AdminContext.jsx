import React, { createContext, useContext, useState } from 'react';
import { apiFetch } from '../utils/api';

const AdminContext = createContext();

export function useAdmin() {
  return useContext(AdminContext);
}

export function AdminProvider({ children, isAdmin = false }) {
  const [users, setUsers] = useState([]);
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
    assistantUnread: 0
  });

  const loadAdminData = React.useCallback(async () => {
    if (!isAdmin) return;

    setIsLoadingAdmin(true);
    try {
      const [statsRes, usersRes, logsRes, paymentsRes, assistantRes] = await Promise.all([
        apiFetch('/api/admin/stats'),
        apiFetch('/api/admin/users'),
        apiFetch('/api/admin/logs'),
        apiFetch('/api/admin/payments/pending'),
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
          assistantUnread: data.assistantUnread || 0
        });
      }

      if (usersRes.ok) {
        const data = await usersRes.json();
        const planMap = { premium: 'Premium', free: 'Grátis', admin: 'Admin' };
        setUsers(data.map(user => ({
          id: user.id,
          nome: user.name,
          email: user.email,
          ocupacao: user.occupation || '',
          plano: planMap[user.plan_type] || user.plan_type,
          status: user.status === 'active' ? 'Ativo' : 'Bloqueado',
          dataRegisto: user.created_at,
          dataExpiracao: user.plan_expires_at
        })));
      }

      if (paymentsRes.ok) {
        const data = await paymentsRes.json();
        setPendingPayments(data.map(payment => {
          const plano = payment.plan_requested === 'semestral' ? 'semestral' : 'anual';
          return {
            id: payment.id,
            userId: payment.user_id,
            nome: payment.user_name,
            email: payment.user_email,
            banco: 'Comprovativo enviado',
            plano,
            valor: plano === 'semestral' ? planPrices.semestral : planPrices.anual,
            comprovativoUrl: payment.proof_image,
            dataSubmissao: payment.submitted_at ? new Date(payment.submitted_at).toLocaleString('pt-AO') : ''
          };
        }));
      }

      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.map(log => ({
          id: log.id,
          data: new Date(log.created_at).toLocaleString('pt-AO'),
          acao: log.description,
          tipo: log.action_type
        })));
      }

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
    const payment = pendingPayments.find(item => item.id === paymentId);
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
      addLog(`Aprovado pagamento ${payment.plano} de ${payment.nome}`, 'success');
      await loadAdminData();
    } catch (err) {
      console.error('Erro ao aprovar pagamento:', err);
      alert(err.message);
    }
  };

  const rejectPayment = async (paymentId) => {
    const payment = pendingPayments.find(item => item.id === paymentId);
    if (!payment) return;

    try {
      const response = await apiFetch(`/api/admin/payments/${paymentId}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao rejeitar pagamento.');

      addLog(`Rejeitado comprovativo de pagamento de ${payment.nome}`, 'danger');
      setPendingPayments(prev => prev.filter(item => item.id !== paymentId));
      await loadAdminData();
    } catch (err) {
      console.error('Erro ao rejeitar pagamento:', err);
      alert(err.message);
    }
  };

  const toggleUserStatus = (userId) => {
    setUsers(prev => prev.map(user => {
      if (user.id === userId) {
        const novoStatus = user.status === 'Ativo' ? 'Bloqueado' : 'Ativo';
        addLog(`Estado da conta de ${user.nome} alterado para ${novoStatus}`, novoStatus === 'Ativo' ? 'success' : 'danger');
        return { ...user, status: novoStatus };
      }
      return user;
    }));
  };

  const changeUserPlan = (userId, novoPlano) => {
    setUsers(prev => prev.map(user => {
      if (user.id === userId) {
        addLog(`Plano de ${user.nome} alterado manualmente para ${novoPlano}`, 'info');
        return { ...user, plano: novoPlano, status: 'Ativo' };
      }
      return user;
    }));
  };

  const value = {
    users,
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
    changeUserPlan
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
}
