import { useState, useCallback, useEffect } from 'react';
import './index.css';
import DashboardLayout from './layouts/DashboardLayout';
import { FinanceProvider } from './contexts/FinanceContext';
import { AdminProvider } from './contexts/AdminContext';
import LoginScreen from './pages/LoginScreen';
import PwaInstallPrompt from './components/PwaInstallPrompt';
import useInactivityTimer from './hooks/useInactivityTimer';
import { clearSession, saveSession } from './utils/api';

// Importação das Páginas do Sistema
import DashboardHome from './pages/DashboardHome';
import Bancos from './pages/Bancos';
import Transacoes from './pages/Transacoes';
import Dividas from './pages/Dividas';
import Orcamento from './pages/Orcamento';
import CalendarioFinanceiro from './pages/CalendarioFinanceiro';
import PrevisaoEmergencia from './pages/PrevisaoEmergencia';
import ListaCompras from './pages/ListaCompras';
import Projetos from './pages/Projetos';
import Kixikila from './pages/Kixikila';
import Divisas from './pages/Divisas';
import PagamentosFixos from './pages/PagamentosFixos';
import Planos from './pages/Planos';
import Gamificacao from './pages/Gamificacao';
import Assistente from './pages/Assistente';

// Importação das Páginas de Admin
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminPayments from './pages/admin/AdminPayments';
import AdminSettings from './pages/admin/AdminSettings';
import AdminLogs from './pages/admin/AdminLogs';
import AdminGamification from './pages/admin/AdminGamification';

// Tempo máximo de sessão inativa offline: 2 horas
const SESSION_MAX_AGE_MS = 2 * 60 * 60 * 1000;

// Tempo de inatividade dentro do sistema: 30 minutos
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
const FALLBACK_ADMIN_ID = '00000000-0000-0000-0000-000000000000';
const ADMIN_TAB_PERMISSIONS = {
  admin_dashboard: 'dashboard',
  admin_users: 'users',
  admin_payments: 'payments',
  admin_settings: 'settings',
  admin_gamification: 'reports',
  admin_logs: 'reports',
  assistente: 'assistant'
};
const ADMIN_TAB_ORDER = ['admin_dashboard', 'admin_users', 'admin_payments', 'assistente', 'admin_gamification', 'admin_logs', 'admin_settings'];

function getAdminPermissions(user) {
  if (user?.id === FALLBACK_ADMIN_ID) return { all: true };
  return user?.admin_permissions || user?.adminPermissions || {};
}

function canOpenAdminTab(user, tab) {
  const permission = ADMIN_TAB_PERMISSIONS[tab];
  if (!permission || user?.plan_type !== 'admin') return false;
  const permissions = getAdminPermissions(user);
  return Boolean(permissions.all || permissions.all_access || permissions[permission]);
}

function getInitialAdminTab(user) {
  return ADMIN_TAB_ORDER.find(tab => canOpenAdminTab(user, tab)) || 'dashboard';
}

function App() {
  // Inicialização síncrona — valida sessão e expiração antes de renderizar
  const getInitialUser = () => {
    const savedUser = localStorage.getItem('yeto_user');
    const sessionTimestamp = localStorage.getItem('yeto_session_time');

    if (savedUser && sessionTimestamp) {
      try {
        const elapsed = Date.now() - Number(sessionTimestamp);

        // Sessão expirada — limpar e exigir novo login
        if (elapsed > SESSION_MAX_AGE_MS) {
          clearSession();
          return null;
        }

        const parsedUser = JSON.parse(savedUser);
        if (!parsedUser.token && !localStorage.getItem('yeto_token')) {
          clearSession();
          return null;
        }

        return parsedUser;
      } catch (err) {
        clearSession();
      }
    }

    // Se não houver timestamp, a sessão é inválida (legado ou corrompida)
    if (savedUser && !sessionTimestamp) {
      clearSession();
      return null;
    }

    return null;
  };

  const initialUser = getInitialUser();
  const initialIsAdmin = initialUser ? initialUser.plan_type === 'admin' : false;

  const [user, setUser] = useState(initialUser);
  const [isAdmin, setIsAdmin] = useState(initialIsAdmin);
  const [showDashboard, setShowDashboard] = useState(initialUser !== null);
  const [activeTab, setActiveTab] = useState(initialIsAdmin ? getInitialAdminTab(initialUser) : 'dashboard');

  const handleUserHydrated = useCallback((hydratedUser) => {
    if (!hydratedUser?.id) return;

    setUser(prev => {
      if (!prev || prev.id !== hydratedUser.id) return prev;
      const nextUser = {
        ...prev,
        ...hydratedUser,
        admin_permissions: hydratedUser.admin_permissions || prev.admin_permissions || {}
      };
      saveSession(nextUser);
      return nextUser;
    });
    setIsAdmin(hydratedUser.plan_type === 'admin');
  }, []);

  useEffect(() => {
    const isAdminTab = Boolean(ADMIN_TAB_PERMISSIONS[activeTab]);

    if (!isAdmin && isAdminTab) {
      setActiveTab('dashboard');
      return;
    }

    if (isAdmin) {
      const firstAdminTab = getInitialAdminTab(user);
      if (isAdminTab && !canOpenAdminTab(user, activeTab)) {
        setActiveTab(firstAdminTab);
      }
    }
  }, [activeTab, isAdmin, user]);

  // Logout centralizado — usado tanto pelo botão como pelo timer de inatividade
  const handleLogout = useCallback(() => {
    clearSession();
    setShowDashboard(false);
    setUser(null);
    setIsAdmin(false);
  }, []);

  // Timer de inatividade — 30 minutos sem interação = logout automático
  useInactivityTimer(handleLogout, INACTIVITY_TIMEOUT_MS);

  const renderContent = () => {
    switch(activeTab) {
      case 'dashboard': return <DashboardHome isAdmin={isAdmin} setActiveTab={setActiveTab} />;
      case 'bancos': return <Bancos />;
      case 'transacoes': return <Transacoes />;
      case 'dividas': return <Dividas />;
      case 'orcamento': return <Orcamento />;
      case 'calendario': return <CalendarioFinanceiro />;
      case 'previsao': return <PrevisaoEmergencia />;
      case 'lista_compras': return <ListaCompras />;
      case 'divisas': return <Divisas />;
      case 'pagamentos_fixos': return <PagamentosFixos />;
      case 'projetos': return <Projetos />;
      case 'gamificacao': return <Gamificacao />;
      case 'kixikila': return <Kixikila />;
      case 'assistente':
        if (isAdmin && !canOpenAdminTab(user, 'assistente')) return <DashboardHome isAdmin={isAdmin} setActiveTab={setActiveTab} />;
        return <Assistente isAdmin={isAdmin} />;
      case 'planos': return <Planos user={user} />;
      // Rotas Admin
      case 'admin_dashboard': return canOpenAdminTab(user, activeTab) ? <AdminDashboard setActiveTab={setActiveTab} /> : <DashboardHome isAdmin={isAdmin} setActiveTab={setActiveTab} />;
      case 'admin_users': return canOpenAdminTab(user, activeTab) ? <AdminUsers /> : <DashboardHome isAdmin={isAdmin} setActiveTab={setActiveTab} />;
      case 'admin_payments': return canOpenAdminTab(user, activeTab) ? <AdminPayments /> : <DashboardHome isAdmin={isAdmin} setActiveTab={setActiveTab} />;
      case 'admin_settings': return canOpenAdminTab(user, activeTab) ? <AdminSettings /> : <DashboardHome isAdmin={isAdmin} setActiveTab={setActiveTab} />;
      case 'admin_gamification': return canOpenAdminTab(user, activeTab) ? <AdminGamification /> : <DashboardHome isAdmin={isAdmin} setActiveTab={setActiveTab} />;
      case 'admin_logs': return canOpenAdminTab(user, activeTab) ? <AdminLogs /> : <DashboardHome isAdmin={isAdmin} setActiveTab={setActiveTab} />;
      default: return <DashboardHome isAdmin={isAdmin} setActiveTab={setActiveTab} />;
    }
  };

  if (showDashboard && user) {
    return (
      <>
        <AdminProvider isAdmin={isAdmin}>
          <FinanceProvider userId={user.id} initialUser={user} onUserHydrated={handleUserHydrated}>
            <DashboardLayout 
              activeTab={activeTab} 
              setActiveTab={setActiveTab} 
              onLogout={handleLogout} 
              isAdmin={isAdmin}
            >
              {renderContent()}
            </DashboardLayout>
          </FinanceProvider>
        </AdminProvider>
        <PwaInstallPrompt />
      </>
    );
  }

  return (
    <>
      <LoginScreen onLogin={(userData) => {
        saveSession(userData);
        setUser(userData);
        setIsAdmin(userData.plan_type === 'admin');
        setActiveTab(userData.plan_type === 'admin' ? getInitialAdminTab(userData) : 'dashboard');
        setShowDashboard(true);
      }} />
      <PwaInstallPrompt />
    </>
  );
}

export default App;
