const DAY_IN_MS = 24 * 60 * 60 * 1000;

function pad(value) {
  return String(value).padStart(2, '0');
}

export function getDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function getCurrentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function createDefaultPeriodFilter(preset = 'month') {
  return {
    preset,
    month: getCurrentMonthKey(),
    start: '',
    end: ''
  };
}

export function parseLocalDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const normalized = String(value).trim();
  if (!normalized) return null;

  const dateOnly = normalized.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const monthOnly = normalized.match(/^(\d{4})-(\d{2})$/);
  if (monthOnly) {
    const [, year, month] = monthOnly;
    const parsed = new Date(Number(year), Number(month) - 1, 1);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function startOfWeek(date) {
  const base = startOfDay(date);
  const day = base.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return new Date(base.getTime() + mondayOffset * DAY_IN_MS);
}

function endOfWeek(date) {
  return endOfDay(new Date(startOfWeek(date).getTime() + 6 * DAY_IN_MS));
}

function monthRange(monthKey) {
  const parsed = parseLocalDate(monthKey || getCurrentMonthKey());
  if (!parsed) return null;

  return {
    start: new Date(parsed.getFullYear(), parsed.getMonth(), 1, 0, 0, 0, 0),
    end: new Date(parsed.getFullYear(), parsed.getMonth() + 1, 0, 23, 59, 59, 999)
  };
}

export function getPeriodRange(filter) {
  const safeFilter = filter || createDefaultPeriodFilter();
  const preset = safeFilter.preset || 'month';
  const now = new Date();

  if (preset === 'all') return null;

  if (preset === 'today') {
    return { start: startOfDay(now), end: endOfDay(now) };
  }

  if (preset === 'week') {
    return { start: startOfWeek(now), end: endOfWeek(now) };
  }

  if (preset === 'custom') {
    const start = safeFilter.start ? startOfDay(parseLocalDate(safeFilter.start)) : null;
    const end = safeFilter.end ? endOfDay(parseLocalDate(safeFilter.end)) : null;

    if (!start && !end) return null;
    return {
      start: start || new Date(-8640000000000000),
      end: end || new Date(8640000000000000)
    };
  }

  return monthRange(safeFilter.month);
}

export function isDateInPeriod(value, filter) {
  const range = getPeriodRange(filter);
  if (!range) return true;

  const parsed = parseLocalDate(value);
  if (!parsed) return false;

  const time = parsed.getTime();
  return time >= range.start.getTime() && time <= range.end.getTime();
}

export function filterByPeriod(items, filter, getDate) {
  return (items || []).filter(item => isDateInPeriod(getDate(item), filter));
}

export function getPeriodLabel(filter) {
  const safeFilter = filter || createDefaultPeriodFilter();

  if (safeFilter.preset === 'all') return 'todos os períodos';
  if (safeFilter.preset === 'today') return 'hoje';
  if (safeFilter.preset === 'week') return 'esta semana';
  if (safeFilter.preset === 'custom') return 'período personalizado';

  const range = monthRange(safeFilter.month);
  if (!range) return 'mês selecionado';

  return range.start.toLocaleDateString('pt-AO', {
    month: 'long',
    year: 'numeric'
  });
}

export function getDateFromMonthDay(monthKey, day) {
  const parsed = parseLocalDate(monthKey || getCurrentMonthKey());
  const numericDay = Number(day);
  if (!parsed || !numericDay) return null;

  const daysInMonth = new Date(parsed.getFullYear(), parsed.getMonth() + 1, 0).getDate();
  return new Date(parsed.getFullYear(), parsed.getMonth(), Math.min(numericDay, daysInMonth));
}

export function isMonthDayInPeriod(day, filter) {
  const range = getPeriodRange(filter);
  if (!range) return true;

  let cursor = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
  const limit = new Date(range.end.getFullYear(), range.end.getMonth(), 1);
  let guard = 0;

  while (cursor <= limit && guard < 36) {
    const candidate = getDateFromMonthDay(getCurrentMonthKey(cursor), day);
    if (candidate && isDateInPeriod(candidate, filter)) return true;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    guard += 1;
  }

  return false;
}
