import React, { useState } from 'react';
import Modal from '../components/Modal';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import { useFinance } from '../contexts/FinanceContext';

export default function Kixikila() {
  const { kixikilas, contas, adicionarKixikila, editarKixikila, receberMaoKixikila, eliminarKixikila } = useFinance();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReceberModalOpen, setIsReceberModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [itemToEdit, setItemToEdit] = useState(null);
  const [selectedKixikilaId, setSelectedKixikilaId] = useState(null);

  const handleCreate = async (e) => {
    e.preventDefault();
    const novaKixikila = {
      nome: e.target[0].value,
      valorQuota: Number(e.target[1].value),
      periodicidade: e.target[2].value
    };

    if (itemToEdit) {
      const saved = await editarKixikila(itemToEdit.id, novaKixikila);
      if (!saved) return;
    } else {
      await adicionarKixikila(novaKixikila);
    }
    
    setIsModalOpen(false);
    setItemToEdit(null);
  };

  const openNewModal = () => {
    setItemToEdit(null);
    setIsModalOpen(true);
  };

  const openEditModal = (kixikila) => {
    setItemToEdit(kixikila);
    setIsModalOpen(true);
  };

  const handleReceberMao = (e) => {
    e.preventDefault();
    const contaId = e.target[0].value;
    receberMaoKixikila(selectedKixikilaId, contaId);
    setIsReceberModalOpen(false);
  };

  const openReceberModal = (id) => {
    setSelectedKixikilaId(id);
    setIsReceberModalOpen(true);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ color: 'var(--text-primary)' }}>Gestão de Kixikila</h2>
          <p className="text-secondary">Controle os seus grupos de poupança rotativa.</p>
        </div>
        <button className="btn btn-primary btn-pill" onClick={openNewModal}>+ Novo Grupo</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {kixikilas.map(kixikila => (
          <div key={kixikila.id} className="dash-card" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ color: 'var(--accent-color)', marginBottom: '0.2rem' }}>{kixikila.nome}</h3>
                <span className="text-secondary text-sm">{kixikila.membros?.length || 1} Membros • {kixikila.periodicidade}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button onClick={() => openEditModal(kixikila)} style={{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', fontSize: '1.2rem', padding: '0.5rem' }} title="Editar">✏️</button>
                <button onClick={() => setItemToDelete(kixikila)} style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', fontSize: '1.2rem', padding: '0.5rem' }} title="Eliminar">🗑️</button>
                <div style={{ background: '#fef3c7', color: '#d97706', padding: '0.3rem 0.8rem', borderRadius: '15px', fontWeight: 'bold', fontSize: '0.85rem' }}>
                  Mão: {kixikila.minhaPosicao}º
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--glass-border)', borderBottom: '1px solid var(--glass-border)', padding: '1rem 0', margin: '1rem 0', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <p className="text-secondary text-sm">A Minha Quota</p>
                <h4 style={{ color: 'var(--text-primary)' }}>Kz {kixikila.valorQuota.toLocaleString()}</h4>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p className="text-secondary text-sm">Valor da Mão</p>
                <h4 className="text-gradient-accent">Kz {(kixikila.valorMao || 0).toLocaleString()}</h4>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <p className="text-secondary text-sm mb-2">Próxima Mão (Minha vez em: {kixikila.proximaData})</p>
              <div style={{ width: '100%', backgroundColor: '#e5e7eb', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: '60%', backgroundColor: 'var(--accent-color)', height: '100%' }}></div>
              </div>
            </div>

            <button 
              className="btn btn-primary" 
              style={{ width: '100%' }}
              onClick={() => openReceberModal(kixikila.id)}
            >
              Receber Minha Mão
            </button>
          </div>
        ))}
      </div>

      <ConfirmDeleteModal 
        isOpen={!!itemToDelete} 
        onClose={() => setItemToDelete(null)} 
        onConfirm={() => {
          if (itemToDelete) {
            eliminarKixikila(itemToDelete.id);
            setItemToDelete(null);
          }
        }}
        title="Eliminar Kixikila"
        message={`Tem a certeza que deseja eliminar o grupo de Kixikila "${itemToDelete?.nome}"? Todo o histórico de recebimentos será perdido.`}
      />

      {/* Modal de Criação */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setItemToEdit(null); }} title={itemToEdit ? "Editar Grupo" : "Criar Grupo de Kixikila"}>
        <form key={itemToEdit ? itemToEdit.id : 'new'} onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="text-secondary" style={{ display: 'block', marginBottom: '0.5rem' }}>Nome do Grupo</label>
            <input type="text" className="qt-input" defaultValue={itemToEdit?.nome || ''} placeholder="Ex: Kixikila das Amigas" required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="text-secondary" style={{ display: 'block', marginBottom: '0.5rem' }}>Quota (Kz)</label>
              <input type="number" className="qt-input" defaultValue={itemToEdit?.valorQuota || ''} placeholder="0.00" required />
            </div>
            <div>
              <label className="text-secondary" style={{ display: 'block', marginBottom: '0.5rem' }}>Periodicidade</label>
              <select className="qt-input" required defaultValue={itemToEdit?.periodicidade || 'Mensal'}>
                <option value="Mensal">Mensal</option>
                <option value="Quinzenal">Quinzenal</option>
                <option value="Semanal">Semanal</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-pill" style={{ marginTop: '1rem' }}>
            {itemToEdit ? 'Salvar Alterações' : 'Criar Grupo'}
          </button>
        </form>
      </Modal>

      {/* Modal para Receber Mão */}
      <Modal isOpen={isReceberModalOpen} onClose={() => setIsReceberModalOpen(false)} title="Receber Dinheiro">
        <form onSubmit={handleReceberMao} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p className="text-secondary">Onde deseja guardar o dinheiro da Mão?</p>
          <div>
            <label className="text-secondary" style={{ display: 'block', marginBottom: '0.5rem' }}>Conta de Destino</label>
            <select className="qt-input" required style={{ border: '2px solid var(--accent-color)' }}>
              {contas.map(conta => (
                <option key={conta.id} value={conta.id}>{conta.nome} (Saldo atual: Kz {conta.saldo.toLocaleString()})</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-primary btn-pill" style={{ marginTop: '1rem' }}>Confirmar Recebimento</button>
        </form>
      </Modal>

    </div>
  );
}
