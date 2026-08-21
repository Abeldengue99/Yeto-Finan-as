import React, { useEffect, useState } from 'react';
import { useAdmin } from '../../contexts/AdminContext';
import { useFinance } from '../../contexts/FinanceContext';
import { apiFetch } from '../../utils/api';

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
  const [testimonials, setTestimonials] = useState([]);
  const [isLoadingTestimonials, setIsLoadingTestimonials] = useState(false);
  const [testimonialActionId, setTestimonialActionId] = useState('');
  const [testimonialError, setTestimonialError] = useState('');

  const loadTestimonials = async () => {
    setIsLoadingTestimonials(true);
    setTestimonialError('');
    try {
      const response = await apiFetch('/api/admin/testimonials');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar depoimentos.');
      setTestimonials(Array.isArray(data.testimonials) ? data.testimonials : []);
    } catch (error) {
      setTestimonialError(error.message || 'Erro ao carregar depoimentos.');
    } finally {
      setIsLoadingTestimonials(false);
    }
  };

  useEffect(() => {
    loadTestimonials();
  }, []);

  const handleTestimonialReview = async (testimonialId, action) => {
    setTestimonialActionId(`${testimonialId}-${action}`);
    setTestimonialError('');
    try {
      const response = await apiFetch(`/api/admin/testimonials/${testimonialId}/${action}`, {
        method: 'PUT'
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao moderar depoimento.');

      adicionarNotificacao('Depoimentos', data.message || 'Depoimento atualizado.');
      addLog(data.message || 'Depoimento moderado.', action === 'approve' ? 'success' : 'warning');
      await loadTestimonials();
    } catch (error) {
      setTestimonialError(error.message || 'Erro ao moderar depoimento.');
    } finally {
      setTestimonialActionId('');
    }
  };

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
        const response = await apiFetch('/api/admin/promotions', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
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

  const testimonialStatusLabels = {
    pending: 'Pendente',
    approved: 'Aprovado',
    rejected: 'Rejeitado'
  };

  const pendingTestimonials = testimonials.filter(item => item.status === 'pending').length;


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
        <div className="dash-card" style={{ borderLeft: '4px solid #ffb300' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h3 className="section-title">Depoimentos dos Utilizadores</h3>
              <p className="text-secondary" style={{ fontSize: '0.9rem', margin: 0 }}>
                Aprove apenas os depoimentos que podem aparecer publicamente na tela Como funciona e Planos.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-glass"
              onClick={loadTestimonials}
              disabled={isLoadingTestimonials}
              style={{ padding: '0.75rem 1rem', borderRadius: '12px', fontWeight: 700 }}
            >
              {isLoadingTestimonials ? 'A atualizar...' : 'Atualizar'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ background: 'var(--bg-primary)', borderRadius: '14px', padding: '1rem' }}>
              <strong style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Pendentes</strong>
              <span style={{ fontSize: '2rem', fontWeight: 900, color: '#ffb300' }}>{pendingTestimonials}</span>
            </div>
            <div style={{ background: 'var(--bg-primary)', borderRadius: '14px', padding: '1rem' }}>
              <strong style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Aprovados</strong>
              <span style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--success-color)' }}>{testimonials.filter(item => item.status === 'approved').length}</span>
            </div>
            <div style={{ background: 'var(--bg-primary)', borderRadius: '14px', padding: '1rem' }}>
              <strong style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Rejeitados</strong>
              <span style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--danger-color)' }}>{testimonials.filter(item => item.status === 'rejected').length}</span>
            </div>
          </div>

          {testimonialError && (
            <div style={{ background: '#fff0f0', border: '1px solid #ffc7c7', color: '#ef4444', padding: '1rem', borderRadius: '14px', fontWeight: 700, marginBottom: '1rem' }}>
              {testimonialError}
            </div>
          )}

          <div style={{ display: 'grid', gap: '1rem' }}>
            {testimonials.length === 0 && (
              <div style={{ background: 'var(--bg-primary)', borderRadius: '16px', padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Ainda nao existem depoimentos para moderar.
              </div>
            )}

            {testimonials.map(item => (
              <div key={item.id} style={{ border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '1rem', background: 'rgba(255,255,255,0.75)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '1.05rem' }}>{item.submitter_name}</strong>
                    <p style={{ margin: '0.2rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{item.submitter_email || 'Email nao informado'}</p>
                  </div>
                  <span style={{ background: item.status === 'approved' ? '#dcfce7' : item.status === 'rejected' ? '#fee2e2' : '#fff7d6', color: item.status === 'approved' ? '#059669' : item.status === 'rejected' ? '#ef4444' : '#a86f00', padding: '0.35rem 0.75rem', borderRadius: '999px', fontWeight: 800 }}>
                    {testimonialStatusLabels[item.status] || item.status}
                  </span>
                </div>

                <p style={{ margin: '1rem 0', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                  {item.message}
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <small style={{ color: 'var(--text-secondary)' }}>
                    Enviado em {item.created_at ? new Date(item.created_at).toLocaleDateString('pt-AO') : '-'}
                    {item.reviewed_by_name ? ` | Revisto por ${item.reviewed_by_name}` : ''}
                  </small>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn"
                      disabled={item.status === 'approved' || testimonialActionId === `${item.id}-approve`}
                      onClick={() => handleTestimonialReview(item.id, 'approve')}
                      style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: '12px', padding: '0.7rem 1rem', fontWeight: 800, opacity: item.status === 'approved' ? 0.55 : 1 }}
                    >
                      {testimonialActionId === `${item.id}-approve` ? 'A aprovar...' : 'Aprovar'}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={item.status === 'rejected' || testimonialActionId === `${item.id}-reject`}
                      onClick={() => handleTestimonialReview(item.id, 'reject')}
                      style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '12px', padding: '0.7rem 1rem', fontWeight: 800, opacity: item.status === 'rejected' ? 0.55 : 1 }}
                    >
                      {testimonialActionId === `${item.id}-reject` ? 'A rejeitar...' : 'Rejeitar'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
