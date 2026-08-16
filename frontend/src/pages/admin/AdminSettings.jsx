import React, { useState } from 'react';
import { useAdmin } from '../../contexts/AdminContext';
import { useFinance } from '../../contexts/FinanceContext';

export default function AdminSettings() {
  const { premiumPrice, setPremiumPrice, addLog } = useAdmin();
  const { adicionarNotificacao } = useFinance();
  
  const [novoPreco, setNovoPreco] = useState(premiumPrice);
  const [mensagem, setMensagem] = useState('');
  const [titulo, setTitulo] = useState('');

  const handlePriceUpdate = (e) => {
    e.preventDefault();
    if (novoPreco === premiumPrice) return;
    
    if (window.confirm(`Tem a certeza que deseja atualizar o preço do Premium para ${novoPreco} Kz?`)) {
      setPremiumPrice(Number(novoPreco));
      addLog(`Preço do plano Premium atualizado de ${premiumPrice} para ${novoPreco} Kz`, 'warning');
      adicionarNotificacao('Sucesso', 'Preço atualizado com sucesso!');
    }
  };

  const handleBroadcast = (e) => {
    e.preventDefault();
    if (!titulo || !mensagem) return;

    if (window.confirm('Tem a certeza que deseja enviar esta notificação para TODOS os utilizadores?')) {
      adicionarNotificacao(titulo, mensagem);
      addLog(`Notificação Global enviada: "${titulo}"`, 'info');
      adicionarNotificacao('Sucesso', 'Comunicado enviado com sucesso para todos os utilizadores!');
      setTitulo('');
      setMensagem('');
    }
  };

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">⚙️ Configurações Globais</h1>
        <p className="text-secondary">Controlo centralizado das definições do Yeto Finanças</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        
        {/* Painel de Preços */}
        <div className="dash-card">
          <h3 className="section-title">Preçário</h3>
          <p className="text-secondary" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Atualize o custo da subscrição mensal do Plano Premium. Esta alteração afetará os novos pagamentos.
          </p>

          <form onSubmit={handlePriceUpdate}>
            <div className="input-group">
              <label>Preço Atual (Kz)</label>
              <input 
                type="number" 
                value={novoPreco} 
                onChange={(e) => setNovoPreco(e.target.value)} 
                className="qt-input" 
                style={{ fontSize: '1.2rem', fontWeight: 'bold' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '0.8rem' }}>
              Atualizar Preço
            </button>
          </form>
        </div>

        {/* Painel de Comunicados */}
        <div className="dash-card">
          <h3 className="section-title">Comunicados Globais</h3>
          <p className="text-secondary" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Envie uma notificação que aparecerá no "Sininho" de todos os utilizadores (Broadcast).
          </p>

          <form onSubmit={handleBroadcast}>
            <div className="input-group">
              <label>Título do Comunicado</label>
              <input 
                type="text" 
                value={titulo} 
                onChange={(e) => setTitulo(e.target.value)} 
                className="qt-input" 
                placeholder="Ex: Manutenção Agendada"
                required
              />
            </div>
            <div className="input-group" style={{ marginTop: '1rem' }}>
              <label>Mensagem</label>
              <textarea 
                value={mensagem} 
                onChange={(e) => setMensagem(e.target.value)} 
                className="qt-input" 
                placeholder="Escreva aqui a mensagem para os utilizadores..."
                rows="4"
                required
                style={{ resize: 'none' }}
              />
            </div>
            <button type="submit" className="btn" style={{ background: 'var(--accent-gradient)', color: 'white', width: '100%', marginTop: '1rem', padding: '0.8rem', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
              📢 Enviar para Todos
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
