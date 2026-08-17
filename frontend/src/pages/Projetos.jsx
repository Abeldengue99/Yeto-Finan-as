import React, { useMemo, useState } from 'react';
import Modal from '../components/Modal';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import { useFinance } from '../contexts/FinanceContext';
import PeriodFilter from '../components/PeriodFilter';
import { createDefaultPeriodFilter, filterByPeriod, getPeriodLabel } from '../utils/periodFilters';

export default function Projetos() {
  const { usuario, projetos, adicionarProjeto, editarProjeto, depositarProjeto, eliminarProjeto, contas, saldoTotal, adicionarNotificacao } = useFinance();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDepositarModalOpen, setIsDepositarModalOpen] = useState(false);
  const [selectedProjetoId, setSelectedProjetoId] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [itemToEdit, setItemToEdit] = useState(null);
  const [periodFilter, setPeriodFilter] = useState(() => createDefaultPeriodFilter('month'));

  const projetosFiltrados = useMemo(
    () => filterByPeriod(projetos, periodFilter, item => item.prazo),
    [projetos, periodFilter]
  );

  const handleCreate = async (e) => {
    e.preventDefault();
    const novoProjeto = {
      nome: e.target[0].value,
      categoria: e.target[1].value,
      objetivo: Number(e.target[2].value),
      valorGuardado: Number(e.target[3].value) || 0,
      prazo: e.target[4].value
    };
    
    if (itemToEdit) {
      const saved = await editarProjeto(itemToEdit.id, novoProjeto);
      if (!saved) return;
    } else {
      await adicionarProjeto(novoProjeto);
    }
    
    setIsModalOpen(false);
    setItemToEdit(null);
  };

  const handleOpenCreateModal = () => {
    setItemToEdit(null);
    if (!usuario?.isPremium && projetos.length >= 2) {
      adicionarNotificacao(
        '⚠️ Limite Atingido', 
        'O plano gratuito permite no máximo 2 projetos ativos. Renove para o Plano Premium para criar projetos ilimitados!'
      );
    } else {
      setIsModalOpen(true);
    }
  };

  const openEditModal = (projeto) => {
    setItemToEdit(projeto);
    setIsModalOpen(true);
  };

  const handleDepositar = (e) => {
    e.preventDefault();
    const contaId = e.target[0].value;
    const montante = e.target[1].value;
    depositarProjeto(selectedProjetoId, contaId, montante);
    setIsDepositarModalOpen(false);
  };

  const openDepositarModal = (id) => {
    setSelectedProjetoId(id);
    setIsDepositarModalOpen(true);
  };

  // Helper para decidir a cor e a mensagem inteligente
  const getInteligenciaProjeto = (projeto) => {
    if (saldoTotal >= projeto.objetivo) {
      return {
        msg: '🎉 Saldo da família é suficiente para realizar agora!',
        cor: 'var(--success-color)',
        podeComprar: true
      };
    }
    
    const falta = projeto.objetivo - saldoTotal;
    return {
      msg: `Faltam Kz ${falta.toLocaleString()} no Saldo Total da família.`,
      cor: 'var(--warning-color)',
      podeComprar: false
    };
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ color: 'var(--text-primary)' }}>Projetos de Vida e Sonhos</h2>
          <p className="text-secondary">Acompanhe os seus grandes objetivos financeiros.</p>
        </div>
        <button className="btn btn-primary btn-pill" onClick={handleOpenCreateModal}>+ Novo Projeto</button>
      </div>

      <div className="page-filter-bar">
        <span className="filter-result-note">
          {projetosFiltrados.length} projeto(s) em {getPeriodLabel(periodFilter)}
        </span>
        <PeriodFilter value={periodFilter} onChange={setPeriodFilter} compact />
      </div>

      {projetosFiltrados.length === 0 ? (
        <div className="dash-card" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          Nenhum projeto encontrado para este filtro.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {projetosFiltrados.map(projeto => {
          const inteligencia = getInteligenciaProjeto(projeto);
          const percentagemGuardada = Math.min((projeto.valorGuardado / projeto.objetivo) * 100, 100);

          return (
            <div key={projeto.id} className="dash-card" style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ color: 'var(--accent-color)', marginBottom: '0.2rem' }}>{projeto.nome}</h3>
                  <span className="text-secondary text-sm">Meta: {projeto.prazo}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button onClick={() => openEditModal(projeto)} style={{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', fontSize: '1.1rem' }} title="Editar">✏️</button>
                  <button onClick={() => setItemToDelete(projeto)} style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', fontSize: '1.1rem' }} title="Eliminar">🗑️</button>
                  <div style={{ fontSize: '1.5rem', marginLeft: '0.5rem' }}>
                    {projeto.categoria === 'veiculo' ? '🚗' : projeto.categoria === 'imovel' ? '🏠' : '🎯'}
                  </div>
                </div>
              </div>

              <div style={{ margin: '1.5rem 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span className="text-secondary text-sm">Específico guardado:</span>
                  <span className="font-bold">Kz {projeto.valorGuardado.toLocaleString()} / Kz {projeto.objetivo.toLocaleString()}</span>
                </div>
                <div style={{ width: '100%', backgroundColor: '#e5e7eb', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${percentagemGuardada}%`, backgroundColor: 'var(--accent-color)', height: '100%' }}></div>
                </div>
              </div>

              {/* Dica Inteligente */}
              <div style={{ 
                padding: '1rem', 
                borderRadius: '15px', 
                background: inteligencia.podeComprar ? 'rgba(16, 185, 129, 0.1)' : 'rgba(252, 168, 52, 0.1)',
                border: `1px solid ${inteligencia.podeComprar ? 'rgba(16, 185, 129, 0.3)' : 'rgba(252, 168, 52, 0.3)'}`
              }}>
                <p style={{ margin: 0, fontSize: '0.9rem', color: inteligencia.cor, fontWeight: '600' }}>
                  {inteligencia.podeComprar ? '💰 Análise:' : '📊 Análise:'}
                </p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  {inteligencia.msg}
                </p>
                {inteligencia.podeComprar && (
                  <button className="btn btn-primary" style={{ width: '100%', padding: '0.5rem', marginTop: '0.8rem', fontSize: '0.85rem' }}>
                    Comprar / Concluir
                  </button>
                )}
                {!inteligencia.podeComprar && (
                  <button 
                    onClick={() => openDepositarModal(projeto.id)}
                    className="btn" 
                    style={{ background: 'white', border: '1px solid var(--accent-color)', color: 'var(--accent-color)', width: '100%', padding: '0.5rem', marginTop: '0.8rem', fontSize: '0.85rem', borderRadius: '8px' }}
                  >
                    Depositar no Projeto
                  </button>
                )}
              </div>
            </div>
          );
        })}
        </div>
      )}

      <ConfirmDeleteModal 
        isOpen={!!itemToDelete} 
        onClose={() => setItemToDelete(null)} 
        onConfirm={() => {
          if (itemToDelete) {
            eliminarProjeto(itemToDelete.id);
            setItemToDelete(null);
          }
        }}
        title="Eliminar Projeto"
        message={`Tem a certeza que deseja eliminar o projeto "${itemToDelete?.nome}"? O valor guardado não será alterado nas contas, apenas o projeto desaparecerá.`}
      />

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setItemToEdit(null); }} title={itemToEdit ? "Editar Projeto" : "Criar Novo Projeto"}>
        <form key={itemToEdit ? itemToEdit.id : 'new'} onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="text-secondary" style={{ display: 'block', marginBottom: '0.5rem' }}>Nome do Projeto</label>
            <input type="text" className="qt-input" defaultValue={itemToEdit?.nome || ''} placeholder="Ex: Viagem ao Dubai, Carro Novo..." required />
          </div>
          <div>
            <label className="text-secondary" style={{ display: 'block', marginBottom: '0.5rem' }}>Categoria</label>
            <select className="qt-input" required defaultValue={itemToEdit?.categoria || 'outro'}>
              <option value="veiculo">Veículo / Viatura</option>
              <option value="imovel">Casa / Imóvel</option>
              <option value="outro">Outro Objetivo</option>
            </select>
          </div>
          <div>
            <label className="text-secondary" style={{ display: 'block', marginBottom: '0.5rem' }}>Valor Necessário (Kz)</label>
            <input type="number" className="qt-input" defaultValue={itemToEdit?.objetivo || ''} placeholder="Ex: 5000000" required />
          </div>
          <div>
            <label className="text-secondary" style={{ display: 'block', marginBottom: '0.5rem' }}>Valor já guardado especificamente (Kz)</label>
            <input type="number" className="qt-input" defaultValue={itemToEdit?.valorGuardado || ''} placeholder="Ex: 0 Se estiver a começar do zero" />
          </div>
          <div>
            <label className="text-secondary" style={{ display: 'block', marginBottom: '0.5rem' }}>Prazo Desejado</label>
            <input type="date" className="qt-input" defaultValue={itemToEdit?.prazo || ''} required />
          </div>
          <button type="submit" className="btn btn-primary btn-pill" style={{ marginTop: '1rem' }}>
            {itemToEdit ? 'Salvar Alterações' : 'Iniciar Projeto'}
          </button>
        </form>
      </Modal>

      {/* Modal para Depositar */}
      <Modal isOpen={isDepositarModalOpen} onClose={() => setIsDepositarModalOpen(false)} title="Depositar num Projeto">
        <form onSubmit={handleDepositar} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="text-secondary" style={{ display: 'block', marginBottom: '0.5rem' }}>De que conta vai tirar o dinheiro?</label>
            <select className="qt-input" required>
              {contas.map(conta => (
                <option key={conta.id} value={conta.id}>{conta.nome} (Saldo: Kz {conta.saldo.toLocaleString()})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-secondary" style={{ display: 'block', marginBottom: '0.5rem' }}>Montante a depositar (Kz)</label>
            <input type="number" className="qt-input" placeholder="0.00" required />
          </div>
          <button type="submit" className="btn btn-primary btn-pill" style={{ marginTop: '1rem' }}>Confirmar Depósito</button>
        </form>
      </Modal>
    </div>
  );
}
