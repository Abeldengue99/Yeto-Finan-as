import { useState, useCallback } from 'react';
import './index.css';
import DashboardLayout from './layouts/DashboardLayout';
import { FinanceProvider } from './contexts/FinanceContext';
import { AdminProvider } from './contexts/AdminContext';
import LoginScreen from './pages/LoginScreen';
import useInactivityTimer from './hooks/useInactivityTimer';
import { clearSession, saveSession } from './utils/api';

// Importação das Páginas do Sistema
import DashboardHome from './pages/DashboardHome';
import Bancos from './pages/Bancos';
import Transacoes from './pages/Transacoes';
import Dividas from './pages/Dividas';
import Orcamento from './pages/Orcamento';
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

// Tempo máximo de sessão inativa offline: 2 horas
const SESSION_MAX_AGE_MS = 2 * 60 * 60 * 1000;

// Tempo de inatividade dentro do sistema: 30 minutos
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

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
  const [activeTab, setActiveTab] = useState(initialIsAdmin ? 'admin_dashboard' : 'dashboard');

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
      case 'divisas': return <Divisas />;
      case 'pagamentos_fixos': return <PagamentosFixos />;
      case 'projetos': return <Projetos />;
      case 'gamificacao': return <Gamificacao />;
      case 'kixikila': return <Kixikila />;
      case 'assistente': return <Assistente isAdmin={isAdmin} />;
      case 'planos': return <Planos user={user} />;
      // Rotas Admin
      case 'admin_dashboard': return <AdminDashboard setActiveTab={setActiveTab} />;
      case 'admin_users': return <AdminUsers />;
      case 'admin_payments': return <AdminPayments />;
      case 'admin_settings': return <AdminSettings />;
      case 'admin_logs': return <AdminLogs />;
      default: return <DashboardHome isAdmin={isAdmin} setActiveTab={setActiveTab} />;
    }
  };

  if (showDashboard && user) {
    return (
      <AdminProvider isAdmin={isAdmin}>
        <FinanceProvider userId={user.id}>
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
    );
  }

  return (
    <LoginScreen onLogin={(userData) => {
      saveSession(userData);
      setUser(userData);
      setIsAdmin(userData.plan_type === 'admin');
      setActiveTab(userData.plan_type === 'admin' ? 'admin_dashboard' : 'dashboard');
      setShowDashboard(true);
    }} />
  );
}

export default App;
