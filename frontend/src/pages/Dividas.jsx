import React, { useState } from 'react';
import Modal from '../components/Modal';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import { useFinance } from '../contexts/FinanceContext';
import { generateDebtsReport } from '../utils/pdfSpecificGenerators';

export default function Dividas() {
  const { contas, dividas, adicionarDivida, liquidarDivida, eliminarDivida, editarDivida, usuario, mostrarAlerta } = useFinance();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [itemToEdit, setItemToEdit] = useState(null);
  
  // State para o modal de liquidação
  const [liquidationData, setLiquidationData] = useState(null);

  const totalAReceber = dividas.filter(d => !d.paga && d.tipo === 'a_receber').reduce((acc, d) => acc + d.valor, 0);
  const totalAPagar = dividas.filter(d => !d.paga && d.tipo === 'a_pagar').reduce((acc, d) => acc + d.valor, 0);

  const handleSave = (e) => {
    e.preventDefault();
    const novaDivida = {
      pessoa: e.target[0].value,
      finalidade: e.target[1].value,
      valor: Number(e.target[2].value),
      tipo: e.target[3].value,
      dataVencimento: e.target[4].value,
      contaId: e.target[5].value
    };
    
    if (itemToEdit) {
      editarDivida(itemToEdit.id, novaDivida);
    } else {
      adicionarDivida(novaDivida);
    }
    
    setIsModalOpen(false);
    setItemToEdit(null);
  };

  const handleLiquidarClick = (divida) => {
    setLiquidationData(divida);
  };

  const confirmLiquidar = (e) => {
    e.preventDefault();
    const contaId = e.target[0].value;
    liquidarDivida(liquidationData.id, contaId);
    setLiquidationData(null);
  };

  const openNewModal = () => {
    setItemToEdit(null);
    setIsModalOpen(true);
  };

  const openEditModal = (divida) => {
    setItemToEdit(divida);
    setIsModalOpen(true);
  };

  const handleExportPdf = () => {
    if (!usuario?.isPremium) {
      mostrarAlerta('Plano Premium', 'Renove o plano para exportar relatorios PDF profissionais.', 'erro');
      return;
    }

    generateDebtsReport(usuario, dividas);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ color: 'var(--text-primary)' }}>Dívidas e Empréstimos</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-pill" onClick={handleExportPdf} style={{ background: '#e0e0e0', border: 'none', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>📄 Exportar PDF</button>
          <button className="btn btn-primary btn-pill" onClick={openNewModal}>+ Nova Dívida</button>
        </div>
      </div>

      <div className="dashboard-grid-top" style={{ marginBottom: '2rem' }}>
        <div className="dash-card">
          <p className="card-label">Total a Receber (Emprestei)</p>
          <h2 className="card-value positive" style={{ color: 'var(--success-color)' }}>Kz {totalAReceber.toLocaleString()}</h2>
        </div>
        <div className="dash-card">
          <p className="card-label">Total a Pagar (Devo)</p>
          <h2 className="card-value danger" style={{ color: 'var(--danger-color)' }}>Kz {totalAPagar.toLocaleString()}</h2>
        </div>
      </div>

      <div className="dash-card">
        <h3 className="section-title">Controlo de Devedores</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '1rem 0' }}>Pessoa / Entidade</th>
              <th>Finalidade</th>
              <th>Tipo</th>
              <th>Data Limite</th>
              <th style={{ textAlign: 'right' }}>Valor (Kz)</th>
              <th style={{ textAlign: 'right' }}>Ação</th>
            </tr>
          </thead>
          <tbody>
            {dividas.map(d => (
              <tr key={d.id} style={{ borderBottom: '1px solid #f2f3f9', opacity: d.paga ? 0.5 : 1 }}>
                <td style={{ padding: '1rem 0', fontWeight: '500', textDecoration: d.paga ? 'line-through' : 'none' }}>{d.pessoa}</td>
                <td className="text-secondary">{d.finalidade || 'N/A'}</td>
                <td>
                  <span style={{ 
                    background: d.tipo === 'a_receber' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 91, 91, 0.1)', 
                    color: d.tipo === 'a_receber' ? 'var(--success-color)' : 'var(--danger-color)',
                    padding: '0.2rem 0.6rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '600'
                  }}>
                    {d.tipo === 'a_receber' ? 'A Receber' : 'A Pagar'}
                  </span>
                </td>
                <td className="text-secondary">{d.dataVencimento}</td>
                <td style={{ textAlign: 'right', fontWeight: '600' }}>Kz {d.valor.toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', alignItems: 'center' }}>
                    {!d.paga ? (
                      <button 
                        onClick={() => handleLiquidarClick(d)}
                        style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', border: 'none', background: 'var(--accent-color)', color: 'white', cursor: 'pointer' }}
                      >
                        Liquidar
                      </button>
                    ) : (
                      <span style={{ color: 'var(--success-color)', fontWeight: 'bold' }}>Pago ✓</span>
                    )}
                    <button onClick={() => openEditModal(d)} style={{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', fontSize: '1.2rem', padding: '0.5rem' }} title="Editar">✏️</button>
                    <button onClick={() => setItemToDelete(d)} style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', fontSize: '1.2rem', padding: '0.5rem' }} title="Eliminar">🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDeleteModal 
        isOpen={!!itemToDelete} 
        onClose={() => setItemToDelete(null)} 
        onConfirm={() => {
          if (itemToDelete) {
            eliminarDivida(itemToDelete.id);
            setItemToDelete(null);
          }
        }}
        title="Eliminar Dívida"
        message={`Tem a certeza que deseja eliminar a dívida de Kz ${itemToDelete?.valor?.toLocaleString()} com ${itemToDelete?.pessoa}?`}
      />

      {/* Modal de Criação de Dívida */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setItemToEdit(null); }} title={itemToEdit ? "Editar Dívida" : "Registar Dívida / Empréstimo"}>
        <form key={itemToEdit ? itemToEdit.id : 'new'} onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label className="text-secondary" style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.9rem' }}>Pessoa / Entidade</label>
            <input type="text" className="qt-input" defaultValue={itemToEdit?.pessoa || ''} placeholder="Ex: Primo Paulo" required style={{ padding: '0.6rem' }} />
          </div>
          <div>
            <label className="text-secondary" style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.9rem' }}>Finalidade (Para que serviu?)</label>
            <input type="text" className="qt-input" defaultValue={itemToEdit?.finalidade || ''} placeholder="Ex: Obras da casa, Saúde..." required style={{ padding: '0.6rem' }} />
          </div>
          <div>
            <label className="text-secondary" style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.9rem' }}>Valor (Kz)</label>
            <input type="number" className="qt-input" defaultValue={itemToEdit?.valor || ''} placeholder="0.00" required style={{ padding: '0.6rem' }} />
          </div>
          <div>
            <label className="text-secondary" style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.9rem' }}>Tipo</label>
            <select className="qt-input" required defaultValue={itemToEdit?.tipo || 'a_pagar'} style={{ padding: '0.6rem' }}>
              <option value="a_pagar">Eu devo (Alguém me emprestou)</option>
              <option value="a_receber">Me devem (Eu emprestei)</option>
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="text-secondary" style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.9rem' }}>Data Limite</label>
              <input type="date" className="qt-input" required defaultValue={itemToEdit?.dataVencimento || ''} style={{ padding: '0.6rem' }} />
            </div>
            <div>
              <label className="text-secondary" style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.9rem' }}>Conta Associada</label>
              <select className="qt-input" required defaultValue={itemToEdit?.contaId || ''} style={{ padding: '0.6rem' }}>
                {contas.map(conta => (
                  <option key={conta.id} value={conta.id}>{conta.nome} (Kz {conta.saldo.toLocaleString()})</option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-pill" style={{ marginTop: '0.5rem', padding: '0.8rem', fontSize: '1rem' }}>
            {itemToEdit ? 'Salvar Alterações' : 'Adicionar Dívida'}
          </button>
        </form>
      </Modal>

      {/* Modal de Liquidação */}
      <Modal isOpen={!!liquidationData} onClose={() => setLiquidationData(null)} title="Liquidar Registo">
        {liquidationData && (
          <form onSubmit={confirmLiquidar} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p className="text-secondary" style={{ marginBottom: '1rem' }}>
              {liquidationData.tipo === 'a_receber' 
                ? `Onde vai guardar os Kz ${liquidationData.valor.toLocaleString()} recebidos de ${liquidationData.pessoa}?`
                : `De onde vai sair o dinheiro para pagar os Kz ${liquidationData.valor.toLocaleString()} a ${liquidationData.pessoa}?`
              }
            </p>
            <select className="qt-input" required>
              {contas.map(conta => (
                <option key={conta.id} value={conta.id}>{conta.nome} (Saldo: Kz {conta.saldo.toLocaleString()})</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button type="button" className="btn btn-glass btn-pill" style={{ flex: 1 }} onClick={() => setLiquidationData(null)}>Cancelar</button>
              <button type="submit" className="btn btn-primary btn-pill" style={{ flex: 1 }}>Confirmar</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
