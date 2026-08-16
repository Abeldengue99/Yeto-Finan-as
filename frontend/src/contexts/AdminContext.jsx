import React, { createContext, useContext, useState } from 'react';

const AdminContext = createContext();

export function useAdmin() {
  return useContext(AdminContext);
}

export function AdminProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [premiumPrice, setPremiumPrice] = useState(5999);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    premiumUsers: 0,
    pendingApprovals: 0,
    mrr: 0,
  });

  const loadAdminData = async () => {
    try {
      const [statsRes, usersRes, logsRes] = await Promise.all([
        fetch('http://localhost:5000/api/admin/stats'),
        fetch('http://localhost:5000/api/admin/users'),
        fetch('http://localhost:5000/api/admin/logs')
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
          dataRegisto: u.created_at
        })));
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
    loadAdminData();
  }, []);

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

  const approvePayment = (paymentId) => {
    const payment = pendingPayments.find(p => p.id === paymentId);
    if (!payment) return;

    // Atualiza o plano do utilizador para Premium
    setUsers(users.map(u => u.id === payment.userId ? { ...u, plano: 'Premium', status: 'Ativo' } : u));
    
    // Remove dos pendentes
    setPendingPayments(pendingPayments.filter(p => p.id !== paymentId));
    
    addLog(`Aprovado pagamento Premium de ${payment.nome} (${premiumPrice} Kz)`, 'success');
  };

  const rejectPayment = (paymentId) => {
    const payment = pendingPayments.find(p => p.id === paymentId);
    if (payment) addLog(`Rejeitado comprovativo de pagamento de ${payment.nome}`, 'danger');
    setPendingPayments(pendingPayments.filter(p => p.id !== paymentId));
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
    premiumPrice,
    setPremiumPrice,
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
