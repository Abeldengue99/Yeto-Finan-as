import React, { useState } from 'react';
import Modal from '../components/Modal';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import { useFinance } from '../contexts/FinanceContext';

export default function PagamentosFixos() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [itemToEdit, setItemToEdit] = useState(null);
  const { pagamentosFixos, adicionarPagamentoFixo, editarPagamentoFixo, marcarPagamentoFixoComoPago, contas, registrarDespesa, adicionarNotificacao, eliminarPagamentoFixo } = useFinance();

  // Função chamada ao enviar o form de novo pagamento
  const handleSave = (e) => {
    e.preventDefault();
    const novo = {
      nome: e.target[0].value,
      valor: Number(e.target[1].value),
      diaVencimento: Number(e.target[2].value),
      categoria: e.target[3].value
    };
    
    if (itemToEdit) {
      editarPagamentoFixo(itemToEdit.id, novo);
    } else {
      adicionarPagamentoFixo(novo);
    }
    
    setIsModalOpen(false);
    setItemToEdit(null);
  };

  const openNewModal = () => {
    setItemToEdit(null);
    setIsModalOpen(true);
  };

  const openEditModal = (pagamento) => {
    setItemToEdit(pagamento);
    setIsModalOpen(true);
  };

  // Lógica para simular o pagamento da conta fixa
  const pagarAgora = (pagamento) => {
    // 1. Mostrar um aviso ou registar a despesa (simplificado: tira o dinheiro da primeira conta)
    const contaPrincipalId = contas[0]?.id;
    if (!contaPrincipalId) {
      adicionarNotificacao('Atenção', 'Adicione uma conta primeiro antes de pagar uma despesa fixa.');
      return;
    }
    
    // Regista como uma despesa normal para sair do saldo
    registrarDespesa({
      descricao: `Pagamento Fixo: ${pagamento.nome}`,
      valor: pagamento.valor,
      categoria: pagamento.categoria,
      contaId: contaPrincipalId,
      data: new Date().toISOString().split('T')[0]
    });

    // Marca como pago no calendário de fixos
    marcarPagamentoFixoComoPago(pagamento.id);
  };

  // Calcular métricas
  const totalFixos = pagamentosFixos.reduce((acc, p) => acc + p.valor, 0);
  const totalPago = pagamentosFixos.filter(p => p.pagoEsteMes).reduce((acc, p) => acc + p.valor, 0);
  const faltaPagar = totalFixos - totalPago;
  const mesAtual = new Date().toLocaleString('pt-PT', { month: 'long' });
  const diaHoje = new Date().getDate();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ color: 'var(--text-primary)' }}>Pagamentos Fixos e RUPEs</h2>
          <p className="text-secondary">Automatize as suas propinas, internet e seguros mensais.</p>
        </div>
        <button className="btn btn-primary btn-pill" onClick={openNewModal}>📅 Novo Pagamento</button>
      </div>

      {/* Cartões de Resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="dash-card">
          <p className="card-label">Total a Pagar ({mesAtual.charAt(0).toUpperCase() + mesAtual.slice(1)})</p>
          <h2 className="card-value">Kz {totalFixos.toLocaleString()}</h2>
        </div>
        <div className="dash-card" style={{ background: 'var(--success-color)', color: 'white' }}>
          <p style={{ margin: '0 0 0.5rem 0', opacity: 0.8 }}>Já Pago</p>
          <h2 style={{ margin: 0, fontSize: '1.8rem' }}>Kz {totalPago.toLocaleString()}</h2>
        </div>
        <div className="dash-card" style={{ background: 'var(--danger-color)', color: 'white' }}>
          <p style={{ margin: '0 0 0.5rem 0', opacity: 0.8 }}>Falta Pagar</p>
          <h2 style={{ margin: 0, fontSize: '1.8rem' }}>Kz {faltaPagar.toLocaleString()}</h2>
        </div>
      </div>

      <div className="dash-card">
        <h3 className="section-title">Calendário do Mês</h3>
        
        {pagamentosFixos.length === 0 ? (
          <p className="text-secondary" style={{ textAlign: 'center', padding: '2rem' }}>Não tem pagamentos fixos configurados.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {pagamentosFixos.map(p => {
              // Calcular urgência
              let corEstado = '#10b981'; // Pago
              let textoEstado = 'Pago';
              let estaAtrasado = false;
              let warning = false;

              if (!p.pagoEsteMes) {
                if (diaHoje > p.diaVencimento) {
                  corEstado = 'var(--danger-color)';
                  textoEstado = 'Em Atraso!';
                  estaAtrasado = true;
                } else if (p.diaVencimento - diaHoje <= 3) {
                  corEstado = 'var(--warning-color)';
                  textoEstado = 'Vence Brevemente';
                  warning = true;
                } else {
                  corEstado = '#8a8ca3';
                  textoEstado = 'Aguardando Data';
                }
              }

              return (
                <div key={p.id} style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                  padding: '1.5rem', borderRadius: '15px', border: `1px solid ${p.pagoEsteMes ? 'var(--glass-border)' : 'rgba(55,51,146,0.1)'}`,
                  background: p.pagoEsteMes ? '#f9fafb' : 'white',
                  borderLeft: `5px solid ${corEstado}`
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                      <h4 style={{ margin: 0, fontSize: '1.1rem', textDecoration: p.pagoEsteMes ? 'line-through' : 'none', color: p.pagoEsteMes ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                        {p.nome}
                      </h4>
                      <span style={{ 
                        fontSize: '0.75rem', fontWeight: 'bold', padding: '0.2rem 0.6rem', borderRadius: '10px', 
                        background: `${corEstado}20`, color: corEstado 
                      }}>
                        {textoEstado}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      Dia {p.diaVencimento} • {p.categoria}
                    </p>
                  </div>
                  
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                      <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: p.pagoEsteMes ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                        {p.valor.toLocaleString()} Kz
                      </div>
                      {!p.pagoEsteMes && (
                        <button 
                          onClick={() => pagarAgora(p)}
                          className={`btn btn-pill ${warning || estaAtrasado ? 'btn-primary' : 'btn-glass'}`} 
                          style={{ background: warning || estaAtrasado ? corEstado : '', border: 'none', color: warning || estaAtrasado ? 'white' : 'var(--accent-color)', fontWeight: 'bold' }}
                        >
                          Pagar Agora
                        </button>
                      )}
                      <div>
                        <button onClick={() => openEditModal(p)} style={{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', fontSize: '1.2rem', padding: '0.5rem' }} title="Editar">✏️</button>
                        <button onClick={() => setItemToDelete(p)} style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', fontSize: '1.2rem', padding: '0.5rem' }} title="Eliminar">🗑️</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <ConfirmDeleteModal 
          isOpen={!!itemToDelete} 
          onClose={() => setItemToDelete(null)} 
          onConfirm={() => {
            if (itemToDelete) {
              eliminarPagamentoFixo(itemToDelete.id);
              setItemToDelete(null);
            }
          }}
          title="Eliminar Pagamento Fixo"
          message={`Tem a certeza que deseja eliminar o pagamento mensal "${itemToDelete?.nome}"?`}
        />

        <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setItemToEdit(null); }} title={itemToEdit ? "Editar Pagamento Fixo" : "Novo Pagamento Fixo"}>
        <form key={itemToEdit ? itemToEdit.id : 'new'} onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="text-secondary" style={{ display: 'block', marginBottom: '0.5rem' }}>Nome da Despesa</label>
            <input type="text" className="qt-input" defaultValue={itemToEdit?.nome || ''} placeholder="Ex: Mensalidade Colégio..." required />
          </div>
          <div>
            <label className="text-secondary" style={{ display: 'block', marginBottom: '0.5rem' }}>Valor Mensal (Kz)</label>
            <input type="number" className="qt-input" defaultValue={itemToEdit?.valor || ''} placeholder="0.00" required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="text-secondary" style={{ display: 'block', marginBottom: '0.5rem' }}>Dia do Vencimento (1 a 31)</label>
              <input type="number" min="1" max="31" className="qt-input" defaultValue={itemToEdit?.diaVencimento || ''} required />
            </div>
            <div>
              <label className="text-secondary" style={{ display: 'block', marginBottom: '0.5rem' }}>Categoria</label>
              <select className="qt-input" defaultValue={itemToEdit?.categoria || 'Educação'} required>
                <option value="Educação">Educação</option>
                <option value="Casa">Casa (Renda/Luz/Água)</option>
                <option value="Serviços">Serviços (Net/TV)</option>
                <option value="Saúde">Saúde (Seguro)</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-pill" style={{ marginTop: '1rem' }}>
            {itemToEdit ? 'Salvar Alterações' : 'Adicionar à Agenda'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
