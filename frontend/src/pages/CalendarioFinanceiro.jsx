import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFinance } from '../contexts/FinanceContext';

const currency = new Intl.NumberFormat('pt-AO', {
  style: 'currency',
  currency: 'AOA',
  maximumFractionDigits: 0
});

const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const emptyEvents = [];

const eventTypeMeta = {
  salario: { label: 'Salário', tone: 'income' },
  receita: { label: 'Receita', tone: 'income' },
  despesa: { label: 'Despesa', tone: 'expense' },
  fixo: { label: 'Conta fixa', tone: 'expense' },
  prestacao: { label: 'Prestação', tone: 'expense' },
  divida_pagar: { label: 'Dívida a pagar', tone: 'expense' },
  divida_receber: { label: 'Dívida a receber', tone: 'income' },
  kixikila: { label: 'Kixikila', tone: 'kixikila' },
  meta: { label: 'Meta', tone: 'goal' }
};

function getCurrentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function getDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function getMonthLabel(monthKey) {
  const date = new Date(`${monthKey}-02T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'Mês selecionado';
  return date.toLocaleDateString('pt-AO', { month: 'long', year: 'numeric' });
}

function buildCalendarDays(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const firstDate = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mondayOffset = (firstDate.getUTCDay() + 6) % 7;
  const cells = Array.from({ length: mondayOffset }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      day,
      date: `${monthKey}-${String(day).padStart(2, '0')}`
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function getTone(event) {
  return eventTypeMeta[event.type]?.tone || 'neutral';
}

function getLabel(event) {
  return eventTypeMeta[event.type]?.label || 'Evento';
}

export default function CalendarioFinanceiro() {
  const {
    usuario,
    calendarioFinanceiro,
    carregarCalendarioFinanceiro
  } = useFinance();

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
  const [selectedDate, setSelectedDate] = useState(getDateKey(new Date()));
  const [filter, setFilter] = useState('todos');
  const [isLoading, setIsLoading] = useState(false);
  const loadCalendarRef = useRef(carregarCalendarioFinanceiro);

  useEffect(() => {
    loadCalendarRef.current = carregarCalendarioFinanceiro;
  }, [carregarCalendarioFinanceiro]);

  useEffect(() => {
    if (!selectedDate.startsWith(selectedMonth)) {
      setSelectedDate(`${selectedMonth}-01`);
    }
  }, [selectedMonth, selectedDate]);

  useEffect(() => {
    if (!usuario?.isPremium) return;

    let cancelled = false;
    setIsLoading(true);
    loadCalendarRef.current(selectedMonth).finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedMonth, usuario?.isPremium]);

  const allEvents = calendarioFinanceiro?.events || emptyEvents;

  const filteredEvents = useMemo(() => {
    return allEvents.filter(event => {
      if (filter === 'todos') return true;
      if (filter === 'entradas') return event.direction === 'entrada';
      if (filter === 'saidas') return event.direction === 'saida';
      if (filter === 'metas') return event.direction === 'meta';
      if (filter === 'alertas') return ['atrasado', 'vencido'].includes(event.status);
      return true;
    });
  }, [allEvents, filter]);

  const eventsByDate = useMemo(() => {
    return filteredEvents.reduce((acc, event) => {
      acc[event.date] = acc[event.date] || [];
      acc[event.date].push(event);
      return acc;
    }, {});
  }, [filteredEvents]);

  const selectedDayEvents = eventsByDate[selectedDate] || [];
  const monthCells = useMemo(() => buildCalendarDays(selectedMonth), [selectedMonth]);
  const todayKey = getDateKey(new Date());

  const summary = useMemo(() => {
    const base = calendarioFinanceiro?.summary || {};
    return {
      income: Number(base.income || 0),
      expense: Number(base.expense || 0),
      goals: Number(base.goals || 0),
      forecast: Number(base.forecast || 0),
      totalEvents: Number(base.totalEvents || allEvents.length),
      overdue: Number(base.overdue || 0),
      pending: Number(base.pending || 0)
    };
  }, [calendarioFinanceiro?.summary, allEvents.length]);

  const nextEvents = useMemo(() => {
    return allEvents
      .filter(event => event.date >= todayKey)
      .slice(0, 6);
  }, [allEvents, todayKey]);

  if (!usuario?.isPremium) {
    return (
      <div className="finance-calendar-page">
        <div className="calendar-locked dash-card">
          <span className="calendar-lock-icon">C</span>
          <h2>Calendário Financeiro</h2>
          <p>
            O calendário mensal está disponível durante o mês grátis e nos planos Premium.
            Renove para ver salários, contas, dívidas, kixikila e metas numa única tela.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="finance-calendar-page">
      <div className="calendar-header">
        <div>
          <span className="calendar-kicker">Visão mensal</span>
          <h2>Calendário Financeiro</h2>
          <p className="text-secondary">
            Salários, contas fixas, dívidas, prestações, kixikila e metas reunidos por data.
          </p>
        </div>
        <div className="calendar-month-picker">
          <label>Mês</label>
          <input
            type="month"
            className="qt-input"
            value={selectedMonth}
            onChange={event => setSelectedMonth(event.target.value || getCurrentMonthKey())}
          />
        </div>
      </div>

      <div className="calendar-summary-grid">
        <div className="calendar-summary-card">
          <span>Entradas previstas</span>
          <strong className="success-text">{currency.format(summary.income)}</strong>
        </div>
        <div className="calendar-summary-card">
          <span>Saídas previstas</span>
          <strong className="danger-text">{currency.format(summary.expense)}</strong>
        </div>
        <div className="calendar-summary-card">
          <span>Saldo do mês</span>
          <strong className={summary.forecast < 0 ? 'danger-text' : 'success-text'}>
            {currency.format(summary.forecast)}
          </strong>
        </div>
        <div className="calendar-summary-card">
          <span>Alertas</span>
          <strong>{summary.overdue}</strong>
          <small>{summary.pending} pendente(s)</small>
        </div>
      </div>

      <div className="calendar-filter-row">
        {[
          ['todos', 'Todos'],
          ['entradas', 'Entradas'],
          ['saidas', 'Saídas'],
          ['metas', 'Metas'],
          ['alertas', 'Alertas']
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={filter === value ? 'active' : ''}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="calendar-layout-grid">
        <section className="dash-card calendar-board-card">
          <div className="calendar-board-header">
            <h3>{getMonthLabel(selectedMonth)}</h3>
            {isLoading && <span>A atualizar...</span>}
          </div>

          <div className="calendar-weekdays">
            {weekDays.map(day => <span key={day}>{day}</span>)}
          </div>

          <div className="calendar-grid">
            {monthCells.map((cell, index) => {
              if (!cell) return <div key={`empty-${index}`} className="calendar-day empty" />;

              const dayEvents = eventsByDate[cell.date] || [];
              const hasOverdue = dayEvents.some(event => ['atrasado', 'vencido'].includes(event.status));
              const isSelected = selectedDate === cell.date;
              const isToday = todayKey === cell.date;

              return (
                <button
                  key={cell.date}
                  type="button"
                  className={`calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${hasOverdue ? 'has-alert' : ''}`}
                  onClick={() => setSelectedDate(cell.date)}
                >
                  <span className="calendar-day-number">{cell.day}</span>
                  <div className="calendar-day-events">
                    {dayEvents.slice(0, 3).map(event => (
                      <span key={event.id} className={`calendar-event-chip ${getTone(event)}`}>
                        {event.title}
                      </span>
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="calendar-more-events">+{dayEvents.length - 3}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="calendar-side-panel">
          <section className="dash-card calendar-day-panel">
            <div className="calendar-panel-heading">
              <span>Dia selecionado</span>
              <strong>{new Date(`${selectedDate}T00:00:00`).toLocaleDateString('pt-AO', { day: '2-digit', month: 'short' })}</strong>
            </div>

            {selectedDayEvents.length === 0 ? (
              <p className="calendar-empty-text">Sem compromissos financeiros neste dia.</p>
            ) : (
              <div className="calendar-event-list">
                {selectedDayEvents.map(event => (
                  <article key={event.id} className={`calendar-event-card ${getTone(event)}`}>
                    <div>
                      <span>{getLabel(event)}</span>
                      <h4>{event.title}</h4>
                      {event.description && <p>{event.description}</p>}
                    </div>
                    <strong>{event.direction === 'meta' ? 'Falta ' : ''}{currency.format(event.amount || 0)}</strong>
                    <em>{event.status}</em>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="dash-card calendar-next-panel">
            <div className="calendar-panel-heading">
              <span>Próximos</span>
              <strong>{summary.totalEvents}</strong>
            </div>

            {nextEvents.length === 0 ? (
              <p className="calendar-empty-text">Sem próximos eventos neste mês.</p>
            ) : (
              <div className="calendar-next-list">
                {nextEvents.map(event => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setSelectedDate(event.date)}
                  >
                    <span>{new Date(`${event.date}T00:00:00`).toLocaleDateString('pt-AO', { day: '2-digit', month: 'short' })}</span>
                    <strong>{event.title}</strong>
                    <em>{currency.format(event.amount || 0)}</em>
                  </button>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
