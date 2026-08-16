import React, { createContext, useContext, useState } from 'react';
import { apiFetch } from '../utils/api';

const AdminContext = createContext();

export function useAdmin() {
  return useContext(AdminContext);
}

export function AdminProvider({ children, isAdmin = false }) {
  const [users, setUsers] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
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
  });

  const loadAdminData = async () => {
    try {
      const [statsRes, usersRes, logsRes, paymentsRes] = await Promise.all([
        apiFetch('/api/admin/stats'),
        apiFetch('/api/admin/users'),
        apiFetch('/api/admin/logs'),
        apiFetch('/api/admin/payments/pending')
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats({
          totalUsers: data.totalUsers,
          premiumUsers: data.activeSubscriptions,
          pendingApprovals: data.pendingApprovals,
          mrr: data.monthlyRevenue
        });
      }

      if (usersRes.ok) {
        const data = await usersRes.json();
        const planMap = { premium: 'Premium', free: 'Grátis', admin: 'Admin' };
        setUsers(data.map(u => ({
          id: u.id,
          nome: u.name,
          email: u.email,
          plano: planMap[u.plan_type] || u.plan_type,
          status: u.status === 'active' ? 'Ativo' : 'Bloqueado',
          dataRegisto: u.created_at,
          dataExpiracao: u.plan_expires_at
        })));
      }

      if (paymentsRes.ok) {
        const data = await paymentsRes.json();
        setPendingPayments(data.map(p => {
          const plano = p.plan_requested === 'semestral' ? 'semestral' : 'anual';
          return {
            id: p.id,
            userId: p.user_id,
            nome: p.user_name,
            email: p.user_email,
            banco: 'Comprovativo enviado',
            plano,
            valor: plano === 'semestral' ? planPrices.semestral : planPrices.anual,
            comprovativoUrl: p.proof_image,
            dataSubmissao: p.submitted_at ? new Date(p.submitted_at).toLocaleString() : ''
          };
        }));
      }

      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.map(l => ({
          id: l.id,
          data: new Date(l.created_at).toLocaleString(),
          acao: l.description,
          tipo: l.action_type
        })));
      }
    } catch (err) {
      console.error('Erro ao carregar dados admin:', err);
    }
  };

  React.useEffect(() => {
    if (isAdmin) {
      loadAdminData();
    }
  }, [isAdmin]);

  const getStats = () => stats;

  const addLog = (acao, tipo = 'info') => {
    const newLog = {
      id: Date.now(),
      data: new Date().toLocaleString(),
      acao,
      tipo
    };
    setLogs(prev => [newLog, ...prev]);
  };

  const approvePayment = async (paymentId) => {
    const payment = pendingPayments.find(p => p.id === paymentId);
    if (!payment) return;

    try {
      const response = await apiFetch(`/api/admin/payments/${paymentId}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao aprovar pagamento.');

      setUsers(users.map(u => (
        u.id === payment.userId
          ? { ...u, plano: 'Premium', status: 'Ativo', dataExpiracao: data.user?.plan_expires_at }
          : u
      )));
      setPendingPayments(pendingPayments.filter(p => p.id !== paymentId));
      addLog(`Aprovado pagamento ${payment.plano} de ${payment.nome}`, 'success');
      await loadAdminData();
    } catch (err) {
      console.error('Erro ao aprovar pagamento:', err);
      alert(err.message);
    }
  };

  const rejectPayment = async (paymentId) => {
    const payment = pendingPayments.find(p => p.id === paymentId);
    if (!payment) return;

    try {
      const response = await apiFetch(`/api/admin/payments/${paymentId}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao rejeitar pagamento.');

      addLog(`Rejeitado comprovativo de pagamento de ${payment.nome}`, 'danger');
      setPendingPayments(pendingPayments.filter(p => p.id !== paymentId));
      await loadAdminData();
    } catch (err) {
      console.error('Erro ao rejeitar pagamento:', err);
      alert(err.message);
    }
  };

  const toggleUserStatus = (userId) => {
    setUsers(users.map(u => {
      if (u.id === userId) {
        const novoStatus = u.status === 'Ativo' ? 'Bloqueado' : 'Ativo';
        addLog(`Estado da conta de ${u.nome} alterado para ${novoStatus}`, novoStatus === 'Ativo' ? 'success' : 'danger');
        return { ...u, status: novoStatus };
      }
      return u;
    }));
  };

  const changeUserPlan = (userId, novoPlano) => {
    setUsers(users.map(u => {
      if (u.id === userId) {
        addLog(`Plano de ${u.nome} alterado manualmente para ${novoPlano}`, 'info');
        return { ...u, plano: novoPlano, status: 'Ativo' };
      }
      return u;
    }));
  };

  const value = {
    users,
    pendingPayments,
    planPrices,
    setPlanPrices,
    systemSettings,
    setSystemSettings,
    logs,
    addLog,
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
