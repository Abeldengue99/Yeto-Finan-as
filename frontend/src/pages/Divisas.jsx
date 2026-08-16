import React, { useState } from 'react';
import Modal from '../components/Modal';
import { useFinance } from '../contexts/FinanceContext';

export default function Divisas() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { usuario, contas, divisas, adicionarDivisa, adicionarNotificacao } = useFinance();

  // Mock de câmbio em tempo real (poderia vir de uma API no futuro)
  const taxasAtuais = {
    USD: 950,
    EUR: 1020
  };

  const handleOpenModal = () => {
    if (!usuario?.isPremium) {
      adicionarNotificacao(
        '⚠️ Funcionalidade Premium', 
        'A gestão de câmbio e divisas é exclusiva do Plano Premium. Renove o seu plano para investir em moedas estrangeiras.'
      );
    } else {
      setIsModalOpen(true);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    const novaDivisa = {
      moeda: e.target[0].value,
      montante: Number(e.target[1].value),
      taxaCompra: Number(e.target[2].value),
      contaId: e.target[3].value,
      dataCompra: new Date().toISOString().split('T')[0]
    };
    
    adicionarDivisa(novaDivisa);
    setIsModalOpen(false);
  };

  // Cálculo de Valorização Global
  let valorInvestidoGlobal = 0;
  let valorAtualGlobal = 0;

  divisas.forEach(d => {
    const investido = d.montante * d.taxaCompra;
    const atual = d.montante * (taxasAtuais[d.moeda] || d.taxaCompra);
    valorInvestidoGlobal += investido;
    valorAtualGlobal += atual;
  });

  const lucroGlobal = valorAtualGlobal - valorInvestidoGlobal;
  const isLucro = lucroGlobal >= 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ color: 'var(--text-primary)' }}>Gestão de Câmbio & Divisas</h2>
          <p className="text-secondary">Acompanhe a valorização do seu dinheiro em moeda estrangeira.</p>
        </div>
        <button className="btn btn-primary btn-pill" onClick={handleOpenModal}>🌍 Comprar Divisa</button>
      </div>

      {/* Cartão de Resumo de Valorização */}
      <div style={{
        background: isLucro ? 'var(--success-color)' : 'var(--danger-color)',
        borderRadius: '24px', padding: '2rem', color: 'white', marginBottom: '2rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
      }}>
        <div>
          <p style={{ margin: '0 0 0.5rem 0', opacity: 0.9 }}>Performance do Câmbio</p>
          <h2 style={{ margin: 0, fontSize: '2.5rem' }}>{isLucro ? '+' : ''}{lucroGlobal.toLocaleString()} Kz</h2>
          <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9 }}>
            Valor investido: {valorInvestidoGlobal.toLocaleString()} Kz | Valor atual: {valorAtualGlobal.toLocaleString()} Kz
          </p>
        </div>
        <div style={{ fontSize: '4rem', opacity: 0.8 }}>
          {isLucro ? '📈' : '📉'}
        </div>
      </div>

      <div className="dash-card">
        <h3 className="section-title">A sua Carteira de Divisas</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '1rem 0' }}>Ativo</th>
              <th>Montante</th>
              <th>Taxa de Compra</th>
              <th>Taxa Atual</th>
              <th style={{ textAlign: 'right' }}>Valorização</th>
            </tr>
          </thead>
          <tbody>
            {divisas.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Ainda não tem divisas registadas.</td>
              </tr>
            ) : (
              divisas.map(d => {
                const taxaAtual = taxasAtuais[d.moeda] || d.taxaCompra;
                const investido = d.montante * d.taxaCompra;
                const atual = d.montante * taxaAtual;
                const diferenca = atual - investido;
                const teveLucro = diferenca >= 0;

                return (
                  <tr key={d.id} style={{ borderBottom: '1px solid #f2f3f9' }}>
                    <td style={{ padding: '1rem 0', fontWeight: 'bold' }}>
                      <span style={{ fontSize: '1.2rem', marginRight: '0.5rem' }}>
                        {d.moeda === 'USD' ? '🇺🇸' : '🇪🇺'}
                      </span>
                      {d.moeda}
                    </td>
                    <td style={{ fontWeight: '500' }}>{d.montante.toLocaleString()}</td>
                    <td className="text-secondary">{d.taxaCompra} Kz</td>
                    <td style={{ fontWeight: 'bold' }}>{taxaAtual} Kz</td>
                    <td style={{ 
                      textAlign: 'right', fontWeight: '600', 
                      color: teveLucro ? 'var(--success-color)' : 'var(--danger-color)' 
                    }}>
                      {teveLucro ? '+' : ''}{diferenca.toLocaleString()} Kz
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Comprar Divisas">
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="text-secondary" style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.9rem' }}>Moeda</label>
              <select className="qt-input" required>
                <option value="USD">Dólar (USD)</option>
                <option value="EUR">Euro (EUR)</option>
              </select>
            </div>
            <div>
              <label className="text-secondary" style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.9rem' }}>Montante (Qtd)</label>
              <input type="number" className="qt-input" placeholder="Ex: 500" required />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="text-secondary" style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.9rem' }}>A que taxa comprou?</label>
              <input type="number" className="qt-input" placeholder="Ex: 850 Kz" required />
            </div>
            <div>
              <label className="text-secondary" style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.9rem' }}>O dinheiro saiu de onde?</label>
              <select className="qt-input" required>
                {contas.map(conta => (
                  <option key={conta.id} value={conta.id}>{conta.nome} (Saldo: {conta.saldo.toLocaleString()} Kz)</option>
                ))}
              </select>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-pill" style={{ marginTop: '1rem', padding: '0.8rem', fontSize: '1rem' }}>
            Registar Compra
          </button>
        </form>
      </Modal>
    </div>
  );
}
