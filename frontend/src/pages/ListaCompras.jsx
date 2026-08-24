import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFinance } from '../contexts/FinanceContext';

const currency = new Intl.NumberFormat('pt-AO', {
  style: 'currency',
  currency: 'AOA',
  maximumFractionDigits: 0
});
const emptyLists = [];
const emptyAnalysis = [];

function getCurrentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function getMonthLabel(monthKey) {
  const date = new Date(`${monthKey}-02T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'Mês selecionado';

  return date.toLocaleDateString('pt-AO', {
    month: 'long',
    year: 'numeric'
  });
}

function getStatusText(status) {
  if (status === 'excede') return 'Excede orçamento';
  if (status === 'apertado') return 'Margem curta';
  if (status === 'sem_orcamento') return 'Sem orçamento';
  return 'Dentro do orçamento';
}

export default function ListaCompras() {
  const {
    usuario,
    categoriasSaidas,
    listaCompras,
    carregarListaCompras,
    criarListaCompras,
    adicionarItemListaCompras,
    atualizarItemListaCompras,
    eliminarItemListaCompras,
    eliminarListaCompras
  } = useFinance();

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
  const [activeListId, setActiveListId] = useState('');
  const [newListName, setNewListName] = useState('Mercado da semana');
  const [itemForm, setItemForm] = useState({
    nome: '',
    categoria: categoriasSaidas[0] || 'Alimentação / Casa',
    quantidade: 1,
    precoEstimado: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const loadShoppingRef = useRef(carregarListaCompras);
  const hasShoppingAccess = usuario?.isPremium || usuario?.featureAccess?.includes('lista_compras');

  useEffect(() => {
    loadShoppingRef.current = carregarListaCompras;
  }, [carregarListaCompras]);

  useEffect(() => {
    if (!hasShoppingAccess) return;

    let cancelled = false;
    setIsSaving(true);
    loadShoppingRef.current(selectedMonth).finally(() => {
      if (!cancelled) setIsSaving(false);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedMonth, hasShoppingAccess]);

  useEffect(() => {
    if (!itemForm.categoria && categoriasSaidas.length > 0) {
      setItemForm(prev => ({ ...prev, categoria: categoriasSaidas[0] }));
    }
  }, [categoriasSaidas, itemForm.categoria]);

  const lists = listaCompras?.lists || emptyLists;
  const summary = listaCompras?.summary || {};

  useEffect(() => {
    if (lists.length === 0) {
      setActiveListId('');
      return;
    }

    if (!activeListId || !lists.some(list => list.id === activeListId)) {
      setActiveListId(lists[0].id);
    }
  }, [activeListId, lists]);

  const activeList = useMemo(
    () => lists.find(list => list.id === activeListId) || lists[0] || null,
    [activeListId, lists]
  );

  const categoryAnalysis = summary.categoryAnalysis || emptyAnalysis;
  const riskyCategories = categoryAnalysis.filter(item => item.status === 'excede' || item.status === 'apertado');
  const checkedTotal = activeList?.itens?.filter(item => item.comprado).reduce((sum, item) => sum + Number(item.total || 0), 0) || 0;

  const handleCreateList = async (event) => {
    event.preventDefault();
    if (!newListName.trim()) return;

    setIsSaving(true);
    const created = await criarListaCompras({ nome: newListName.trim(), mes: selectedMonth });
    setIsSaving(false);

    if (created) {
      setActiveListId(created.id);
      setNewListName('Mercado da semana');
    }
  };

  const handleAddItem = async (event) => {
    event.preventDefault();
    if (!activeList?.id || !itemForm.nome.trim()) return;

    setIsSaving(true);
    const saved = await adicionarItemListaCompras(activeList.id, itemForm, selectedMonth);
    setIsSaving(false);

    if (saved) {
      setItemForm(prev => ({ ...prev, nome: '', quantidade: 1, precoEstimado: '' }));
    }
  };

  const toggleItem = (item) => {
    atualizarItemListaCompras(item.id, { ...item, comprado: !item.comprado }, selectedMonth);
  };

  if (!hasShoppingAccess) {
    return (
      <div className="shopping-page">
        <div className="shopping-locked dash-card">
          <span className="shopping-lock-icon">L</span>
          <h2>Lista de Compras com Orçamento</h2>
          <p>
            Esta funcionalidade fica disponível durante o primeiro mês grátis e depois passa para os planos Semestral e Anual.
            Crie a lista antes de ir ao mercado e veja se ela cabe no orçamento.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="shopping-page">
      <div className="shopping-header">
        <div>
          <span className="shopping-kicker">Mercado inteligente</span>
          <h2>Lista de Compras com Orçamento</h2>
          <p className="text-secondary">
            Planeie a compra e compare o total previsto com os limites definidos no Orçamento Mensal.
          </p>
        </div>
        <div className="shopping-month-control">
          <label>Mês</label>
          <input
            type="month"
            className="qt-input"
            value={selectedMonth}
            onChange={event => setSelectedMonth(event.target.value || getCurrentMonthKey())}
          />
        </div>
      </div>

      <section className={`shopping-hero ${Number(summary.afterShoppingBalance || 0) < 0 ? 'danger' : 'success'}`}>
        <div>
          <span>{getMonthLabel(selectedMonth)}</span>
          <h3>
            {Number(summary.afterShoppingBalance || 0) < 0
              ? `A lista ultrapassa o orçamento em ${currency.format(Math.abs(Number(summary.afterShoppingBalance || 0)))}.`
              : `Depois da compra ainda ficam ${currency.format(Number(summary.afterShoppingBalance || 0))} dentro do orçamento.`}
          </h3>
          <p>
            O cálculo considera o orçamento mensal, o que já foi gasto e os itens planeados na lista.
          </p>
        </div>
        <strong>{currency.format(Number(summary.totalEstimated || 0))}</strong>
      </section>

      <div className="shopping-summary-grid">
        <div className="shopping-summary-card">
          <span>Orçamento do mês</span>
          <strong>{currency.format(Number(summary.totalBudget || 0))}</strong>
        </div>
        <div className="shopping-summary-card">
          <span>Já gasto</span>
          <strong className="danger-text">{currency.format(Number(summary.totalSpent || 0))}</strong>
        </div>
        <div className="shopping-summary-card">
          <span>Lista prevista</span>
          <strong>{currency.format(Number(summary.totalEstimated || 0))}</strong>
        </div>
        <div className="shopping-summary-card">
          <span>Já marcado</span>
          <strong className="success-text">{currency.format(checkedTotal)}</strong>
        </div>
      </div>

      <div className="shopping-layout-grid">
        <section className="dash-card shopping-form-card">
          <div className="shopping-section-heading">
            <h3>Criar lista</h3>
            <p className="text-secondary">Pode separar compras de mercado, escola, farmácia ou casa.</p>
          </div>
          <form onSubmit={handleCreateList} className="shopping-form">
            <input
              type="text"
              className="qt-input"
              value={newListName}
              onChange={event => setNewListName(event.target.value)}
              placeholder="Ex: Mercado de sábado"
              maxLength={120}
              required
            />
            <button type="submit" className="btn btn-primary btn-pill" disabled={isSaving}>
              Criar Lista
            </button>
          </form>

          {lists.length > 0 && (
            <div className="shopping-list-tabs">
              {lists.map(list => (
                <button
                  key={list.id}
                  type="button"
                  className={activeList?.id === list.id ? 'active' : ''}
                  onClick={() => setActiveListId(list.id)}
                >
                  <span>{list.nome}</span>
                  <strong>{currency.format(Number(list.totalEstimado || 0))}</strong>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="dash-card shopping-form-card">
          <div className="shopping-section-heading">
            <h3>Adicionar item</h3>
            <p className="text-secondary">Use o preço estimado para saber antes se a compra cabe no orçamento.</p>
          </div>
          <form onSubmit={handleAddItem} className="shopping-item-form">
            <input
              type="text"
              className="qt-input"
              value={itemForm.nome}
              onChange={event => setItemForm(prev => ({ ...prev, nome: event.target.value }))}
              placeholder="Ex: Arroz, óleo, frango"
              maxLength={120}
              disabled={!activeList}
              required
            />
            <select
              className="qt-input"
              value={itemForm.categoria}
              onChange={event => setItemForm(prev => ({ ...prev, categoria: event.target.value }))}
              disabled={!activeList}
            >
              {categoriasSaidas.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <input
              type="number"
              className="qt-input"
              min="0.01"
              step="0.01"
              value={itemForm.quantidade}
              onChange={event => setItemForm(prev => ({ ...prev, quantidade: event.target.value }))}
              disabled={!activeList}
              required
            />
            <input
              type="number"
              className="qt-input"
              min="0"
              step="50"
              value={itemForm.precoEstimado}
              onChange={event => setItemForm(prev => ({ ...prev, precoEstimado: event.target.value }))}
              placeholder="Preço"
              disabled={!activeList}
              required
            />
            <button type="submit" className="btn btn-primary btn-pill" disabled={!activeList || isSaving}>
              Adicionar
            </button>
          </form>
        </section>
      </div>

      <div className="shopping-layout-grid">
        <section className="dash-card shopping-items-card">
          <div className="shopping-section-heading shopping-list-heading">
            <div>
              <h3>{activeList ? activeList.nome : 'Nenhuma lista criada'}</h3>
              <p className="text-secondary">
                {activeList ? `${activeList.itens.length} item(ns) planeados` : 'Crie a primeira lista para começar.'}
              </p>
            </div>
            {activeList && (
              <button type="button" onClick={() => eliminarListaCompras(activeList.id, selectedMonth)}>
                Eliminar Lista
              </button>
            )}
          </div>

          {!activeList || activeList.itens.length === 0 ? (
            <div className="shopping-empty">
              <strong>Ainda não há itens nesta lista.</strong>
              <p>Adicione os produtos principais e o Yeto compara com o orçamento automaticamente.</p>
            </div>
          ) : (
            <div className="shopping-item-list">
              {activeList.itens.map(item => (
                <article key={item.id} className={item.comprado ? 'checked' : ''}>
                  <button type="button" className="shopping-check" onClick={() => toggleItem(item)}>
                    {item.comprado ? '✓' : ''}
                  </button>
                  <div>
                    <h4>{item.nome}</h4>
                    <span>{item.categoria} · {Number(item.quantidade).toLocaleString('pt-AO')} un.</span>
                  </div>
                  <strong>{currency.format(Number(item.total || 0))}</strong>
                  <button type="button" className="shopping-delete" onClick={() => eliminarItemListaCompras(item.id, selectedMonth)}>
                    Eliminar
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="dash-card shopping-analysis-card">
          <div className="shopping-section-heading">
            <h3>Comparação por categoria</h3>
            <p className="text-secondary">Veja onde a compra pode apertar o orçamento.</p>
          </div>

          {categoryAnalysis.length === 0 ? (
            <p className="shopping-empty-text">Defina orçamento por categoria para uma leitura mais precisa.</p>
          ) : (
            <div className="shopping-category-list">
              {categoryAnalysis.map(item => (
                <div key={item.categoria} className={item.status}>
                  <div>
                    <strong>{item.categoria}</strong>
                    <span>{getStatusText(item.status)}</span>
                  </div>
                  <em>{currency.format(Number(item.saldoDepoisCompra || 0))}</em>
                </div>
              ))}
            </div>
          )}

          {riskyCategories.length > 0 && (
            <div className="shopping-warning-box">
              <strong>Atenção antes de comprar</strong>
              <p>Reveja {riskyCategories.slice(0, 3).map(item => item.categoria).join(', ')} para não gastar além do planeado.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
