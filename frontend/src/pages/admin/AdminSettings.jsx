import React, { useState } from 'react';
import { useAdmin } from '../../contexts/AdminContext';
import { useFinance } from '../../contexts/FinanceContext';

export default function AdminSettings() {
  const { planPrices, setPlanPrices, systemSettings, setSystemSettings, addLog } = useAdmin();
  const { adicionarNotificacao } = useFinance();
  
  const [novosPrecos, setNovosPrecos] = useState(planPrices);
  const [mensagem, setMensagem] = useState(systemSettings.globalAlert.message);
  const [tipoAlerta, setTipoAlerta] = useState(systemSettings.globalAlert.type);
  const [isAlertaAtivo, setIsAlertaAtivo] = useState(systemSettings.globalAlert.active);

  // Marketing Email States
  const [emailSubject, setEmailSubject] = useState('');
  const [emailContent, setEmailContent] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const handlePriceUpdate = (e) => {
    e.preventDefault();
    if (window.confirm('Tem a certeza que deseja atualizar o preçário dos planos?')) {
      setPlanPrices({
        semestral: Number(novosPrecos.semestral),
        anual: Number(novosPrecos.anual)
      });
      addLog(`Preçário atualizado (Semestral: ${novosPrecos.semestral}Kz | Anual: ${novosPrecos.anual}Kz)`, 'warning');
      adicionarNotificacao('Sucesso', 'Preçário atualizado com sucesso!');
    }
  };

  const handleSystemStatusUpdate = (modo, valor) => {
    if (window.confirm(`Tem a certeza que deseja alterar o estado do sistema?`)) {
      setSystemSettings(prev => ({ ...prev, [modo]: valor }));
      addLog(`Alteração de Sistema: ${modo} definido para ${valor ? 'Ativo' : 'Inativo'}`, valor ? 'warning' : 'success');
      adicionarNotificacao('Sistema Atualizado', `A configuração de automação foi alterada.`);
    }
  };

  const handleBroadcast = (e) => {
    e.preventDefault();
    if (window.confirm('Tem a certeza que deseja aplicar este aviso global?')) {
      setSystemSettings(prev => ({
        ...prev,
        globalAlert: { active: isAlertaAtivo, type: tipoAlerta, message: mensagem }
      }));
      if (isAlertaAtivo) {
        addLog(`Aviso Global Ativo: "${mensagem}"`, 'info');
        adicionarNotificacao('Aviso Atualizado', 'O banner global está agora visível para os utilizadores.');
      } else {
        addLog(`Aviso Global Removido`, 'success');
        adicionarNotificacao('Aviso Removido', 'O banner global foi ocultado.');
      }
    }
  };

  const handleSendMassEmail = async (e) => {
    e.preventDefault();
    if (window.confirm('Tem a certeza que deseja disparar este email para TODOS os utilizadores verificados?')) {
      setIsSendingEmail(true);
      try {
        // No Yeto o admin login usa mock no Node/PG, adaptamos a chamada
        const response = await fetch('http://localhost:5000/api/admin/promotions', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            // Autenticação básica ou bearer
            'Authorization': 'Bearer admin-token'
          },
          body: JSON.stringify({ subject: emailSubject, htmlContent: emailContent })
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Erro ao enviar emails.');
        
        adicionarNotificacao('Marketing', data.message);
        addLog(`Envio de Promoção: "${emailSubject}"`, 'info');
        setEmailSubject('');
        setEmailContent('');
      } catch (err) {
        alert(err.message);
        adicionarNotificacao('Erro no Envio', err.message);
      } finally {
        setIsSendingEmail(false);
      }
    }
  };


  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">⚙️ Configurações Globais</h1>
        <p className="text-secondary">Controlo centralizado das automações e definições do Yeto Finanças</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        
        {/* Painel de Automação de Sistema */}
        <div className="dash-card" style={{ borderLeft: '4px solid var(--danger-color)' }}>
          <h3 className="section-title">Automações do Sistema</h3>
          <p className="text-secondary" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Ações críticas de manutenção e acesso.
          </p>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', padding: '1rem', background: 'var(--bg-primary)', borderRadius: '8px' }}>
            <div>
              <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>Modo de Manutenção</h4>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tirar o site do ar para os utilizadores normais</p>
            </div>
            <label className="switch">
              <input type="checkbox" checked={systemSettings.maintenanceMode} onChange={(e) => handleSystemStatusUpdate('maintenanceMode', e.target.checked)} />
              <span className="slider round"></span>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--bg-primary)', borderRadius: '8px' }}>
            <div>
              <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>Novos Registos</h4>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Permitir a criação de novas contas</p>
            </div>
            <label className="switch">
              <input type="checkbox" checked={systemSettings.allowRegistrations} onChange={(e) => handleSystemStatusUpdate('allowRegistrations', e.target.checked)} />
              <span className="slider round"></span>
            </label>
          </div>
        </div>

        {/* Painel de Preços (Pacotes) */}
        <div className="dash-card">
          <h3 className="section-title">Preçário (Pacotes)</h3>
          <p className="text-secondary" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Atualize o custo das subscrições. As alterações afetarão os novos pagamentos.
          </p>

          <form onSubmit={handlePriceUpdate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
              <div className="input-group">
                <label>Plano Semestral (Kz)</label>
                <input type="number" value={novosPrecos.semestral} onChange={(e) => setNovosPrecos({...novosPrecos, semestral: e.target.value})} className="qt-input" />
              </div>
              <div className="input-group">
                <label>Plano Anual (Kz)</label>
                <input type="number" value={novosPrecos.anual} onChange={(e) => setNovosPrecos({...novosPrecos, anual: e.target.value})} className="qt-input" />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '0.8rem' }}>
              Atualizar Preços
            </button>
          </form>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
        {/* Painel de Comunicados / Banner */}
        <div className="dash-card" style={{ borderLeft: '4px solid var(--accent-color)' }}>
          <h3 className="section-title">Aviso Global (Banner de Nova Versão/Manutenção)</h3>
          <p className="text-secondary" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Apresente uma mensagem no topo do ecrã de todos os utilizadores para avisos urgentes ou atualizações.
          </p>

          <form onSubmit={handleBroadcast}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '1rem', marginBottom: '1rem' }}>
              <div className="input-group">
                <label>Tipo de Alerta</label>
                <select value={tipoAlerta} onChange={(e) => setTipoAlerta(e.target.value)} className="qt-input" style={{ width: '100%', padding: '0.8rem' }}>
                  <option value="info">ℹ️ Informativo (Azul)</option>
                  <option value="warning">⚠️ Aviso (Amarelo)</option>
                  <option value="danger">🚨 Urgente (Vermelho)</option>
                  <option value="success">✅ Sucesso (Verde)</option>
                </select>
              </div>
              <div className="input-group">
                <label>Status do Banner</label>
                <div style={{ display: 'flex', alignItems: 'center', height: '100%', gap: '1rem' }}>
                  <label className="switch">
                    <input type="checkbox" checked={isAlertaAtivo} onChange={(e) => setIsAlertaAtivo(e.target.checked)} />
                    <span className="slider round"></span>
                  </label>
                  <span style={{ fontWeight: 'bold', color: isAlertaAtivo ? 'var(--success-color)' : 'var(--text-secondary)' }}>
                    {isAlertaAtivo ? 'Ativo (Visível para Todos)' : 'Inativo (Oculto)'}
                  </span>
                </div>
              </div>
            </div>

            <div className="input-group" style={{ marginTop: '1rem' }}>
              <label>Mensagem a ser Apresentada</label>
              <textarea 
                value={mensagem} 
                onChange={(e) => setMensagem(e.target.value)} 
                className="qt-input" 
                placeholder="Ex: A versão 2.0 do Yeto Finanças já está disponível! Novas funcionalidades foram adicionadas..."
                rows="3"
                required={isAlertaAtivo}
                style={{ resize: 'none' }}
              />
            </div>
            
            <button type="submit" className="btn" style={{ background: 'var(--accent-gradient)', color: 'white', width: '100%', marginTop: '1rem', padding: '0.8rem', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
              📢 Guardar e Aplicar Configuração do Banner
            </button>
          </form>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', marginTop: '2rem' }}>
        {/* Painel de Email Marketing */}
        <div className="dash-card" style={{ borderLeft: '4px solid #373392' }}>
          <h3 className="section-title">📧 Disparo de Email Marketing (Brevo)</h3>
          <p className="text-secondary" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Envie promoções, novidades ou newsletters para todos os utilizadores da plataforma de forma instantânea.
          </p>

          <form onSubmit={handleSendMassEmail}>
            <div className="input-group">
              <label>Assunto do Email</label>
              <input 
                type="text" 
                value={emailSubject} 
                onChange={(e) => setEmailSubject(e.target.value)} 
                className="qt-input" 
                placeholder="Ex: 🚀 Promoção Especial: 50% de Desconto no Plano Anual!"
                required
              />
            </div>

            <div className="input-group" style={{ marginTop: '1rem' }}>
              <label>Conteúdo (Aceita código HTML simples)</label>
              <textarea 
                value={emailContent} 
                onChange={(e) => setEmailContent(e.target.value)} 
                className="qt-input" 
                placeholder="<h2>Olá, Família Yeto!</h2><p>Temos novidades fresquinhas...</p>"
                rows="6"
                required
                style={{ resize: 'vertical', fontFamily: 'monospace' }}
              />
            </div>
            
            <button 
              type="submit" 
              disabled={isSendingEmail}
              className="btn" 
              style={{ background: '#373392', color: 'white', width: '100%', marginTop: '1rem', padding: '0.8rem', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', opacity: isSendingEmail ? 0.7 : 1 }}
            >
              {isSendingEmail ? 'A DISPARAR EMAILS...' : '🚀 DISPARAR PARA TODOS OS UTILIZADORES'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
