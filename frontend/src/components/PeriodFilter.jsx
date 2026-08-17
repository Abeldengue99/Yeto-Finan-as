import React from 'react';
import { createDefaultPeriodFilter, getCurrentMonthKey } from '../utils/periodFilters';

const PERIOD_OPTIONS = [
  { value: 'month', label: 'Mês' },
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Semana' },
  { value: 'custom', label: 'Intervalo' },
  { value: 'all', label: 'Todos' }
];

export default function PeriodFilter({
  value,
  onChange,
  label = 'Filtrar por período',
  className = '',
  compact = false
}) {
  const filter = value || createDefaultPeriodFilter();

  const updateFilter = (patch) => {
    onChange?.({
      ...filter,
      ...patch
    });
  };

  return (
    <div className={`period-filter ${compact ? 'compact' : ''} ${className}`.trim()}>
      <label>{label}</label>
      <div className="period-filter-row">
        <select
          className="qt-input"
          value={filter.preset || 'month'}
          onChange={event => {
            const preset = event.target.value;
            updateFilter({
              preset,
              month: filter.month || getCurrentMonthKey()
            });
          }}
        >
          {PERIOD_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {(filter.preset || 'month') === 'month' && (
          <input
            type="month"
            className="qt-input"
            value={filter.month || getCurrentMonthKey()}
            onChange={event => updateFilter({ month: event.target.value || getCurrentMonthKey() })}
          />
        )}

        {filter.preset === 'custom' && (
          <>
            <input
              type="date"
              className="qt-input"
              value={filter.start || ''}
              onChange={event => updateFilter({ start: event.target.value })}
              aria-label="Data inicial"
            />
            <input
              type="date"
              className="qt-input"
              value={filter.end || ''}
              onChange={event => updateFilter({ end: event.target.value })}
              aria-label="Data final"
            />
          </>
        )}
      </div>
    </div>
  );
}
