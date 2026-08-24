import React, { useMemo, useState } from 'react';
import Modal from '../components/Modal';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import { useFinance } from '../contexts/FinanceContext';
import { generateTransactionsReport } from '../utils/pdfSpecificGenerators';
import PeriodFilter from '../components/PeriodFilter';
import { createDefaultPeriodFilter, filterByPeriod, getPeriodLabel } from '../utils/periodFilters';
import ImportadorExtrato from '../components/ImportadorExtrato';


export default function Transacoes() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoriaModalOpen, setIsCategoriaModalOpen] = useState(false);
  const [tipoTransacao, setTipoTransacao] = useState('saida');
  const [itemToDelete, setItemToDelete] = useState(null);
  const [itemToEdit, setItemToEdit] = useState(null);
  const [periodFilter, setPeriodFilter] = useState(() => createDefaultPeriodFilter('month'));
  const [tipoFiltro, setTipoFiltro] = useState('todos');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  
  const { 
    contas, movimentos, usuario,
    registrarDespesa, adicionarReceita,
    categoriasEntradas, categoriasSaidas, adicionarCategoria, removerCategoria,
    eliminarTransacao, editarTransacao, mostrarAlerta
  } = useFinance();

  const movimentosFiltrados = useMemo(() => {
    const porPeriodo = filterByPeriod(movimentos, periodFilter, item => item.data);
    if (tipoFiltro === 'todos') return porPeriodo;
    return porPeriodo.filter(item => item.tipo_movimento === tipoFiltro);
  }, [movimentos, periodFilter, tipoFiltro]);

  const handleSave = async (e) => {
    e.preventDefault();
    const novaTransacao = {
      descricao: e.target[0].value,
      valor: Number(e.target[1].value),
      contaId: e.target[2].value,
      categoria: e.target[3].value,
      data: e.target[4].value
    };
    
    if (itemToEdit) {
      // Editar transação existente
      // O backend precisa de saber o tipo de transação (income vs expense)
      novaTransacao.type = tipoTransacao === 'entrada' ? 'income' : 'expense';
      const saved = await editarTransacao(itemToEdit.id, novaTransacao);
      if (!saved) return;
    } else {
      // Nova transação
      if (tipoTransacao === 'saida') {
        await registrarDespesa(novaTransacao);
      } else {
        await adicionarReceita(novaTransacao);
      }
    }
    setIsModalOpen(false);
    setItemToEdit(null);
  };

  const handleDelete = () => {
    if (itemToDelete) {
      eliminarTransacao(itemToDelete.id);
      setItemToDelete(null);
    }
  };

  const handleAddCategoria = (e) => {
    e.preventDefault();
    const tipo = e.target[0].value;
    const nome = e.target[1].value;
    adicionarCategoria(tipo, nome);
    e.target[1].value = ''; // clear input
  };

  const categoriasAtuais = tipoTransacao === 'saida' ? categoriasSaidas : categoriasEntradas;

  const openNewModal = () => {
    setItemToEdit(null);
    setTipoTransacao('saida');
    setIsModalOpen(true);
  };

  const openEditModal = (transacao) => {
    setItemToEdit(transacao);
    setTipoTransacao(transacao.tipo_movimento);
    setIsModalOpen(true);
  };

  const handleExportPdf = () => {
    if (!usuario?.isPremium) {
      mostrarAlerta('Plano Premium', 'Renove o plano para exportar relatorios PDF profissionais.', 'erro');
      return;
    }

    generateTransactionsReport(usuario, movimentosFiltrados);
  };

  return (
    <div>
      <div className="transactions-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ color: 'var(--text-primary)' }}>Gestão de Transações</h2>
          <p className="text-secondary">Registe aqui todos os salários, bónus e despesas da casa.</p>
        </div>
        <div className="transactions-page-actions" style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary btn-pill" onClick={openNewModal}>+ Novo Registo</button>
          <button className="btn btn-secondary btn-pill" onClick={() => setIsImportModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>✨ IA Extrato</button>
          <button className="btn btn-glass btn-pill" onClick={() => setIsCategoriaModalOpen(true)}>Categorias</button>
          <button className="btn btn-pill" onClick={handleExportPdf} style={{ background: '#e0e0e0', border: 'none', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold' }}>📄 PDF</button>
        </div>
      </div>


      <div className="dash-card">
        <div className="page-filter-bar">
          <div>
            <h3 className="section-title" style={{ marginBottom: '0.4rem' }}>Histórico Geral de Entradas e Saídas</h3>
            <span className="filter-result-note">
              {movimentosFiltrados.length} movimento(s) em {getPeriodLabel(periodFilter)}
            </span>
          </div>
          <PeriodFilter value={periodFilter} onChange={setPeriodFilter} compact />
          <div className="filter-field">
            <label>Tipo</label>
            <select className="qt-input" value={tipoFiltro} onChange={event => setTipoFiltro(event.target.value)}>
              <option value="todos">Todos</option>
              <option value="entrada">Entradas</option>
              <option value="saida">Saídas</option>
            </select>
          </div>
        </div>
        <div className="responsive-table-wrap">
        <table className="transactions-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '1rem 0' }}>Descrição</th>
              <th>Categoria</th>
              <th>Data</th>
              <th style={{ textAlign: 'right' }}>Valor (Kz)</th>
              <th style={{ textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {movimentosFiltrados.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  Nenhuma transação encontrada para este filtro.
                </td>
              </tr>
            ) : movimentosFiltrados.map(m => {
              const isEntrada = m.tipo_movimento === 'entrada';
              return (
                <tr key={m.id} style={{ borderBottom: '1px solid #f2f3f9' }}>
                  <td style={{ padding: '1rem 0', fontWeight: '500' }}>
                    <span style={{ 
                      display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', 
                      background: isEntrada ? 'var(--success-color)' : 'var(--danger-color)', 
                      marginRight: '8px' 
                    }}></span>
                    {m.descricao}
                  </td>
                  <td><span style={{ background: '#f2f3f9', padding: '0.2rem 0.6rem', borderRadius: '10px', fontSize: '0.85rem' }}>{m.categoria}</span></td>
                  <td className="text-secondary">{m.data}</td>
                  <td style={{ textAlign: 'right', fontWeight: '600', color: isEntrada ? 'var(--success-color)' : 'var(--danger-color)' }}>
                    {isEntrada ? '+' : '-'} Kz {m.valor.toLocaleString()}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button onClick={() => openEditModal(m)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0.5rem' }} title="Editar">✏️</button>
                    <button onClick={() => setItemToDelete(m)} style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', fontSize: '1.2rem', padding: '0.5rem' }} title="Eliminar">🗑️</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      <ConfirmDeleteModal 
        isOpen={!!itemToDelete} 
        onClose={() => setItemToDelete(null)} 
        onConfirm={handleDelete}
        title="Eliminar Transação"
        message={`Tem a certeza que deseja eliminar a transação "${itemToDelete?.descricao}" no valor de Kz ${itemToDelete?.valor?.toLocaleString()}? O saldo da conta será recalculado automaticamente.`}
      />

      {/* Modal Principal de Transação */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setItemToEdit(null); }} title={itemToEdit ? "Editar Transação" : "Registar Nova Transação"}>
        
        {/* Toggle Entrada vs Saída */}
        <div style={{ display: 'flex', background: '#f2f3f9', borderRadius: '10px', padding: '4px', marginBottom: '1.5rem' }}>
          <button 
            type="button"
            onClick={() => setTipoTransacao('entrada')}
            style={{ 
              flex: 1, padding: '0.5rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600',
              background: tipoTransacao === 'entrada' ? 'var(--success-color)' : 'transparent',
              color: tipoTransacao === 'entrada' ? 'white' : 'var(--text-secondary)'
            }}
          >
            Entrada (Receita)
          </button>
          <button 
            type="button"
            onClick={() => setTipoTransacao('saida')}
            style={{ 
              flex: 1, padding: '0.5rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600',
              background: tipoTransacao === 'saida' ? 'var(--danger-color)' : 'transparent',
              color: tipoTransacao === 'saida' ? 'white' : 'var(--text-secondary)'
            }}
          >
            Saída (Despesa)
          </button>
        </div>

        <form key={itemToEdit ? itemToEdit.id : 'new'} onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <div>
            <label className="text-secondary" style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.9rem' }}>Descrição</label>
            <input type="text" className="qt-input" defaultValue={itemToEdit?.descricao || ''} placeholder={tipoTransacao === 'entrada' ? "Ex: Salário da Esposa..." : "Ex: Combustível..."} required />
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1rem' }}>
            <div>
              <label className="text-secondary" style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.9rem' }}>Valor (Kz)</label>
              <input type="number" className="qt-input" defaultValue={itemToEdit?.valor || ''} placeholder="0.00" required />
            </div>
            <div>
              <label className="text-secondary" style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.9rem' }}>
                {tipoTransacao === 'entrada' ? 'Onde guardou o dinheiro?' : 'De onde saiu o dinheiro?'}
              </label>
              <select className="qt-input" required defaultValue={itemToEdit?.contaId || ''} style={{ border: '2px solid var(--accent-color)' }}>
                {contas.map(conta => (
                  <option key={conta.id} value={conta.id}>{conta.nome} (Saldo: {conta.saldo.toLocaleString()} Kz)</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1rem' }}>
            <div>
              <label className="text-secondary" style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.9rem' }}>Categoria</label>
              <select className="qt-input" required defaultValue={itemToEdit?.categoria || ''}>
                {categoriasAtuais.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-secondary" style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.9rem' }}>Data</label>
              <input type="date" className="qt-input" required defaultValue={itemToEdit?.data || new Date().toISOString().split('T')[0]} />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-pill" style={{ marginTop: '0.5rem', padding: '0.8rem', fontSize: '1rem', background: tipoTransacao === 'entrada' ? 'var(--success-color)' : 'var(--danger-color)' }}>
            {itemToEdit ? 'Salvar Alterações' : `Registar ${tipoTransacao === 'entrada' ? 'Entrada' : 'Saída'}`}
          </button>
        </form>
      </Modal>

      {/* Modal de Gestão de Categorias */}
      <Modal isOpen={isCategoriaModalOpen} onClose={() => setIsCategoriaModalOpen(false)} title="Gestão de Categorias">
        <form onSubmit={handleAddCategoria} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <select className="qt-input" required style={{ flex: 1 }}>
            <option value="entrada">Entradas</option>
            <option value="saida">Saídas</option>
          </select>
          <input type="text" className="qt-input" placeholder="Nova categoria..." required style={{ flex: 2 }} />
          <button type="submit" className="btn btn-primary">Adicionar</button>
        </form>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div>
            <h4 style={{ color: 'var(--success-color)', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>Categorias de Entradas</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: '1rem 0 0 0' }}>
              {categoriasEntradas.map(cat => (
                <li key={cat} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px dashed #eee' }}>
                  <span>{cat}</span>
                  <button onClick={() => removerCategoria('entrada', cat)} style={{ color: 'var(--danger-color)', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 style={{ color: 'var(--danger-color)', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>Categorias de Saídas</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: '1rem 0 0 0' }}>
              {categoriasSaidas.map(cat => (
                <li key={cat} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px dashed #eee' }}>
                  <span>{cat}</span>
                  <button onClick={() => removerCategoria('saida', cat)} style={{ color: 'var(--danger-color)', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Modal>

      <ImportadorExtrato isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />
    </div>

  );
}
