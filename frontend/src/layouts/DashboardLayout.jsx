import React, { useState } from 'react';
import { useFinance } from '../contexts/FinanceContext';
import Modal from '../components/Modal';
import GlobalAlert from '../components/GlobalAlert';

export default function DashboardLayout({ children, activeTab, setActiveTab, onLogout, isAdmin }) {
  const { usuario, atualizarUsuario, notificacoes, marcarNotificacaoLida, marcarTodasLidas, isLoadingData } = useFinance();
  
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const unreadCount = notificacoes.filter(n => !n.lida).length;

  const handleProfileSave = (e) => {
    e.preventDefault();
    const dados = {
      nome: e.target[0].value,
      // e.target[1] é o email, está disabled
      profissao: e.target[2].value,
      novaSenha: e.target[3].value
    };
    atualizarUsuario(dados);
    setShowProfileModal(false);
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
          
          <button className={`sidebar-link hide-on-mobile ${activeTab === 'dividas' ? 'active' : ''}`} onClick={() => setActiveTab('dividas')}>
            <span>⚠️</span> Dívidas
          </button>
          <button className={`sidebar-link hide-on-mobile ${activeTab === 'pagamentos_fixos' ? 'active' : ''}`} onClick={() => setActiveTab('pagamentos_fixos')}>
            <span>📅</span> Pagamentos Fixos
          </button>
          <button className={`sidebar-link hide-on-mobile ${activeTab === 'divisas' ? 'active' : ''}`} onClick={() => setActiveTab('divisas')}>
            <span>🌍</span> Câmbio & Divisas
          </button>
          <button className={`sidebar-link hide-on-mobile ${activeTab === 'projetos' ? 'active' : ''}`} onClick={() => setActiveTab('projetos')}>
            <span>🎯</span> Projetos
          </button>
          <button className={`sidebar-link hide-on-mobile ${activeTab === 'gamificacao' ? 'active' : ''}`} onClick={() => setActiveTab('gamificacao')}>
            <span>🎮</span> Desafios
          </button>
          <button className={`sidebar-link hide-on-mobile ${activeTab === 'kixikila' ? 'active' : ''}`} onClick={() => setActiveTab('kixikila')}>
            <span>🤝</span> Kixikila
          </button>

          {isAdmin && (
            <>
              <div className="hide-on-mobile" style={{ marginTop: '2rem', padding: '0 1rem', fontSize: '0.75rem', fontWeight: 'bold', color: '#8a8ca3', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Área Administrativa
              </div>
              <button className={`sidebar-link hide-on-mobile ${activeTab === 'admin_dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('admin_dashboard')} style={{ marginTop: '0.5rem' }}>
                <span>👑</span> Visão Geral
              </button>
              <button className={`sidebar-link hide-on-mobile ${activeTab === 'admin_users' ? 'active' : ''}`} onClick={() => setActiveTab('admin_users')}>
                <span>👥</span> Utilizadores
              </button>
              <button className={`sidebar-link hide-on-mobile ${activeTab === 'admin_payments' ? 'active' : ''}`} onClick={() => setActiveTab('admin_payments')}>
                <span>💳</span> Pagamentos
              </button>
              <button className={`sidebar-link hide-on-mobile ${activeTab === 'admin_settings' ? 'active' : ''}`} onClick={() => setActiveTab('admin_settings')}>
                <span>⚙️</span> Definições
              </button>
              <button className={`sidebar-link hide-on-mobile ${activeTab === 'admin_logs' ? 'active' : ''}`} onClick={() => setActiveTab('admin_logs')}>
                <span>📜</span> Logs
              </button>
            </>
          )}

          {/* Menu Button for Mobile Dock Only */}
          <button className="sidebar-link mobile-only-menu-btn" onClick={() => setShowMobileMenu(true)}>
            <span>☰</span> Menu
          </button>
        </nav>
        <div className="sidebar-footer hide-on-mobile">
          <button 
            className={`sidebar-link ${activeTab === 'planos' ? 'active' : ''}`} 
            onClick={() => setActiveTab('planos')}
            style={{ 
              background: activeTab === 'planos' ? 'var(--accent-gradient)' : 'rgba(255, 179, 0, 0.1)', 
              color: activeTab === 'planos' ? 'white' : '#ffb300', 
              border: '1px solid rgba(255, 179, 0, 0.3)',
              marginBottom: '0.5rem'
            }}
          >
            <span>💎</span> Fazer Upgrade
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Top Bar */}
        <header className="dashboard-topbar">
          <div className="search-bar">
            <span>🔍</span>
            <input type="text" placeholder="Pesquisar despesas, dívidas, kixikila..." />
          </div>
          
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
                          onClick={() => marcarNotificacaoLida(notif.id)}
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
              <div style={{ display: 'flex', flexDirection: 'column' }}>
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

      {/* Modal de Perfil do Utilizador */}
      <Modal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} title="Editar Perfil">
        <div style={{ textAlign: 'center', marginBottom: '0.5rem', position: 'relative' }}>
          <input 
            type="file" 
            id="upload-avatar" 
            accept="image/*" 
            style={{ display: 'none' }} 
            onChange={handleImageUpload} 
          />
          <label htmlFor="upload-avatar" style={{ cursor: 'pointer', display: 'inline-block', position: 'relative' }}>
            <div style={{ 
              width: '80px', height: '80px', borderRadius: '50%', background: usuario.foto ? 'transparent' : 'linear-gradient(135deg, #FFB300 0%, #FF8F00 100%)', 
              color: 'white', fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', 
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
              borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', border: '2px solid white', boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
            }}>
              📷
            </div>
          </label>
        </div>
        
        <form onSubmit={handleProfileSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div>
            <label className="text-secondary" style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.85rem' }}>Nome (Como quer ser chamado)</label>
            <input type="text" className="qt-input" defaultValue={usuario.nome} required style={{ padding: '0.5rem 0.8rem' }} />
          </div>
          <div>
            <label className="text-secondary" style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.85rem' }}>E-mail Pessoal</label>
            <input type="email" className="qt-input" value={usuario.email || ''} disabled style={{ padding: '0.5rem 0.8rem', background: '#f2f3f9', cursor: 'not-allowed', color: '#8a8ca3' }} />
          </div>
          <div>
            <label className="text-secondary" style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.85rem' }}>Profissão / Ocupação</label>
            <input type="text" className="qt-input" defaultValue={usuario.profissao} placeholder="Ex: Engenheiro, Professor..." style={{ padding: '0.5rem 0.8rem' }} />
          </div>
          <div>
            <label className="text-secondary" style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.85rem' }}>Nova Senha (Opcional)</label>
            <input type="password" className="qt-input" placeholder="Deixe em branco para manter" style={{ padding: '0.5rem 0.8rem' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
            <button type="submit" className="btn btn-primary btn-pill" style={{ padding: '0.6rem' }}>Guardar Alterações</button>
            <button type="button" onClick={onLogout} className="btn btn-glass btn-pill" style={{ padding: '0.6rem', color: 'var(--danger-color)', border: '1px solid rgba(255,0,0,0.2)' }}>
              🚪 Terminar Sessão
            </button>
          </div>
        </form>
      </Modal>


      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <div className="mobile-menu-overlay" onClick={() => setShowMobileMenu(false)}>
          <div className="mobile-menu-content" onClick={e => e.stopPropagation()}>
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
              {isAdmin && (
                <>
                  <div className="mobile-menu-section-title" style={{ marginTop: '0.5rem' }}>Administração</div>
                  <button className={`mobile-menu-link ${activeTab === 'admin_dashboard' ? 'active' : ''}`} onClick={() => { setActiveTab('admin_dashboard'); setShowMobileMenu(false); }}><span>👑</span> Visão Geral</button>
                  <button className={`mobile-menu-link ${activeTab === 'admin_users' ? 'active' : ''}`} onClick={() => { setActiveTab('admin_users'); setShowMobileMenu(false); }}><span>👥</span> Utilizadores</button>
                  <button className={`mobile-menu-link ${activeTab === 'admin_payments' ? 'active' : ''}`} onClick={() => { setActiveTab('admin_payments'); setShowMobileMenu(false); }}><span>💳</span> Pagamentos</button>
                  <button className={`mobile-menu-link ${activeTab === 'admin_settings' ? 'active' : ''}`} onClick={() => { setActiveTab('admin_settings'); setShowMobileMenu(false); }}><span>⚙️</span> Configurações Globais</button>
                  <button className={`mobile-menu-link ${activeTab === 'admin_logs' ? 'active' : ''}`} onClick={() => { setActiveTab('admin_logs'); setShowMobileMenu(false); }}><span>📜</span> Histórico & Logs</button>
                </>
              )}

              <div className="mobile-menu-section-title" style={{ marginTop: isAdmin ? '1.5rem' : '0.5rem' }}>Finanças Familiares</div>
              <button className={`mobile-menu-link ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => { setActiveTab('dashboard'); setShowMobileMenu(false); }}><span>📊</span> Dashboard</button>
              <button className={`mobile-menu-link ${activeTab === 'bancos' ? 'active' : ''}`} onClick={() => { setActiveTab('bancos'); setShowMobileMenu(false); }}><span>🏦</span> Bancos & Carteiras</button>
              <button className={`mobile-menu-link ${activeTab === 'transacoes' ? 'active' : ''}`} onClick={() => { setActiveTab('transacoes'); setShowMobileMenu(false); }}><span>💸</span> Transações</button>
              <button className={`mobile-menu-link ${activeTab === 'dividas' ? 'active' : ''}`} onClick={() => { setActiveTab('dividas'); setShowMobileMenu(false); }}><span>⚠️</span> Dívidas</button>
              <button className={`mobile-menu-link ${activeTab === 'pagamentos_fixos' ? 'active' : ''}`} onClick={() => { setActiveTab('pagamentos_fixos'); setShowMobileMenu(false); }}><span>📅</span> Pagamentos Fixos</button>
              <button className={`mobile-menu-link ${activeTab === 'divisas' ? 'active' : ''}`} onClick={() => { setActiveTab('divisas'); setShowMobileMenu(false); }}><span>🌍</span> Câmbio & Divisas</button>
              <button className={`mobile-menu-link ${activeTab === 'projetos' ? 'active' : ''}`} onClick={() => { setActiveTab('projetos'); setShowMobileMenu(false); }}><span>🎯</span> Projetos (Sonhos)</button>
              <button className={`mobile-menu-link ${activeTab === 'gamificacao' ? 'active' : ''}`} onClick={() => { setActiveTab('gamificacao'); setShowMobileMenu(false); }}><span>🎮</span> Desafios Familiares</button>
              <button className={`mobile-menu-link ${activeTab === 'kixikila' ? 'active' : ''}`} onClick={() => { setActiveTab('kixikila'); setShowMobileMenu(false); }}><span>🤝</span> Kixikila</button>
            </div>
            
            <div style={{ marginTop: '1.5rem' }}>
              <button 
                className={`mobile-menu-link ${activeTab === 'planos' ? 'active' : ''}`} 
                onClick={() => { setActiveTab('planos'); setShowMobileMenu(false); }}
                style={{ 
                  background: 'linear-gradient(135deg, rgba(255, 179, 0, 0.15) 0%, rgba(255, 143, 0, 0.15) 100%)', 
                  color: '#ffb300', border: '1px solid rgba(255, 179, 0, 0.3)' 
                }}
              >
                <span>⭐</span> Fazer Upgrade
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
