import React, { useEffect, useState } from 'react';
import { useFinance } from '../contexts/FinanceContext';
import { useAdmin } from '../contexts/AdminContext';
import Modal from '../components/Modal';
import GlobalAlert from '../components/GlobalAlert';
import PlanCountdown from '../components/PlanCountdown';

const PREMIUM_TABS = new Set(['orcamento', 'calendario', 'lista_compras', 'divisas', 'projetos', 'gamificacao', 'kixikila']);
const ANNUAL_TABS = new Set(['previsao']);
const FALLBACK_ADMIN_ID = '00000000-0000-0000-0000-000000000000';
const ADMIN_NAV_ITEMS = [
  { tab: 'admin_dashboard', permission: 'dashboard', icon: '👑', label: 'Visão Geral' },
  { tab: 'admin_users', permission: 'users', icon: '👥', label: 'Utilizadores' },
  { tab: 'admin_payments', permission: 'payments', icon: '💳', label: 'Pagamentos', badge: 'payments' },
  { tab: 'assistente', permission: 'assistant', icon: '?', label: 'Assistente', badge: 'assistant' },
  { tab: 'admin_settings', permission: 'settings', icon: '⚙️', label: 'Definições' },
  { tab: 'admin_gamification', permission: 'reports', icon: '🎮', label: 'Gamificação' },
  { tab: 'admin_logs', permission: 'reports', icon: '📜', label: 'Logs' }
];

function getAdminPermissions(usuario) {
  if (usuario?.id === FALLBACK_ADMIN_ID) return { all: true };
  return usuario?.adminPermissions || usuario?.admin_permissions || {};
}

export default function DashboardLayout({ children, activeTab, setActiveTab, onLogout, isAdmin }) {
  const { 
    usuario, atualizarUsuario, notificacoes, marcarNotificacaoLida, marcarTodasLidas, isLoadingData,
    movimentos = [], dividas = [], kixikilas = [], projetos = [], assistantUnreadCount = 0,
    isOnline = true, offlineQueueCount = 0, offlineQueueItems = [], isSyncingOffline = false, syncOfflineData
  } = useFinance();
  const { systemSettings, pendingPayments = [] } = useAdmin();
  
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showPlanExpiredModal, setShowPlanExpiredModal] = useState(false);
  const [showAnnualRequiredModal, setShowAnnualRequiredModal] = useState(false);

  const unreadCount = notificacoes.filter(n => !n.lida).length;
  const assistantBadge = assistantUnreadCount > 99 ? '99+' : assistantUnreadCount;
  const pendingPaymentsBadge = pendingPayments.length > 99 ? '99+' : pendingPayments.length;
  const adminPermissions = getAdminPermissions(usuario);
  const hasFullAdminAccess = isAdmin && Boolean(adminPermissions.all || adminPermissions.all_access || usuario?.id === FALLBACK_ADMIN_ID);
  const hasAdminPermission = (permission) => isAdmin && Boolean(hasFullAdminAccess || adminPermissions[permission]);
  const visibleAdminNavItems = ADMIN_NAV_ITEMS.filter(item => hasAdminPermission(item.permission));
  const isDelegatedAdmin = isAdmin && !hasFullAdminAccess;
  const firstAllowedAdminTab = visibleAdminNavItems[0]?.tab || 'dashboard';

  // Sistema de Pesquisa Global
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const getSearchResults = () => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    
    const res = [];
    movimentos.forEach(m => {
      if (m.descricao?.toLowerCase().includes(q) || m.categoria?.toLowerCase().includes(q)) {
        res.push({ type: 'Transação', icon: '💸', text: m.descricao, value: m.valor, tab: 'transacoes' });
      }
    });
    dividas.forEach(d => {
      if (d.pessoa?.toLowerCase().includes(q) || d.finalidade?.toLowerCase().includes(q) || d.nome?.toLowerCase().includes(q)) {
        res.push({ type: 'Dívida', icon: '⚠️', text: d.pessoa || d.nome, value: d.valor, tab: 'dividas' });
      }
    });
    kixikilas.forEach(k => {
      if (k.nome?.toLowerCase().includes(q)) {
        res.push({ type: 'Kixikila', icon: '🤝', text: k.nome, value: k.valorTotal || k.objetivo, tab: 'kixikila' });
      }
    });
    projetos.forEach(p => {
      if (p.nome?.toLowerCase().includes(q)) {
        res.push({ type: 'Projeto', icon: '🎯', text: p.nome, value: p.objetivo, tab: 'projetos' });
      }
    });

    return res.slice(0, 8); // Top 8 resultados
  };

  const searchResults = getSearchResults();
  const hasPremiumAccess = isAdmin || usuario?.isPremium;
  const hasAnnualAccess = isAdmin || usuario?.hasAnnualAccess;
  const syncStatusText = !isOnline
    ? (offlineQueueCount > 0 ? `Offline - ${offlineQueueCount} pendente(s)` : 'Offline')
    : isSyncingOffline
      ? 'A sincronizar...'
      : offlineQueueCount > 0
        ? `${offlineQueueCount} por sincronizar`
        : 'Online';
  const syncStatusColor = !isOnline
    ? '#ef4444'
    : offlineQueueCount > 0 || isSyncingOffline
      ? '#f59e0b'
      : '#10b981';

  const navigateToTab = (tab) => {
    if (ANNUAL_TABS.has(tab) && !hasAnnualAccess) {
      setShowMobileMenu(false);
      setShowAnnualRequiredModal(true);
      return;
    }

    if (PREMIUM_TABS.has(tab) && !hasPremiumAccess) {
      setShowMobileMenu(false);
      setShowPlanExpiredModal(true);
      return;
    }

    setShowMobileMenu(false);
    setActiveTab(tab);
  };

  const navigateToAdminTab = (tab) => {
    const item = ADMIN_NAV_ITEMS.find(navItem => navItem.tab === tab);
    if (!item || !hasAdminPermission(item.permission)) {
      setShowMobileMenu(false);
      setActiveTab(firstAllowedAdminTab);
      return;
    }

    setShowMobileMenu(false);
    setActiveTab(tab);
  };

  const goToPlans = () => {
    setShowPlanExpiredModal(false);
    setShowAnnualRequiredModal(false);
    setShowProfileModal(false);
    setShowMobileMenu(false);
    setActiveTab('planos');
  };

  const handleNotificationClick = (notif) => {
    marcarNotificacaoLida(notif.id);
    if (notif.tab) {
      setShowNotifications(false);
      setActiveTab(notif.tab);
    }
  };

  useEffect(() => {
    const adminItem = ADMIN_NAV_ITEMS.find(item => item.tab === activeTab);
    if (isAdmin && adminItem && !hasAdminPermission(adminItem.permission)) {
      setActiveTab(firstAllowedAdminTab);
      return;
    }

    if (ANNUAL_TABS.has(activeTab) && !hasAnnualAccess) {
      setActiveTab('dashboard');
      setShowAnnualRequiredModal(true);
      return;
    }

    if (PREMIUM_TABS.has(activeTab) && !hasPremiumAccess) {
      setActiveTab('dashboard');
      setShowPlanExpiredModal(true);
    }
  }, [activeTab, firstAllowedAdminTab, hasAnnualAccess, hasPremiumAccess, isAdmin, setActiveTab]);

  if (systemSettings?.maintenanceMode && !isAdmin) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-light)', textAlign: 'center', padding: '2rem' }}>
        <h1 style={{ fontSize: '4rem', marginBottom: '1rem' }}>🚧</h1>
        <h2 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>Em Manutenção</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', lineHeight: '1.6' }}>
          O Yeto Finanças encontra-se atualmente em manutenção para aplicar novas funcionalidades e garantir maior segurança. Voltaremos muito em breve!
        </p>
        <button className="btn btn-primary btn-pill" onClick={onLogout} style={{ marginTop: '2rem' }}>
          Terminar Sessão
        </button>
      </div>
    );
  }

  const handleProfileSave = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const dados = {
      nome: formData.get('nome') || '',
      // e.target[1] é o email, está disabled
      profissao: formData.get('profissao') || '',
      genero: formData.get('genero') || '',
      provincia: formData.get('provincia') || '',
      municipio: formData.get('municipio') || '',
      cidade: formData.get('cidade') || '',
      novaSenha: formData.get('novaSenha') || ''
    };
    const saved = await atualizarUsuario(dados);
    if (!saved) return;
    setShowProfileModal(false);
  };

  const formatProfileDate = (value) => {
    if (!value) return 'Ainda não registado';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Ainda não registado';
    return date.toLocaleString('pt-AO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      // createImageBitmap lê a imagem e corrige automaticamente a rotação (EXIF) dos telemóveis
      const bitmap = await createImageBitmap(file);
      
      const canvas = document.createElement('canvas');
      const MAX_SIZE = 800; // Resolução muito mais alta para não perder qualidade
      let width = bitmap.width;
      let height = bitmap.height;

      // Mantém a proporção correta
      if (width > height) {
        if (width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        }
      } else {
        if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0, width, height);

      // Comprime para JPEG com 85% de qualidade (Excelente qualidade visual, tamanho reduzido)
      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      atualizarUsuario({ foto: compressedDataUrl });
    } catch (err) {
      console.error("Erro ao comprimir imagem:", err);
      // Fallback de segurança: se falhar, guarda a imagem original
      const reader = new FileReader();
      reader.onload = (event) => atualizarUsuario({ foto: event.target.result });
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{
            width: '40px', height: '40px', background: 'linear-gradient(135deg, #FFB300 0%, #FF8F00 100%)',
            borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: '900', fontSize: '1.5rem', boxShadow: '0 4px 10px rgba(255, 179, 0, 0.3)',
            fontFamily: 'Inter, system-ui, sans-serif'
          }}>Y</div>
          <span style={{ color: 'white', fontWeight: '800', fontSize: '1.3rem', marginLeft: '10px' }}>
            Yeto <span style={{ color: 'var(--accent-color)', fontWeight: '600' }}>Finanças</span>
          </span>
        </div>
        <nav className="sidebar-nav">
          <button className={`sidebar-link ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <span>📊</span> Dashboard
          </button>
          <button className={`sidebar-link ${activeTab === 'bancos' ? 'active' : ''}`} onClick={() => setActiveTab('bancos')}>
            <span>🏦</span> Bancos
          </button>
          <button className={`sidebar-link ${activeTab === 'transacoes' ? 'active' : ''}`} onClick={() => setActiveTab('transacoes')}>
            <span>💸</span> Transações
          </button>
          <button className={`sidebar-link hide-on-mobile ${activeTab === 'orcamento' ? 'active' : ''}`} onClick={() => navigateToTab('orcamento')}>
            <span>📋</span> Orçamento
          </button>
          <button className={`sidebar-link hide-on-mobile ${activeTab === 'calendario' ? 'active' : ''}`} onClick={() => navigateToTab('calendario')}>
            <span>📅</span> Calendário
          </button>
          
          <button className={`sidebar-link hide-on-mobile ${activeTab === 'previsao' ? 'active' : ''}`} onClick={() => navigateToTab('previsao')}>
            <span>🧭</span> Previsão
          </button>
          <button className={`sidebar-link hide-on-mobile ${activeTab === 'lista_compras' ? 'active' : ''}`} onClick={() => navigateToTab('lista_compras')}>
            <span>🛒</span> Lista
          </button>
          <button className={`sidebar-link hide-on-mobile ${activeTab === 'dividas' ? 'active' : ''}`} onClick={() => setActiveTab('dividas')}>
            <span>⚠️</span> Dívidas
          </button>
          <button className={`sidebar-link hide-on-mobile ${activeTab === 'pagamentos_fixos' ? 'active' : ''}`} onClick={() => setActiveTab('pagamentos_fixos')}>
            <span>📅</span> Pagamentos Fixos
          </button>
          {!isAdmin && (
            <button className={`sidebar-link hide-on-mobile ${activeTab === 'assistente' ? 'active' : ''}`} onClick={() => setActiveTab('assistente')}>
              <span>?</span> Assistente
              {assistantUnreadCount > 0 && <span className="menu-badge">{assistantBadge}</span>}
            </button>
          )}
          <button className={`sidebar-link hide-on-mobile ${activeTab === 'divisas' ? 'active' : ''}`} onClick={() => navigateToTab('divisas')}>
            <span>🌍</span> Câmbio & Divisas
          </button>
          <button className={`sidebar-link hide-on-mobile ${activeTab === 'projetos' ? 'active' : ''}`} onClick={() => navigateToTab('projetos')}>
            <span>🎯</span> Projetos
          </button>
          <button className={`sidebar-link hide-on-mobile ${activeTab === 'gamificacao' ? 'active' : ''}`} onClick={() => navigateToTab('gamificacao')}>
            <span>🎮</span> Desafios
          </button>
          <button className={`sidebar-link hide-on-mobile ${activeTab === 'kixikila' ? 'active' : ''}`} onClick={() => navigateToTab('kixikila')}>
            <span>🤝</span> Kixikila
          </button>

          {isAdmin && visibleAdminNavItems.length > 0 && (
            <>
              <div className="hide-on-mobile" style={{ marginTop: '2rem', padding: '0 1rem', fontSize: '0.75rem', fontWeight: 'bold', color: '#8a8ca3', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Área Administrativa
              </div>
              {visibleAdminNavItems.map((item, index) => (
                <button
                  key={item.tab}
                  className={`sidebar-link hide-on-mobile ${activeTab === item.tab ? 'active' : ''}`}
                  onClick={() => navigateToAdminTab(item.tab)}
                  style={index === 0 ? { marginTop: '0.5rem' } : undefined}
                >
                  <span>{item.icon}</span> {item.label}
                  {item.badge === 'payments' && pendingPayments.length > 0 && <span className="menu-badge">{pendingPaymentsBadge}</span>}
                  {item.badge === 'assistant' && assistantUnreadCount > 0 && <span className="menu-badge">{assistantBadge}</span>}
                </button>
              ))}
            </>
          )}

          {/* Menu Button for Mobile Dock Only */}
          <button className="sidebar-link mobile-only-menu-btn" onClick={() => setShowMobileMenu(true)}>
            <span>☰</span> Menu
          </button>
        </nav>
        {!isAdmin && <div className="sidebar-footer hide-on-mobile">
          <button 
            className={`sidebar-link ${activeTab === 'planos' ? 'active' : ''}`} 
            onClick={goToPlans}
            style={{ 
              background: activeTab === 'planos' ? 'var(--accent-gradient)' : 'rgba(255, 179, 0, 0.1)', 
              color: activeTab === 'planos' ? 'white' : '#ffb300', 
              border: '1px solid rgba(255, 179, 0, 0.3)',
              marginBottom: '0.5rem'
            }}
          >
            <span>💎</span> Fazer Upgrade
          </button>
        </div>}
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        {systemSettings?.globalAlert?.active && (
          <div style={{ 
            background: `var(--${systemSettings.globalAlert.type}-color, var(--accent-color))`, 
            color: 'white', 
            padding: '0.8rem 2rem', 
            textAlign: 'center', 
            fontWeight: 'bold', 
            fontSize: '0.9rem',
            letterSpacing: '0.5px'
          }}>
            {systemSettings.globalAlert.message}
          </div>
        )}
        
        {/* Top Bar */}
        <header className="dashboard-topbar">
          <div className="search-bar" style={{ position: 'relative' }}>
            <span>🔍</span>
            <input 
              type="text" 
              placeholder="Pesquisar despesas, dívidas, kixikila..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
            />
            {isSearchFocused && searchQuery.trim() !== '' && (
              <div style={{
                position: 'absolute', top: '110%', left: 0, width: '100%', background: 'white', 
                borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', zIndex: 100,
                maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--glass-border)'
              }}>
                {searchResults.length > 0 ? (
                  searchResults.map((res, i) => (
                    <div 
                      key={i} 
                      onClick={() => { navigateToTab(res.tab); setSearchQuery(''); }}
                      style={{ 
                        padding: '10px 15px', display: 'flex', justifyContent: 'space-between', 
                        alignItems: 'center', cursor: 'pointer', borderBottom: i < searchResults.length - 1 ? '1px solid #f0f0f0' : 'none',
                        transition: 'background 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#f9fafd'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.2rem' }}>{res.icon}</span>
                        <div>
                          <p style={{ margin: 0, fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-primary)' }}>{res.text}</p>
                          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{res.type}</p>
                        </div>
                      </div>
                      <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        Kz {Number(res.value || 0).toLocaleString()}
                      </span>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '15px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Nenhum resultado encontrado.
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            className="dashboard-sync-status"
            onClick={() => setShowSyncModal(true)}
            title="Estado da sincronização"
            style={{
              border: '1px solid rgba(16, 185, 129, 0.15)',
              background: `${syncStatusColor}14`,
              color: syncStatusColor,
              borderRadius: '999px',
              padding: '0.55rem 0.85rem',
              fontWeight: 800,
              fontSize: '0.78rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <span className="sync-status-dot" aria-hidden="true"></span>
            <span className="sync-status-label">{syncStatusText}</span>
          </button>
          
          <div className="user-actions" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            {/* Notification Bell */}
            <div style={{ position: 'relative' }}>
              <span 
                className="notification" 
                style={{ cursor: 'pointer', fontSize: '1.2rem', padding: '0.5rem', background: '#f2f3f9', borderRadius: '50%' }}
                onClick={() => setShowNotifications(!showNotifications)}
              >
                🔔
              </span>
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: -5, right: -5, background: 'var(--danger-color)', color: 'white',
                  borderRadius: '50%', width: '18px', height: '18px', fontSize: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
                }}>
                  {unreadCount}
                </span>
              )}
              
              {/* Notifications Dropdown */}
              {showNotifications && (
                <div style={{
                  position: 'absolute', top: '40px', right: '-60px', width: '320px', background: 'white',
                  borderRadius: '15px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', zIndex: 100, padding: '1rem',
                  border: '1px solid var(--glass-border)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>Notificações</h4>
                    {unreadCount > 0 && (
                      <button onClick={marcarTodasLidas} style={{ border: 'none', background: 'none', color: 'var(--accent-color)', fontSize: '0.8rem', cursor: 'pointer', fontWeight: '600' }}>
                        Marcar todas lidas
                      </button>
                    )}
                  </div>
                  
                  <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {notificacoes.length === 0 ? (
                      <p className="text-secondary text-sm text-center">Nenhuma notificação.</p>
                    ) : (
                      notificacoes.map(notif => (
                        <div 
                          key={notif.id} 
                          onClick={() => handleNotificationClick(notif)}
                          style={{ 
                            padding: '0.8rem', borderRadius: '10px', cursor: 'pointer',
                            background: notif.lida ? '#f9fafb' : 'rgba(55, 51, 146, 0.05)',
                            borderLeft: notif.lida ? '3px solid transparent' : '3px solid var(--accent-color)'
                          }}
                        >
                          <h5 style={{ margin: '0 0 0.3rem 0', color: notif.lida ? 'var(--text-secondary)' : 'var(--text-primary)', fontSize: '0.9rem' }}>
                            {notif.titulo}
                          </h5>
                          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                            {notif.mensagem}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Info */}
            <div 
              className="user-profile" 
              onClick={() => setShowProfileModal(true)}
              style={{ cursor: 'pointer', padding: '0.3rem 0.8rem', borderRadius: '25px', transition: 'background 0.3s' }}
              onMouseOver={(e) => e.currentTarget.style.background = '#f2f3f9'}
              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div className="avatar" style={{ 
                background: usuario.foto ? 'transparent' : 'linear-gradient(135deg, #FFB300 0%, #FF8F00 100%)',
                border: usuario.foto ? '2px solid white' : 'none',
                overflow: 'hidden',
                position: 'relative'
              }}>
                {usuario.foto ? (
                  <img src={usuario.foto} alt="Perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  usuario.avatar
                )}
              </div>
              <div className="user-profile-text" style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.95rem' }}>Olá, {usuario.nome}!</span>
                {usuario.profissao && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{usuario.profissao}</span>}
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Content */}
        <div className="dashboard-content" style={{ position: 'relative', minHeight: '60vh' }}>
          {isLoadingData ? (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(244, 246, 252, 0.7)', backdropFilter: 'blur(8px)', zIndex: 10,
              borderRadius: '20px', animation: 'fadeIn 0.3s ease-in'
            }}>
              <div style={{
                width: '50px', height: '50px',
                border: '4px solid rgba(55, 51, 146, 0.1)',
                borderTopColor: 'var(--accent-color)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginBottom: '1rem'
              }}></div>
              <h3 style={{ color: 'var(--text-primary)', margin: 0 }}>A preparar as suas finanças...</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0.5rem 0 0 0' }}>Yeto está a sincronizar os dados reais</p>
            </div>
          ) : null}
          <div style={{ opacity: isLoadingData ? 0 : 1, transition: 'opacity 0.4s ease-out' }}>
            {children}
          </div>
          <GlobalAlert />
        </div>
      </main>

      <Modal isOpen={showSyncModal} onClose={() => setShowSyncModal(false)} title="Sincronização Offline">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{
            padding: '1rem',
            borderRadius: '18px',
            background: `${syncStatusColor}14`,
            color: syncStatusColor,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
          }}>
            <span>{syncStatusText}</span>
            <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>
              {offlineQueueCount} pendente(s)
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary btn-pill"
              disabled={!isOnline || isSyncingOffline || offlineQueueCount === 0}
              onClick={() => syncOfflineData?.()}
              style={{ flex: '1 1 180px' }}
            >
              {isSyncingOffline ? 'A sincronizar...' : 'Sincronizar agora'}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-pill"
              onClick={() => setShowSyncModal(false)}
              style={{ flex: '1 1 140px' }}
            >
              Fechar
            </button>
          </div>

          <div style={{
            maxHeight: '260px',
            overflowY: 'auto',
            border: '1px solid var(--glass-border)',
            borderRadius: '16px',
            padding: '0.75rem'
          }}>
            {offlineQueueItems.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--text-secondary)', textAlign: 'center' }}>
                Não existem alterações pendentes.
              </p>
            ) : (
              offlineQueueItems.map(item => (
                <div
                  key={item.id}
                  style={{
                    padding: '0.8rem',
                    borderRadius: '12px',
                    background: '#f8f9fc',
                    marginBottom: '0.5rem'
                  }}
                >
                  <strong style={{ color: 'var(--text-primary)', display: 'block' }}>
                    {item.label || 'Alteração offline'}
                  </strong>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                    {item.createdAt ? new Date(item.createdAt).toLocaleString('pt-AO') : 'Pendente'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      {/* Modal de Perfil do Utilizador */}
      <Modal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} title="Editar Perfil" maxWidth="680px" className="profile-modal">
        <div style={{ textAlign: 'center', marginBottom: '0.35rem', position: 'relative' }}>
          <input 
            type="file" 
            id="upload-avatar" 
            accept="image/*" 
            style={{ display: 'none' }} 
            onChange={handleImageUpload} 
          />
          <label htmlFor="upload-avatar" style={{ cursor: 'pointer', display: 'inline-block', position: 'relative' }}>
            <div style={{ 
              width: '64px', height: '64px', borderRadius: '50%', background: usuario.foto ? 'transparent' : 'linear-gradient(135deg, #FFB300 0%, #FF8F00 100%)', 
              color: 'white', fontSize: '1.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', 
              margin: '0 auto', boxShadow: '0 5px 15px rgba(55, 51, 146, 0.2)',
              border: '2px solid white',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {usuario.foto ? (
                <img src={usuario.foto} alt="Perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                usuario.avatar
              )}
            </div>
            {/* Ícone de câmara */}
            <div style={{
              position: 'absolute', bottom: '0', right: '0', background: 'var(--accent-color)', color: 'white',
              borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', border: '2px solid white', boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
            }}>
              📷
            </div>
          </label>
        </div>

        <PlanCountdown
          expiresAt={usuario.plan_expires_at}
          createdAt={usuario.created_at}
          planType={usuario.plan_type}
          onRenew={goToPlans}
        />
        
        <form onSubmit={handleProfileSave} className="profile-edit-form">
          <div>
            <label className="text-secondary" style={{ display: 'block', marginBottom: '0.15rem', fontSize: '0.8rem' }}>Nome (Como quer ser chamado)</label>
            <input name="nome" type="text" className="qt-input" defaultValue={usuario.nome} required />
          </div>
          <div>
            <label className="text-secondary" style={{ display: 'block', marginBottom: '0.15rem', fontSize: '0.8rem' }}>E-mail Pessoal</label>
            <input type="email" className="qt-input profile-readonly-input" value={usuario.email || ''} disabled />
          </div>
          <div>
            <label className="text-secondary" style={{ display: 'block', marginBottom: '0.15rem', fontSize: '0.8rem' }}>Profissão / Ocupação</label>
            <input name="profissao" type="text" className="qt-input" defaultValue={usuario.profissao} placeholder="Ex: Engenheiro, Professor..." />
          </div>
          <div className="profile-form-grid">
            <div className="profile-field">
              <label>Género</label>
              <select name="genero" className="qt-input profile-select" defaultValue={usuario.genero || ''}>
                <option value="">Prefiro não informar</option>
                <option value="feminino">Feminino</option>
                <option value="masculino">Masculino</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div className="profile-field">
              <label>Província</label>
              <input name="provincia" type="text" className="qt-input" defaultValue={usuario.provincia || ''} placeholder="Ex: Luanda" />
            </div>
            <div className="profile-field">
              <label>Município</label>
              <input name="municipio" type="text" className="qt-input" defaultValue={usuario.municipio || ''} placeholder="Ex: Belas" />
            </div>
            <div className="profile-field">
              <label>Cidade / Bairro</label>
              <input name="cidade" type="text" className="qt-input" defaultValue={usuario.cidade || ''} placeholder="Opcional" />
            </div>
          </div>
          <div className="profile-readonly-grid">
            <div className="profile-readonly-card">
              <span>Email verificado</span>
              <strong>{usuario.emailVerificado ? 'Sim' : 'Não'}</strong>
            </div>
            <div className="profile-readonly-card">
              <span>Último acesso</span>
              <strong>{formatProfileDate(usuario.ultimoLogin)}</strong>
            </div>
            <div className="profile-readonly-card">
              <span>Dispositivo</span>
              <strong>{usuario.ultimoDispositivo || 'Ainda não registado'}</strong>
            </div>
            <div className="profile-readonly-card">
              <span>IP recente</span>
              <strong>{usuario.ultimoIp || 'Não disponível'}</strong>
            </div>
            <div className="profile-readonly-card">
              <span>Dispositivos usados</span>
              <strong>{usuario.totalDispositivos || 0}</strong>
            </div>
          </div>
          <div>
            <label className="text-secondary" style={{ display: 'block', marginBottom: '0.15rem', fontSize: '0.8rem' }}>Nova Senha (Opcional)</label>
            <input name="novaSenha" type="password" className="qt-input" placeholder="Deixe em branco para manter" />
          </div>
          <div className="profile-actions">
            <button type="submit" className="btn btn-primary btn-pill" style={{ padding: '0.52rem' }}>Guardar Alterações</button>
            <button type="button" onClick={onLogout} className="btn btn-glass btn-pill" style={{ padding: '0.52rem', color: 'var(--danger-color)', border: '1px solid rgba(255,0,0,0.2)' }}>
              🚪 Terminar Sessão
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showPlanExpiredModal} onClose={() => setShowPlanExpiredModal(false)} title="Plano Expirado">
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '58px',
            height: '58px',
            borderRadius: '16px',
            background: 'rgba(244, 91, 91, 0.12)',
            color: 'var(--danger-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem auto',
            fontSize: '1.6rem',
            fontWeight: 900
          }}>
            !
          </div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 1.25rem 0' }}>
            O seu período de acesso terminou. Renove o plano para voltar a usar as funcionalidades Premium.
          </p>
          <button className="btn btn-primary btn-pill" onClick={goToPlans} style={{ width: '100%' }}>
            Renovar Agora
          </button>
        </div>
      </Modal>

      <Modal isOpen={showAnnualRequiredModal} onClose={() => setShowAnnualRequiredModal(false)} title="Plano Anual">
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '58px',
            height: '58px',
            borderRadius: '16px',
            background: 'rgba(255, 179, 0, 0.16)',
            color: '#ff9f00',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem auto',
            fontSize: '1.6rem',
            fontWeight: 900
          }}>
            A
          </div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 1.25rem 0' }}>
            A Previsão do Fim do Mês e o Modo Emergência ficam gratuitos durante o primeiro mês.
            Depois disso, são exclusivos do plano Anual.
          </p>
          <button className="btn btn-primary btn-pill" onClick={goToPlans} style={{ width: '100%' }}>
            Ver Plano Anual
          </button>
        </div>
      </Modal>


      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <div className="mobile-menu-overlay" onClick={() => setShowMobileMenu(false)}>
          <div className={`mobile-menu-content ${isDelegatedAdmin ? 'delegated-admin-menu' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="mobile-menu-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  width: '32px', height: '32px', background: 'linear-gradient(135deg, #FFB300 0%, #FF8F00 100%)',
                  borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: '900', fontSize: '1.2rem', boxShadow: '0 4px 10px rgba(255, 179, 0, 0.3)'
                }}>Y</div>
                <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Menu Yeto</h3>
              </div>
              <button 
                onClick={() => setShowMobileMenu(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', color: 'var(--text-secondary)' }}
              >
                ✕
              </button>
            </div>
            
            <div className="mobile-menu-links">
              {isAdmin && visibleAdminNavItems.length > 0 && (
                <>
                  <div className="mobile-menu-section-title" style={{ marginTop: '0.5rem' }}>Administração</div>
                  {isDelegatedAdmin && (
                    <div className="delegated-admin-mobile-list">
                      {visibleAdminNavItems.map(item => (
                        <button
                          key={item.tab}
                          className={`mobile-menu-link admin-allowed ${activeTab === item.tab ? 'active' : ''}`}
                          onClick={() => navigateToAdminTab(item.tab)}
                        >
                          <span>{item.icon}</span> {item.tab === 'admin_settings' ? 'Configurações Globais' : item.tab === 'admin_logs' ? 'Histórico & Logs' : item.label}
                          {item.badge === 'payments' && pendingPayments.length > 0 && <span className="menu-badge">{pendingPaymentsBadge}</span>}
                          {item.badge === 'assistant' && assistantUnreadCount > 0 && <span className="menu-badge">{assistantBadge}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {!isDelegatedAdmin && (
                    <>
                      <button className={`mobile-menu-link ${activeTab === 'admin_dashboard' ? 'active' : ''}`} onClick={() => { setActiveTab('admin_dashboard'); setShowMobileMenu(false); }}><span>👑</span> Visão Geral</button>
                      <button className={`mobile-menu-link ${activeTab === 'admin_users' ? 'active' : ''}`} onClick={() => { setActiveTab('admin_users'); setShowMobileMenu(false); }}><span>👥</span> Utilizadores</button>
                      <button className={`mobile-menu-link ${activeTab === 'admin_payments' ? 'active' : ''}`} onClick={() => { setActiveTab('admin_payments'); setShowMobileMenu(false); }}><span>💳</span> Pagamentos{pendingPayments.length > 0 && <span className="menu-badge">{pendingPaymentsBadge}</span>}</button>
                      <button className={`mobile-menu-link ${activeTab === 'assistente' ? 'active' : ''}`} onClick={() => { setActiveTab('assistente'); setShowMobileMenu(false); }}><span>?</span> Assistente{assistantUnreadCount > 0 && <span className="menu-badge">{assistantBadge}</span>}</button>
                      <button className={`mobile-menu-link ${activeTab === 'admin_settings' ? 'active' : ''}`} onClick={() => { setActiveTab('admin_settings'); setShowMobileMenu(false); }}><span>⚙️</span> Configurações Globais</button>
                      <button className={`mobile-menu-link ${activeTab === 'admin_gamification' ? 'active' : ''}`} onClick={() => { setActiveTab('admin_gamification'); setShowMobileMenu(false); }}><span>🎮</span> Gamificação</button>
                      <button className={`mobile-menu-link ${activeTab === 'admin_logs' ? 'active' : ''}`} onClick={() => { setActiveTab('admin_logs'); setShowMobileMenu(false); }}><span>📜</span> Histórico & Logs</button>
                    </>
                  )}
                </>
              )}

              <div className="mobile-menu-section-title" style={{ marginTop: isAdmin ? '1.5rem' : '0.5rem' }}>As Minhas Finanças</div>
              <button className={`mobile-menu-link ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => { setActiveTab('dashboard'); setShowMobileMenu(false); }}><span>📊</span> Dashboard</button>
              <button className={`mobile-menu-link ${activeTab === 'bancos' ? 'active' : ''}`} onClick={() => { setActiveTab('bancos'); setShowMobileMenu(false); }}><span>🏦</span> Bancos & Carteiras</button>
              <button className={`mobile-menu-link ${activeTab === 'transacoes' ? 'active' : ''}`} onClick={() => { setActiveTab('transacoes'); setShowMobileMenu(false); }}><span>💸</span> Transações</button>
              <button className={`mobile-menu-link ${activeTab === 'orcamento' ? 'active' : ''}`} onClick={() => navigateToTab('orcamento')}><span>📋</span> Orçamento Mensal</button>
              <button className={`mobile-menu-link ${activeTab === 'calendario' ? 'active' : ''}`} onClick={() => navigateToTab('calendario')}><span>📅</span> Calendário Financeiro</button>
              <button className={`mobile-menu-link ${activeTab === 'previsao' ? 'active' : ''}`} onClick={() => navigateToTab('previsao')}><span>🧭</span> Previsão & Emergência</button>
              <button className={`mobile-menu-link ${activeTab === 'lista_compras' ? 'active' : ''}`} onClick={() => navigateToTab('lista_compras')}><span>🛒</span> Lista de Compras</button>
              <button className={`mobile-menu-link ${activeTab === 'dividas' ? 'active' : ''}`} onClick={() => { setActiveTab('dividas'); setShowMobileMenu(false); }}><span>⚠️</span> Dívidas</button>
              <button className={`mobile-menu-link ${activeTab === 'pagamentos_fixos' ? 'active' : ''}`} onClick={() => { setActiveTab('pagamentos_fixos'); setShowMobileMenu(false); }}><span>📅</span> Pagamentos Fixos</button>
              {!isAdmin && (
                <button className={`mobile-menu-link ${activeTab === 'assistente' ? 'active' : ''}`} onClick={() => { setActiveTab('assistente'); setShowMobileMenu(false); }}><span>?</span> Assistente{assistantUnreadCount > 0 && <span className="menu-badge">{assistantBadge}</span>}</button>
              )}
              <button className={`mobile-menu-link ${activeTab === 'divisas' ? 'active' : ''}`} onClick={() => navigateToTab('divisas')}><span>🌍</span> Câmbio & Divisas</button>
              <button className={`mobile-menu-link ${activeTab === 'projetos' ? 'active' : ''}`} onClick={() => navigateToTab('projetos')}><span>🎯</span> Projetos (Sonhos)</button>
              <button className={`mobile-menu-link ${activeTab === 'gamificacao' ? 'active' : ''}`} onClick={() => navigateToTab('gamificacao')}><span>🎮</span> Desafios & Metas</button>
              <button className={`mobile-menu-link ${activeTab === 'kixikila' ? 'active' : ''}`} onClick={() => navigateToTab('kixikila')}><span>🤝</span> Kixikila</button>
            </div>
            
            {!isAdmin && <div style={{ marginTop: '1.5rem' }}>
              <button 
                className={`mobile-menu-link ${activeTab === 'planos' ? 'active' : ''}`} 
                onClick={goToPlans}
                style={{ 
                  background: 'linear-gradient(135deg, rgba(255, 179, 0, 0.15) 0%, rgba(255, 143, 0, 0.15) 100%)', 
                  color: '#ffb300', border: '1px solid rgba(255, 179, 0, 0.3)' 
                }}
              >
                <span>⭐</span> Fazer Upgrade
              </button>
            </div>}
          </div>
        </div>
      )}

    </div>
  );
}
