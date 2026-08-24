import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFinance } from '../contexts/FinanceContext';

const currency = new Intl.NumberFormat('pt-AO', {
  style: 'currency',
  currency: 'AOA',
  maximumFractionDigits: 0
});

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

function isSameMonth(dateValue, monthKey) {
  return String(dateValue || '').slice(0, 7) === monthKey;
}

export default function Orcamento() {
  const {
    usuario,
    despesas,
    receitas,
    pagamentosFixos,
    categoriasSaidas,
    orcamentos,
    carregarOrcamentos,
    guardarOrcamento,
    eliminarOrcamento
  } = useFinance();

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
  const [selectedCategory, setSelectedCategory] = useState(categoriasSaidas[0] || '');
  const [customCategory, setCustomCategory] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const loadedMonthRef = useRef('');
  const hasBudgetAccess = usuario?.isPremium || usuario?.featureAccess?.includes('orcamento');

  useEffect(() => {
    if (!hasBudgetAccess || loadedMonthRef.current === selectedMonth) return;

    loadedMonthRef.current = selectedMonth;
    carregarOrcamentos(selectedMonth);
  }, [selectedMonth, hasBudgetAccess, carregarOrcamentos]);

  useEffect(() => {
    if (!selectedCategory && categoriasSaidas.length > 0) {
      setSelectedCategory(categoriasSaidas[0]);
    }
  }, [categoriasSaidas, selectedCategory]);

  const monthExpenses = useMemo(
    () => despesas.filter(item => isSameMonth(item.data, selectedMonth)),
    [despesas, selectedMonth]
  );

  const monthIncome = useMemo(
    () => receitas.filter(item => isSameMonth(item.data, selectedMonth)),
    [receitas, selectedMonth]
  );

  const budgetRows = useMemo(() => {
    const totalsByCategory = monthExpenses.reduce((acc, item) => {
      const key = item.categoria || 'Sem categoria';
      acc[key] = (acc[key] || 0) + Number(item.valor || 0);
      return acc;
    }, {});

    const categories = [
      ...new Set([
        ...orcamentos.map(item => item.categoria),
        ...Object.keys(totalsByCategory)
      ])
    ].filter(Boolean);

    return categories
      .map(category => {
        const budget = orcamentos.find(item => item.categoria === category);
        const spent = totalsByCategory[category] || 0;
        const limit = Number(budget?.limite || 0);
        const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;
        const remaining = limit - spent;
        const status = !limit
          ? 'Sem limite'
          : spent > limit
            ? 'Ultrapassou'
            : percent >= 80
              ? 'Atenção'
              : 'Dentro';

        return {
          id: budget?.id,
          category,
          spent,
          limit,
          remaining,
          percent,
          status
        };
      })
      .sort((a, b) => {
        if (a.status === 'Ultrapassou' && b.status !== 'Ultrapassou') return -1;
        if (b.status === 'Ultrapassou' && a.status !== 'Ultrapassou') return 1;
        return b.spent - a.spent;
      });
  }, [monthExpenses, orcamentos]);

  const summary = useMemo(() => {
    const totalLimit = budgetRows.reduce((sum, row) => sum + row.limit, 0);
    const totalSpent = monthExpenses.reduce((sum, item) => sum + Number(item.valor || 0), 0);
    const totalIncome = monthIncome.reduce((sum, item) => sum + Number(item.valor || 0), 0);
    const pendingFixed = pagamentosFixos
      .filter(item => !item.pagoEsteMes)
      .reduce((sum, item) => sum + Number(item.valor || 0), 0);

    return {
      totalLimit,
      totalSpent,
      totalIncome,
      pendingFixed,
      balanceForecast: totalIncome - totalSpent - pendingFixed,
      availableInBudget: totalLimit - totalSpent
    };
  }, [budgetRows, monthExpenses, monthIncome, pagamentosFixos]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const category = selectedCategory === '__custom__' ? customCategory.trim() : selectedCategory;

    if (!category || !monthlyLimit) return;

    setIsSaving(true);
    const saved = await guardarOrcamento({
      categoria: category,
      limite: monthlyLimit,
      mes: selectedMonth
    });
    setIsSaving(false);

    if (saved) {
      setMonthlyLimit('');
      setCustomCategory('');
      setSelectedCategory(categoriasSaidas[0] || '');
    }
  };

  const handleEdit = (row) => {
    if (categoriasSaidas.includes(row.category)) {
      setSelectedCategory(row.category);
      setCustomCategory('');
    } else {
      setSelectedCategory('__custom__');
      setCustomCategory(row.category);
    }
    setMonthlyLimit(String(row.limit || ''));
  };

  if (!hasBudgetAccess) {
    return (
      <div className="budget-page">
        <div className="budget-locked dash-card">
          <span className="budget-lock-icon">P</span>
          <h2>Orçamento Mensal</h2>
          <p className="text-secondary">
            Esta funcionalidade está disponível durante o mês grátis e nos planos Premium.
            Renove o plano para voltar a controlar limites por categoria.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="budget-page">
      <div className="budget-header">
        <div>
          <span className="budget-kicker">Planeamento mensal</span>
          <h2>Orçamento Mensal</h2>
          <p className="text-secondary">
            Defina limites por categoria e acompanhe em tempo real o que a família já consumiu.
          </p>
        </div>
        <div className="budget-month-control">
          <label>Mês</label>
          <input
            type="month"
            className="qt-input"
            value={selectedMonth}
            onChange={event => setSelectedMonth(event.target.value || getCurrentMonthKey())}
          />
        </div>
      </div>

      <div className="budget-summary-grid">
        <div className="budget-summary-card">
          <span>Limite planeado</span>
          <strong>{currency.format(summary.totalLimit)}</strong>
          <small>{getMonthLabel(selectedMonth)}</small>
        </div>
        <div className="budget-summary-card">
          <span>Gasto no mês</span>
          <strong className={summary.totalSpent > summary.totalLimit && summary.totalLimit > 0 ? 'danger-text' : ''}>
            {currency.format(summary.totalSpent)}
          </strong>
          <small>{monthExpenses.length} movimento(s) de saída</small>
        </div>
        <div className="budget-summary-card">
          <span>Saldo previsto</span>
          <strong className={summary.balanceForecast < 0 ? 'danger-text' : 'success-text'}>
            {currency.format(summary.balanceForecast)}
          </strong>
          <small>Receitas menos gastos e fixos pendentes</small>
        </div>
      </div>

      <div className="budget-layout-grid">
        <section className="dash-card budget-form-card">
          <div className="budget-section-heading">
            <h3>Definir limite</h3>
            <p className="text-secondary">Escolha uma categoria e indique quanto pode gastar neste mês.</p>
          </div>

          <form onSubmit={handleSubmit} className="budget-form">
            <div>
              <label>Categoria</label>
              <select
                className="qt-input"
                value={selectedCategory}
                onChange={event => setSelectedCategory(event.target.value)}
                required
              >
                {categoriasSaidas.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
                <option value="__custom__">Outra categoria</option>
              </select>
            </div>

            {selectedCategory === '__custom__' && (
              <div>
                <label>Nome da categoria</label>
                <input
                  type="text"
                  className="qt-input"
                  value={customCategory}
                  onChange={event => setCustomCategory(event.target.value)}
                  placeholder="Ex: Obras, Viagem, Eventos"
                  maxLength={120}
                  required
                />
              </div>
            )}

            <div>
              <label>Limite mensal (Kz)</label>
              <input
                type="number"
                className="qt-input"
                min="0"
                step="100"
                value={monthlyLimit}
                onChange={event => setMonthlyLimit(event.target.value)}
                placeholder="Ex: 150000"
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-pill" disabled={isSaving}>
              {isSaving ? 'A guardar...' : 'Guardar Orçamento'}
            </button>
          </form>
        </section>

        <section className="dash-card budget-insight-card">
          <div className="budget-section-heading">
            <h3>Leitura rápida</h3>
            <p className="text-secondary">Ajuda para decidir se o mês está confortável ou apertado.</p>
          </div>

          <div className="budget-insight-list">
            <div>
              <span>Disponível dentro dos limites</span>
              <strong className={summary.availableInBudget < 0 ? 'danger-text' : 'success-text'}>
                {currency.format(summary.availableInBudget)}
              </strong>
            </div>
            <div>
              <span>Pagamentos fixos pendentes</span>
              <strong>{currency.format(summary.pendingFixed)}</strong>
            </div>
            <div>
              <span>Categorias controladas</span>
              <strong>{orcamentos.length}</strong>
            </div>
          </div>
        </section>
      </div>

      <section className="dash-card budget-list-card">
        <div className="budget-section-heading budget-list-heading">
          <div>
            <h3>Controlo por categoria</h3>
            <p className="text-secondary">As categorias com excesso aparecem primeiro para facilitar a ação.</p>
          </div>
        </div>

        {budgetRows.length === 0 ? (
          <div className="budget-empty">
            <strong>Ainda não há limites definidos para {getMonthLabel(selectedMonth)}.</strong>
            <p>Comece por Alimentação, Transporte, Saúde ou Educação para ter uma visão clara do mês.</p>
          </div>
        ) : (
          <div className="budget-category-list">
            {budgetRows.map(row => {
              const barWidth = row.limit > 0 ? Math.min(row.percent, 100) : 0;

              return (
                <article key={row.category} className={`budget-category-row ${row.status === 'Ultrapassou' ? 'over' : ''}`}>
                  <div className="budget-category-main">
                    <div>
                      <h4>{row.category}</h4>
                      <span>{row.status}</span>
                    </div>
                    <strong>{currency.format(row.spent)}</strong>
                  </div>

                  <div className="budget-progress-track">
                    <div
                      className="budget-progress-fill"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>

                  <div className="budget-category-footer">
                    <span>Limite: {row.limit > 0 ? currency.format(row.limit) : 'sem limite'}</span>
                    <span className={row.remaining < 0 ? 'danger-text' : 'success-text'}>
                      {row.limit > 0 ? `${row.remaining < 0 ? 'Excesso' : 'Restante'}: ${currency.format(Math.abs(row.remaining))}` : 'Defina um limite'}
                    </span>
                    <div className="budget-actions">
                      <button type="button" onClick={() => handleEdit(row)}>Editar</button>
                      {row.id && (
                        <button type="button" className="danger-text" onClick={() => eliminarOrcamento(row.id)}>
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
