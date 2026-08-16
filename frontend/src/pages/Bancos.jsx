import React, { useState } from 'react';
import Modal from '../components/Modal';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import { useFinance } from '../contexts/FinanceContext';

export default function Bancos() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [itemToEdit, setItemToEdit] = useState(null);
  const { contas, adicionarConta, saldoTotal, eliminarConta, editarConta } = useFinance();

  const getBankStyle = (nome) => {
    const name = nome.toLowerCase();
    if (name.includes('bai')) return { cor: '#373392', logo: '🏦' };
    if (name.includes('bfa')) return { cor: '#FF6600', logo: '💳' };
    if (name.includes('bic')) return { cor: '#E3000F', logo: '🏛️' };
    if (name.includes('atlântico') || name.includes('atlantico')) return { cor: '#0055A5', logo: '🌊' };
    if (name.includes('unitel') || name.includes('money')) return { cor: '#FF6600', logo: '📱' };
    if (name.includes('standard')) return { cor: '#0033A0', logo: '🛡️' };
    if (name.includes('sol')) return { cor: '#FFCC00', logo: '☀️' };
    if (name.includes('casa') || name.includes('cofre') || name.includes('físico') || name.includes('dinheiro')) return { cor: '#10b981', logo: '💵' };
    
    return { cor: '#373392', logo: '🏦' }; // Default
  };

  const handleSave = (e) => {
    e.preventDefault();
    const nome = e.target[0].value;
    const style = getBankStyle(nome);
    
    const novaConta = {
      nome: nome,
      tipo: e.target[1].options[e.target[1].selectedIndex].text,
      saldo: Number(e.target[2].value),
      iban: e.target[3].value || '',
      cor: style.cor,
      sigla: style.logo
    };

    if (itemToEdit) {
      editarConta(itemToEdit.id, novaConta);
    } else {
      adicionarConta(novaConta);
    }
    
    setIsModalOpen(false);
    setItemToEdit(null);
  };

  const openNewModal = () => {
    setItemToEdit(null);
    setIsModalOpen(true);
  };

  const openEditModal = (conta) => {
    setItemToEdit(conta);
    setIsModalOpen(true);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ color: 'var(--text-primary)' }}>Gestão de Bancos & Carteiras</h2>
          <p className="text-secondary">Acompanhe onde o seu dinheiro está guardado.</p>
        </div>
        <button className="btn btn-primary btn-pill" onClick={openNewModal}>+ Adicionar Conta</button>
      </div>

      <div className="dash-card primary-card" style={{ marginBottom: '2rem', background: 'linear-gradient(135deg, var(--accent-color), #201e56)' }}>
        <p className="card-label" style={{ color: 'rgba(255,255,255,0.8)' }}>Património Total Disponível</p>
        <h2 className="card-value">Kz {saldoTotal.toLocaleString()}</h2>
        <div className="card-trend" style={{ color: 'rgba(255,255,255,0.9)' }}>Distribuído por {contas.length} contas</div>
      </div>

      <h3 className="section-title">As Minhas Contas</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
        {contas.map(conta => {
          const style = getBankStyle(conta.nome);
          const logo = conta.sigla?.length > 3 ? conta.sigla : style.logo;
          const cor = conta.cor || style.cor;
          
          return (
            <div key={conta.id} className="dash-card" style={{ position: 'relative', overflow: 'hidden', paddingBottom: '1.5rem' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '6px', height: '100%', backgroundColor: cor }}></div>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ 
                    width: '50px', height: '50px', borderRadius: '15px', 
                    backgroundColor: `${cor}15`, color: cor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.5rem'
                  }}>
                    {logo}
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{conta.nome}</h4>
                    <span className="text-secondary text-sm">{conta.tipo}</span>
                  </div>
                </div>
                <div>
                  <button onClick={() => openEditModal(conta)} style={{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', fontSize: '1.2rem', padding: '0.5rem' }} title="Editar">✏️</button>
                  <button onClick={() => setItemToDelete(conta)} style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', fontSize: '1.2rem', padding: '0.5rem' }} title="Eliminar">🗑️</button>
                </div>
              </div>
              
              <div>
                <p className="text-secondary text-sm" style={{ marginBottom: '0.2rem' }}>Saldo Atual</p>
                <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.5rem' }}>Kz {conta.saldo.toLocaleString()}</h3>
              </div>
              
              {conta.iban && (
                <div style={{ marginTop: '1rem', padding: '0.8rem', background: '#f8f9fa', borderRadius: '8px', border: '1px dashed #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p className="text-secondary" style={{ fontSize: '0.75rem', margin: 0 }}>IBAN</p>
                    <p style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.85rem' }}>{conta.iban}</p>
                  </div>
                  <button 
                    onClick={() => navigator.clipboard.writeText(conta.iban)}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer' }}
                    title="Copiar IBAN"
                  >
                    📋
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmDeleteModal 
        isOpen={!!itemToDelete} 
        onClose={() => setItemToDelete(null)} 
        onConfirm={() => {
          if (itemToDelete) {
            eliminarConta(itemToDelete.id);
            setItemToDelete(null);
          }
        }}
        title="Eliminar Conta"
        message={`Tem a certeza que deseja eliminar a conta "${itemToDelete?.nome}"? Todo o saldo associado deixará de constar no seu património.`}
      />

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setItemToEdit(null); }} title={itemToEdit ? "Editar Conta Bancária" : "Nova Conta Bancária"}>
        <form key={itemToEdit ? itemToEdit.id : 'new'} onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="text-secondary" style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.9rem' }}>Nome do Banco / Local</label>
            <input type="text" className="qt-input" defaultValue={itemToEdit?.nome || ''} placeholder="Ex: BAI, BFA, Dinheiro em Casa..." required />
          </div>
          <div>
            <label className="text-secondary" style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.9rem' }}>Tipo de Conta</label>
            <select className="qt-input" required defaultValue={itemToEdit?.tipo === 'Conta Corrente' ? 'corrente' : itemToEdit?.tipo === 'Conta Poupança' ? 'poupanca' : itemToEdit?.tipo === 'Carteira Digital' ? 'carteira' : 'dinheiro'}>
              <option value="corrente">Conta Corrente</option>
              <option value="poupanca">Conta Poupança</option>
              <option value="carteira">Carteira Digital (Ex: Unitel Money)</option>
              <option value="dinheiro">Dinheiro Físico</option>
            </select>
          </div>
          <div>
            <label className="text-secondary" style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.9rem' }}>Saldo Atual (Kz)</label>
            <input type="number" className="qt-input" defaultValue={itemToEdit?.saldo || ''} placeholder="0.00" required />
          </div>
          <div>
            <label className="text-secondary" style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.9rem' }}>IBAN (Opcional, para facilitar partilha)</label>
            <input type="text" className="qt-input" defaultValue={itemToEdit?.iban || ''} placeholder="AO06..." />
          </div>
          <button type="submit" className="btn btn-primary btn-pill" style={{ marginTop: '1rem', padding: '0.8rem', fontSize: '1rem' }}>
            {itemToEdit ? 'Salvar Alterações' : 'Adicionar Conta'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
