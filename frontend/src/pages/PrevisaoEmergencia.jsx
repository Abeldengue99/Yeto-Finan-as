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

function formatDateLabel(dateKey) {
  if (!dateKey) return 'Sem data';
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;

  return date.toLocaleDateString('pt-AO', {
    day: '2-digit',
    month: 'short'
  });
}

function getBalanceClass(value) {
  return Number(value || 0) < 0 ? 'danger-text' : 'success-text';
}

function getSeverityLabel(severity) {
  if (severity === 'critical' || severity === 'critico') return 'Crítico';
  if (severity === 'attention' || severity === 'apertado') return 'Atenção';
  return 'Estável';
}

export default function PrevisaoEmergencia() {
  const {
    usuario,
    previsaoEmergencia,
    carregarPrevisaoEmergencia
  } = useFinance();

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
  const [isLoading, setIsLoading] = useState(false);
  const loadForecastRef = useRef(carregarPrevisaoEmergencia);

  useEffect(() => {
    loadForecastRef.current = carregarPrevisaoEmergencia;
  }, [carregarPrevisaoEmergencia]);

  useEffect(() => {
    if (!usuario?.hasAnnualAccess) return;

    let cancelled = false;
    setIsLoading(true);
    loadForecastRef.current(selectedMonth).finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedMonth, usuario?.hasAnnualAccess]);

  const forecast = previsaoEmergencia?.forecast || {};
  const emergency = previsaoEmergencia?.emergency || {};
  const severityClass = emergency.severity === 'critico'
    ? 'critical'
    : emergency.severity === 'apertado'
      ? 'attention'
      : emergency.severity || 'stable';
  const frozenCategories = emergency.frozenCategories || [];
  const priorities = emergency.priorities || [];
  const actions = emergency.actions || [];

  const signal = useMemo(() => {
    if (forecast.shortageDay) {
      return {
        title: 'Pode faltar dinheiro',
        text: `O sistema prevê aperto antes de ${formatDateLabel(forecast.shortageDay)}.`,
        tone: 'danger'
      };
    }

    if (Number(forecast.projectedEndBalance || 0) < 0) {
      return {
        title: 'Fim do mês negativo',
        text: 'Ainda há tempo para ajustar categorias e prioridades.',
        tone: 'warning'
      };
    }

    return {
      title: 'Ritmo controlado',
      text: 'A previsão atual indica saldo positivo no fim do mês.',
      tone: 'success'
    };
  }, [forecast.projectedEndBalance, forecast.shortageDay]);

  if (!usuario?.hasAnnualAccess) {
    return (
      <div className="forecast-page">
        <div className="forecast-locked dash-card">
          <span className="forecast-lock-icon">A</span>
          <h2>Previsão & Modo Emergência</h2>
          <p>
            Esta funcionalidade está disponível durante o mês grátis e depois fica exclusiva do plano Anual.
            Ela calcula o fim do mês e cria um plano de sobrevivência quando houver aperto.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="forecast-page">
      <div className="forecast-header">
        <div>
          <span className="forecast-kicker">Pacote anual</span>
          <h2>Previsão do Fim do Mês</h2>
          <p className="text-secondary">
            O Yeto estima o saldo final, identifica o dia de risco e ativa um plano de emergência quando necessário.
          </p>
        </div>
        <div className="forecast-month-control">
          <label>Mês</label>
          <input
            type="month"
            className="qt-input"
            value={selectedMonth}
            onChange={event => setSelectedMonth(event.target.value || getCurrentMonthKey())}
          />
        </div>
      </div>

      <section className={`forecast-hero ${signal.tone}`}>
        <div>
          <span>{getMonthLabel(selectedMonth)}</span>
          <h3>{forecast.message || 'A calcular a previsão financeira...'}</h3>
          <p>{signal.text}</p>
        </div>
        <div className="forecast-hero-balance">
          <small>Saldo previsto</small>
          <strong className={getBalanceClass(forecast.projectedEndBalance)}>
            {currency.format(Number(forecast.projectedEndBalance || 0))}
          </strong>
          {isLoading && <em>A atualizar...</em>}
        </div>
      </section>

      <div className="forecast-summary-grid">
        <div className="forecast-summary-card">
          <span>Saldo atual</span>
          <strong>{currency.format(Number(forecast.currentBalance || 0))}</strong>
        </div>
        <div className="forecast-summary-card">
          <span>Entradas no mês</span>
          <strong className="success-text">{currency.format(Number(forecast.incomeToDate || 0))}</strong>
        </div>
        <div className="forecast-summary-card">
          <span>Saídas no mês</span>
          <strong className="danger-text">{currency.format(Number(forecast.expenseToDate || 0))}</strong>
        </div>
        <div className="forecast-summary-card">
          <span>Média diária</span>
          <strong>{currency.format(Number(forecast.dailyAverageExpense || 0))}</strong>
          <small>{Number(forecast.daysRemaining || 0)} dia(s) restantes</small>
        </div>
      </div>

      <div className="forecast-layout-grid">
        <section className="dash-card emergency-panel">
          <div className="forecast-section-heading">
            <div>
              <span>Modo Emergência</span>
              <h3>{emergency.active ? 'Plano de sobrevivência ativo' : 'Sem emergência neste momento'}</h3>
            </div>
            <strong className={`emergency-severity ${severityClass}`}>
              {getSeverityLabel(emergency.severity)}
            </strong>
          </div>

          <p className="text-secondary">{emergency.message || 'Continue a acompanhar o mês para manter a família segura.'}</p>

          <div className="emergency-metrics">
            <div>
              <span>Falta estimada</span>
              <strong>{currency.format(Number(emergency.missingAmount || 0))}</strong>
            </div>
            <div>
              <span>Corte diário</span>
              <strong>{currency.format(Number(emergency.dailyCutNeeded || 0))}</strong>
            </div>
            <div>
              <span>Limite sugerido/dia</span>
              <strong>{currency.format(Number(emergency.suggestedDailyLimit || 0))}</strong>
            </div>
          </div>

          <div className="emergency-actions">
            <h4>Ações recomendadas</h4>
            {actions.length > 0 ? (
              actions.map((action, index) => <p key={`${action}-${index}`}>{action}</p>)
            ) : (
              <p>Não há cortes urgentes. Mantenha as contas prioritárias em dia.</p>
            )}
          </div>
        </section>

        <aside className="forecast-side-stack">
          <section className="dash-card forecast-list-card">
            <div className="forecast-section-heading compact">
              <h3>Prioridades</h3>
              <span>{priorities.length}</span>
            </div>
            <div className="forecast-priority-list">
              {priorities.length > 0 ? (
                priorities.map((item, index) => (
                  <div key={`${item.type}-${item.date}-${index}`}>
                    <span>{formatDateLabel(item.date)}</span>
                    <div>
                      <strong>{item.title}</strong>
                      <small>{item.category}</small>
                    </div>
                    <em>{currency.format(Number(item.amount || 0))}</em>
                  </div>
                ))
              ) : (
                <p className="forecast-empty-text">Sem compromissos críticos para este mês.</p>
              )}
            </div>
          </section>

          <section className="dash-card forecast-list-card">
            <div className="forecast-section-heading compact">
              <h3>Categorias a congelar</h3>
              <span>{frozenCategories.length}</span>
            </div>
            <div className="forecast-freeze-list">
              {frozenCategories.length > 0 ? (
                frozenCategories.map(item => (
                  <div key={item.category}>
                    <div>
                      <strong>{item.category}</strong>
                      <small>{item.reason}</small>
                    </div>
                    <em>{currency.format(Number(item.spent || 0))}</em>
                  </div>
                ))
              ) : (
                <p className="forecast-empty-text">Nenhuma categoria precisa ser congelada agora.</p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
