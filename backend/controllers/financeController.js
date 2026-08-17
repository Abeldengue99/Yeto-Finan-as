const pool = require('../config/database');

const OWNED_TABLES = new Set([
  'accounts',
  'transactions',
  'debts',
  'fixed_payments',
  'projects',
  'kixikila_groups',
  'foreign_currency',
  'budgets',
  'shopping_lists',
  'shopping_list_items'
]);

function isAdminRequest(req) {
  return req.user?.plan_type === 'admin';
}

function getRequestUserId(req, fallbackUserId) {
  return isAdminRequest(req) ? fallbackUserId : req.user?.id;
}

async function getOwnedResource(db, table, id, req) {
  if (!OWNED_TABLES.has(table)) {
    throw new Error('Tabela não autorizada para verificação de propriedade.');
  }

  const params = [id];
  let query = `SELECT * FROM ${table} WHERE id = $1`;

  if (!isAdminRequest(req)) {
    query += ' AND user_id = $2';
    params.push(req.user.id);
  }

  const result = await db.query(query, params);
  return result.rows[0] || null;
}

async function ensureAccountOwnership(db, accountId, ownerUserId) {
  if (!accountId || !ownerUserId) return false;

  const result = await db.query(
    'SELECT id FROM accounts WHERE id = $1 AND user_id = $2',
    [accountId, ownerUserId]
  );

  return result.rows.length > 0;
}

function appendOwnerFilter(req, params) {
  if (isAdminRequest(req)) return '';

  params.push(req.user.id);
  return ` AND user_id = $${params.length}`;
}

function getMonthKey(value) {
  const candidate = String(value || '').trim();
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(candidate)) return candidate;
  return new Date().toISOString().slice(0, 7);
}

function cleanBudgetCategory(value) {
  return String(value || '').trim().slice(0, 120);
}

function cleanShoppingText(value, maxLength = 120) {
  return String(value || '').trim().slice(0, maxLength);
}

function getMonthBounds(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const nextMonthStart = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return {
    year,
    month,
    monthStart,
    nextMonthStart,
    monthStartKey: `${monthKey}-01`,
    lastDay
  };
}

function formatDateKey(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function buildMonthDate(monthKey, day) {
  const { year, month, lastDay } = getMonthBounds(monthKey);
  const cleanDay = Math.max(1, Math.min(Number(day) || 1, lastDay));
  return `${year}-${String(month).padStart(2, '0')}-${String(cleanDay).padStart(2, '0')}`;
}

function getKixikilaIntervalDays(periodicity) {
  const text = String(periodicity || '').toLowerCase();
  if (text.includes('semanal')) return 7;
  if (text.includes('quinzenal')) return 15;
  return 0;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getKixikilaDates(kixikila, monthKey) {
  const { monthStart, nextMonthStart } = getMonthBounds(monthKey);
  const startKey = formatDateKey(kixikila.start_date);
  const intervalDays = getKixikilaIntervalDays(kixikila.periodicity);

  if (!startKey) {
    return [`${monthKey}-01`];
  }

  const startDate = new Date(`${startKey}T00:00:00Z`);
  if (Number.isNaN(startDate.getTime()) || startDate >= nextMonthStart) return [];

  if (!intervalDays) {
    const dateKey = buildMonthDate(monthKey, startDate.getUTCDate());
    const date = new Date(`${dateKey}T00:00:00Z`);
    return date >= startDate && date < nextMonthStart ? [dateKey] : [];
  }

  let cursor = new Date(startDate);
  while (cursor < monthStart) {
    cursor = addDays(cursor, intervalDays);
  }

  const dates = [];
  while (cursor < nextMonthStart) {
    dates.push(formatDateKey(cursor));
    cursor = addDays(cursor, intervalDays);
  }

  return dates;
}

function isSalaryEvent(row) {
  const text = `${row.category || ''} ${row.description || ''}`.toLowerCase();
  return /sal[aá]rio|ordenado|vencimento/.test(text);
}

function isInstallmentEvent(row) {
  const text = `${row.category || ''} ${row.name || ''}`.toLowerCase();
  return /presta[cç][aã]o|credito|cr[eé]dito|financiamento|emprestimo|empr[eé]stimo/.test(text);
}

function getForecastAnchor(monthKey) {
  const today = new Date();
  const currentMonthKey = today.toISOString().slice(0, 7);
  const { year, month, lastDay } = getMonthBounds(monthKey);
  const day = monthKey === currentMonthKey ? today.getDate() : 1;

  return {
    todayKey: buildMonthDate(monthKey, Math.min(day, lastDay)),
    todayDay: Math.min(day, lastDay),
    lastDay,
    year,
    month
  };
}

function normalizeForecastTransaction(row) {
  const type = row.type === 'income' ? 'entrada' : 'saida';
  return {
    id: row.id,
    type,
    category: row.category || 'Sem categoria',
    description: row.description || '',
    amount: Number(row.amount || 0),
    date: formatDateKey(row.transaction_date)
  };
}

function isCommittedExpense(transaction) {
  const text = `${transaction.category} ${transaction.description}`.toLowerCase();
  return /pagamento fixo|d[ií]vida|kixikila|projeto|divisa|c[aâ]mbio/.test(text);
}

function getMonthObligationDate(monthKey, dueDay) {
  return buildMonthDate(monthKey, dueDay);
}

function pushDailyImpact(map, date, amount) {
  map.set(date, Number(map.get(date) || 0) + Number(amount || 0));
}

function sortByDateThenAmount(a, b) {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  return Number(b.amount || 0) - Number(a.amount || 0);
}

function buildEmergencyPlan({ projectedEndBalance, shortageDay, remainingDays, dailyAverageExpense, frozenCategories, priorities, currentBalance }) {
  const missingAmount = Math.max(0, -projectedEndBalance);
  const suggestedDailyLimit = Math.max(0, Math.floor((currentBalance - priorities.totalCritical) / Math.max(1, remainingDays)));
  const dailyCutNeeded = missingAmount > 0 ? Math.ceil(missingAmount / Math.max(1, remainingDays)) : 0;
  const active = missingAmount > 0 || Boolean(shortageDay);
  const severity = active ? 'critical' : projectedEndBalance < currentBalance * 0.15 ? 'attention' : 'stable';
  const message = active
    ? 'Há risco financeiro neste mês. Priorize contas essenciais, reduza gastos variáveis e congele categorias não essenciais.'
    : severity === 'attention'
      ? 'O mês ainda está controlado, mas a margem está curta. Evite assumir novos compromissos.'
      : 'O mês está equilibrado. Continue a acompanhar entradas, saídas e compromissos futuros.';

  const actions = [];
  if (missingAmount > 0) {
    actions.push(`Reduzir pelo menos Kz ${dailyCutNeeded.toLocaleString('pt-AO')} por dia até ao fim do mês.`);
  }
  if (frozenCategories.length > 0) {
    actions.push(`Congelar temporariamente: ${frozenCategories.slice(0, 3).map(item => item.category).join(', ')}.`);
  }
  if (priorities.items.length > 0) {
    actions.push('Pagar primeiro os compromissos marcados como prioridade alta.');
  }
  if (dailyAverageExpense > suggestedDailyLimit && suggestedDailyLimit > 0) {
    actions.push(`Manter gastos variáveis abaixo de Kz ${suggestedDailyLimit.toLocaleString('pt-AO')} por dia.`);
  }
  if (actions.length === 0) {
    actions.push('Manter o ritmo atual e rever o calendário antes de assumir novos gastos.');
  }

  return {
    active,
    severity,
    message,
    missingAmount,
    dailyCutNeeded,
    suggestedDailyLimit,
    frozenCategories,
    priorities: priorities.items,
    actions
  };
}

const getUserFinances = async (req, res) => {
  const { userId } = req.params;

  try {
    // 0. Fetch User Info
    const userRes = await pool.query(
      'SELECT name, email, occupation, avatar_url, yeto_points, plan_type, subscription_plan, created_at, plan_expires_at FROM users WHERE id = $1',
      [userId]
    );
    const user = userRes.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'Utilizador não encontrado.' });
    }

    if (user.plan_type === 'free' && !user.plan_expires_at && user.created_at) {
      const expiryResult = await pool.query(
        "UPDATE users SET plan_expires_at = created_at + INTERVAL '30 days' WHERE id = $1 AND plan_expires_at IS NULL RETURNING plan_expires_at",
        [userId]
      );

      if (expiryResult.rows[0]) {
        user.plan_expires_at = expiryResult.rows[0].plan_expires_at;
      }
    }

    // 1. Fetch Accounts
    const accountsResult = await pool.query('SELECT * FROM accounts WHERE user_id = $1', [userId]);
    const accounts = accountsResult.rows;

    // 2. Fetch Transactions (Recent)
    const transactionsResult = await pool.query('SELECT * FROM transactions WHERE user_id = $1 ORDER BY transaction_date DESC LIMIT 50', [userId]);
    const transactions = transactionsResult.rows;

    // 3. Fetch Debts
    const debtsResult = await pool.query('SELECT * FROM debts WHERE user_id = $1', [userId]);
    const debts = debtsResult.rows;

    // 4. Fetch Fixed Payments
    const fixedPaymentsResult = await pool.query('SELECT * FROM fixed_payments WHERE user_id = $1', [userId]);
    const fixedPayments = fixedPaymentsResult.rows;

    // 5. Fetch Projects
    const projectsResult = await pool.query('SELECT * FROM projects WHERE user_id = $1', [userId]);
    const projects = projectsResult.rows;

    // 6. Fetch Kixikilas
    const kixikilasResult = await pool.query('SELECT * FROM kixikila_groups WHERE user_id = $1', [userId]);
    const kixikilas = kixikilasResult.rows;

    // 7. Fetch Divisas
    const divisasResult = await pool.query('SELECT * FROM foreign_currency WHERE user_id = $1 ORDER BY purchase_date DESC', [userId]);
    const divisas = divisasResult.rows;

    // 8. Fetch current month budgets
    const currentMonth = getMonthKey();
    const budgetsResult = await pool.query(
      'SELECT * FROM budgets WHERE user_id = $1 AND month_key = $2 ORDER BY category ASC',
      [userId, currentMonth]
    );
    const budgets = budgetsResult.rows;

    // Calculate Total Balance directly from accounts
    const saldoTotal = accounts.reduce((acc, curr) => acc + Number(curr.balance), 0);

    // Calculate despesas/entradas from transactions (for simplicity, we return the raw transactions and let frontend handle, or we can aggregate)
    const despesas = transactions.filter(t => t.type === 'expense').map(t => ({ id: t.id, descricao: t.description, valor: Number(t.amount), categoria: t.category, data: t.transaction_date, contaId: t.account_id }));
    
    // Map data to match frontend expectations
    res.status(200).json({
      user,
      saldoTotal,
      accounts: accounts.map(a => ({
        id: a.id,
        nome: a.name,
        tipo: a.type,
        saldo: Number(a.balance),
        cor: a.color_code,
        iban: a.iban || ''
      })),
      movimentos: transactions.map(t => ({
        id: t.id,
        tipo_movimento: t.type === 'income' ? 'entrada' : 'saida',
        descricao: t.description,
        valor: Number(t.amount),
        categoria: t.category,
        data: t.transaction_date,
        contaId: t.account_id
      })),
      despesas,
      dividas: debts.map(d => ({
        id: d.id,
        pessoa: d.person_name,
        valor: Number(d.amount),
        tipo: d.type === 'to_receive' ? 'a_receber' : 'a_pagar',
        finalidade: d.purpose || '',
        dataVencimento: d.due_date ? new Date(d.due_date).toISOString().split('T')[0] : '',
        paga: d.is_paid
      })),
      pagamentosFixos: fixedPayments.map(p => ({
        id: p.id,
        nome: p.name,
        categoria: p.category,
        valor: Number(p.amount),
        diaVencimento: p.due_day,
        pagoEsteMes: p.is_paid_this_month
      })),
      projetos: projects.map(p => ({
        id: p.id,
        nome: p.name,
        categoria: p.category,
        objetivo: Number(p.target_amount),
        valorGuardado: Number(p.saved_amount),
        prazo: p.deadline ? new Date(p.deadline).toISOString().split('T')[0] : ''
      })),
      kixikilas: kixikilas.map(k => ({
        id: k.id,
        nome: k.name,
        membros: [], // Para simplicidade vamos assumir array vazio até termos a gestão de membros na UI
        periodicidade: k.periodicity,
        minhaPosicao: 1, // Mock
        valorQuota: Number(k.quota_value),
        valorMao: Number(k.hand_value),
        proximaData: k.start_date ? new Date(k.start_date).toISOString().split('T')[0] : ''
      })),
      divisas: divisas.map(d => ({
        id: d.id,
        moeda: d.currency,
        montante: Number(d.amount_bought),
        taxaCompra: Number(d.exchange_rate),
        data: d.purchase_date ? new Date(d.purchase_date).toISOString().split('T')[0] : ''
      })),
      orcamentos: budgets.map(b => ({
        id: b.id,
        categoria: b.category,
        mes: b.month_key,
        limite: Number(b.monthly_limit)
      }))
    });

  } catch (error) {
    console.error('Error fetching user finances:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao carregar finanças.' });
  }
};

const getBudgets = async (req, res) => {
  const { userId } = req.params;
  const monthKey = getMonthKey(req.query.month);

  try {
    const result = await pool.query(
      'SELECT * FROM budgets WHERE user_id = $1 AND month_key = $2 ORDER BY category ASC',
      [userId, monthKey]
    );

    res.json({
      month: monthKey,
      budgets: result.rows.map(row => ({
        id: row.id,
        categoria: row.category,
        mes: row.month_key,
        limite: Number(row.monthly_limit)
      }))
    });
  } catch (error) {
    console.error('Erro ao carregar orçamentos:', error);
    res.status(500).json({ error: 'Erro ao carregar orçamentos.' });
  }
};

const getFinancialCalendar = async (req, res) => {
  const { userId } = req.params;
  const monthKey = getMonthKey(req.query.month);
  const { monthStartKey } = getMonthBounds(monthKey);
  const todayKey = formatDateKey(new Date());

  try {
    const [transactionsRes, fixedRes, debtsRes, projectsRes, kixikilasRes] = await Promise.all([
      pool.query(
        `SELECT id, type, category, description, amount, transaction_date
         FROM transactions
         WHERE user_id = $1
           AND transaction_date >= $2::date
           AND transaction_date < ($2::date + INTERVAL '1 month')
         ORDER BY transaction_date ASC`,
        [userId, monthStartKey]
      ),
      pool.query(
        `SELECT id, name, category, amount, due_day, is_paid_this_month
         FROM fixed_payments
         WHERE user_id = $1
         ORDER BY due_day ASC`,
        [userId]
      ),
      pool.query(
        `SELECT id, person_name, type, amount, due_date, purpose, is_paid
         FROM debts
         WHERE user_id = $1
           AND due_date >= $2::date
           AND due_date < ($2::date + INTERVAL '1 month')
         ORDER BY due_date ASC`,
        [userId, monthStartKey]
      ),
      pool.query(
        `SELECT id, name, category, target_amount, saved_amount, deadline
         FROM projects
         WHERE user_id = $1
           AND deadline >= $2::date
           AND deadline < ($2::date + INTERVAL '1 month')
         ORDER BY deadline ASC`,
        [userId, monthStartKey]
      ),
      pool.query(
        `SELECT id, name, quota_value, hand_value, periodicity, start_date
         FROM kixikila_groups
         WHERE user_id = $1`,
        [userId]
      )
    ]);

    const events = [];

    transactionsRes.rows.forEach(row => {
      const isIncome = row.type === 'income';
      const type = isIncome && isSalaryEvent(row) ? 'salario' : isIncome ? 'receita' : 'despesa';
      events.push({
        id: `transaction-${row.id}`,
        sourceId: row.id,
        source: 'transactions',
        type,
        direction: isIncome ? 'entrada' : 'saida',
        title: isIncome && type === 'salario' ? `Salário: ${row.description}` : row.description,
        description: row.category || '',
        amount: Number(row.amount),
        date: formatDateKey(row.transaction_date),
        status: 'realizado'
      });
    });

    fixedRes.rows.forEach(row => {
      const date = buildMonthDate(monthKey, row.due_day);
      const type = isInstallmentEvent(row) ? 'prestacao' : 'fixo';
      events.push({
        id: `fixed-${row.id}`,
        sourceId: row.id,
        source: 'fixed_payments',
        type,
        direction: 'saida',
        title: row.name,
        description: row.category || 'Pagamento fixo',
        amount: Number(row.amount),
        date,
        status: row.is_paid_this_month ? 'pago' : date < todayKey ? 'atrasado' : 'pendente'
      });
    });

    debtsRes.rows.forEach(row => {
      const isReceivable = row.type === 'to_receive';
      const date = formatDateKey(row.due_date);
      events.push({
        id: `debt-${row.id}`,
        sourceId: row.id,
        source: 'debts',
        type: isReceivable ? 'divida_receber' : 'divida_pagar',
        direction: isReceivable ? 'entrada' : 'saida',
        title: isReceivable ? `Receber de ${row.person_name}` : `Pagar a ${row.person_name}`,
        description: row.purpose || 'Dívida',
        amount: Number(row.amount),
        date,
        status: row.is_paid ? 'pago' : date < todayKey ? 'atrasado' : 'pendente'
      });
    });

    projectsRes.rows.forEach(row => {
      const remaining = Math.max(0, Number(row.target_amount) - Number(row.saved_amount || 0));
      events.push({
        id: `project-${row.id}`,
        sourceId: row.id,
        source: 'projects',
        type: 'meta',
        direction: 'meta',
        title: `Meta: ${row.name}`,
        description: row.category || 'Projeto',
        amount: remaining,
        totalAmount: Number(row.target_amount),
        savedAmount: Number(row.saved_amount || 0),
        date: formatDateKey(row.deadline),
        status: remaining <= 0 ? 'concluido' : 'pendente'
      });
    });

    kixikilasRes.rows.forEach(row => {
      getKixikilaDates(row, monthKey).forEach(date => {
        events.push({
          id: `kixikila-${row.id}-${date}`,
          sourceId: row.id,
          source: 'kixikila_groups',
          type: 'kixikila',
          direction: 'saida',
          title: `Quota da Kixikila: ${row.name}`,
          description: row.periodicity || 'Kixikila',
          amount: Number(row.quota_value),
          handAmount: Number(row.hand_value),
          date,
          status: date < todayKey ? 'vencido' : 'pendente'
        });
      });
    });

    const orderedEvents = events
      .filter(event => event.date?.startsWith(monthKey))
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.title.localeCompare(b.title);
      });

    const summary = orderedEvents.reduce((acc, event) => {
      if (event.direction === 'entrada') acc.income += Number(event.amount || 0);
      if (event.direction === 'saida') acc.expense += Number(event.amount || 0);
      if (event.direction === 'meta') acc.goals += Number(event.amount || 0);
      if (event.status === 'atrasado' || event.status === 'vencido') acc.overdue += 1;
      if (event.status === 'pendente') acc.pending += 1;
      return acc;
    }, {
      income: 0,
      expense: 0,
      goals: 0,
      pending: 0,
      overdue: 0
    });

    res.json({
      month: monthKey,
      events: orderedEvents,
      summary: {
        ...summary,
        forecast: summary.income - summary.expense,
        totalEvents: orderedEvents.length
      }
    });
  } catch (error) {
    console.error('Erro ao carregar calendário financeiro:', error);
    res.status(500).json({ error: 'Erro ao carregar calendário financeiro.' });
  }
};

const getMonthEndForecast = async (req, res) => {
  const { userId } = req.params;
  const monthKey = getMonthKey(req.query.month);
  const { monthStartKey } = getMonthBounds(monthKey);
  const { todayKey, todayDay, lastDay } = getForecastAnchor(monthKey);
  const remainingDays = Math.max(0, lastDay - todayDay);

  try {
    const [accountsRes, transactionsRes, fixedRes, debtsRes, kixikilasRes, budgetsRes] = await Promise.all([
      pool.query('SELECT COALESCE(SUM(balance), 0) AS balance FROM accounts WHERE user_id = $1', [userId]),
      pool.query(
        `SELECT id, type, category, description, amount, transaction_date
         FROM transactions
         WHERE user_id = $1
           AND transaction_date >= $2::date
           AND transaction_date <= $3::date
         ORDER BY transaction_date ASC`,
        [userId, monthStartKey, todayKey]
      ),
      pool.query(
        `SELECT id, name, category, amount, due_day, is_paid_this_month
         FROM fixed_payments
         WHERE user_id = $1
         ORDER BY due_day ASC`,
        [userId]
      ),
      pool.query(
        `SELECT id, person_name, type, amount, due_date, purpose, is_paid
         FROM debts
         WHERE user_id = $1
           AND is_paid = FALSE
           AND due_date >= $2::date
           AND due_date < ($2::date + INTERVAL '1 month')
         ORDER BY due_date ASC`,
        [userId, monthStartKey]
      ),
      pool.query(
        `SELECT id, name, quota_value, hand_value, periodicity, start_date
         FROM kixikila_groups
         WHERE user_id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT category, monthly_limit
         FROM budgets
         WHERE user_id = $1
           AND month_key = $2`,
        [userId, monthKey]
      )
    ]);

    const currentBalance = Number(accountsRes.rows[0]?.balance || 0);
    const transactions = transactionsRes.rows.map(normalizeForecastTransaction);
    const incomeToDate = transactions
      .filter(item => item.type === 'entrada')
      .reduce((sum, item) => sum + item.amount, 0);
    const expenseToDate = transactions
      .filter(item => item.type === 'saida')
      .reduce((sum, item) => sum + item.amount, 0);
    const variableExpenses = transactions.filter(item => item.type === 'saida' && !isCommittedExpense(item));
    const variableExpenseToDate = variableExpenses.reduce((sum, item) => sum + item.amount, 0);
    const dailyAverageExpense = variableExpenseToDate / Math.max(1, todayDay);
    const remainingVariableForecast = Math.round(dailyAverageExpense * remainingDays);

    const dailyImpacts = new Map();
    const commitments = [];
    const receivables = [];

    fixedRes.rows
      .filter(row => !row.is_paid_this_month)
      .forEach(row => {
        const date = getMonthObligationDate(monthKey, row.due_day);
        if (date < todayKey) return;

        const item = {
          type: isInstallmentEvent(row) ? 'prestacao' : 'fixo',
          title: row.name,
          category: row.category || 'Pagamento fixo',
          amount: Number(row.amount || 0),
          date,
          priority: row.due_day - todayDay <= 5 ? 'alta' : 'normal'
        };
        commitments.push(item);
        pushDailyImpact(dailyImpacts, date, -item.amount);
      });

    debtsRes.rows.forEach(row => {
      const date = formatDateKey(row.due_date);
      const amount = Number(row.amount || 0);

      if (row.type === 'to_receive') {
        const item = {
          type: 'divida_receber',
          title: `Receber de ${row.person_name}`,
          category: row.purpose || 'Dívida a receber',
          amount,
          date
        };
        receivables.push(item);
        if (date >= todayKey) pushDailyImpact(dailyImpacts, date, amount);
        return;
      }

      if (date >= todayKey) {
        const item = {
          type: 'divida_pagar',
          title: `Pagar a ${row.person_name}`,
          category: row.purpose || 'Dívida a pagar',
          amount,
          date,
          priority: date <= todayKey ? 'alta' : 'normal'
        };
        commitments.push(item);
        pushDailyImpact(dailyImpacts, date, -amount);
      }
    });

    kixikilasRes.rows.forEach(row => {
      getKixikilaDates(row, monthKey)
        .filter(date => date >= todayKey)
        .forEach(date => {
          const item = {
            type: 'kixikila',
            title: `Quota da Kixikila: ${row.name}`,
            category: row.periodicity || 'Kixikila',
            amount: Number(row.quota_value || 0),
            date,
            priority: 'normal'
          };
          commitments.push(item);
          pushDailyImpact(dailyImpacts, date, -item.amount);
        });
    });

    const upcomingCommitments = commitments.reduce((sum, item) => sum + item.amount, 0);
    const expectedReceivables = receivables
      .filter(item => item.date >= todayKey)
      .reduce((sum, item) => sum + item.amount, 0);
    const projectedEndBalance = Math.round(currentBalance + expectedReceivables - upcomingCommitments - remainingVariableForecast);

    let simulatedBalance = currentBalance;
    let shortageDay = null;
    for (let day = todayDay; day <= lastDay; day += 1) {
      const date = buildMonthDate(monthKey, day);
      if (day > todayDay) simulatedBalance -= dailyAverageExpense;
      simulatedBalance += Number(dailyImpacts.get(date) || 0);
      if (simulatedBalance < 0 && !shortageDay) {
        shortageDay = date;
        break;
      }
    }

    const expensesByCategory = variableExpenses.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + item.amount;
      return acc;
    }, {});
    const budgetByCategory = budgetsRes.rows.reduce((acc, row) => {
      acc[row.category] = Number(row.monthly_limit || 0);
      return acc;
    }, {});
    const frozenCategories = Object.entries(expensesByCategory)
      .map(([category, amount]) => {
        const limit = budgetByCategory[category] || 0;
        const overLimit = limit > 0 && amount >= limit * 0.8;
        const discretionary = /lazer|restaurante|fast|outros|roupa|viagem|evento|divers[aã]o/i.test(category);
        return {
          category,
          spent: Math.round(amount),
          limit,
          reason: overLimit ? 'perto do limite' : discretionary ? 'gasto não essencial' : 'maior impacto no mês',
          score: (overLimit ? 2 : 0) + (discretionary ? 2 : 0) + amount / 100000
        };
      })
      .filter(item => item.score >= 1)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const priorityItems = commitments
      .slice()
      .sort(sortByDateThenAmount)
      .slice(0, 6);
    const totalCritical = priorityItems
      .filter(item => item.priority === 'alta' || item.date <= buildMonthDate(monthKey, todayDay + 5))
      .reduce((sum, item) => sum + item.amount, 0);

    const emergency = buildEmergencyPlan({
      projectedEndBalance,
      shortageDay,
      remainingDays,
      dailyAverageExpense,
      frozenCategories,
      priorities: { totalCritical, items: priorityItems },
      currentBalance
    });

    const message = shortageDay
      ? `Se continuar assim, pode faltar dinheiro antes do dia ${new Date(`${shortageDay}T00:00:00`).getDate()}.`
      : projectedEndBalance < 0
        ? `Se continuar assim, terminará o mês com falta de Kz ${Math.abs(projectedEndBalance).toLocaleString('pt-AO')}.`
        : `Se continuar assim, terminará o mês com cerca de Kz ${projectedEndBalance.toLocaleString('pt-AO')}.`;

    res.json({
      month: monthKey,
      access: {
        annualOnly: true
      },
      forecast: {
        message,
        currentBalance: Math.round(currentBalance),
        incomeToDate: Math.round(incomeToDate),
        expenseToDate: Math.round(expenseToDate),
        variableExpenseToDate: Math.round(variableExpenseToDate),
        dailyAverageExpense: Math.round(dailyAverageExpense),
        remainingVariableForecast,
        upcomingCommitments: Math.round(upcomingCommitments),
        expectedReceivables: Math.round(expectedReceivables),
        projectedEndBalance,
        shortageDay,
        today: todayKey,
        daysRemaining: remainingDays
      },
      emergency
    });
  } catch (error) {
    console.error('Erro ao calcular previsão do fim do mês:', error);
    res.status(500).json({ error: 'Erro ao calcular previsão do fim do mês.' });
  }
};

const upsertBudget = async (req, res) => {
  let { userId, category, month, monthlyLimit } = req.body;
  userId = getRequestUserId(req, userId);

  const cleanCategory = cleanBudgetCategory(category);
  const monthKey = getMonthKey(month);
  const limit = Number(monthlyLimit);

  if (!cleanCategory) {
    return res.status(400).json({ error: 'Informe uma categoria para o orçamento.' });
  }

  if (!Number.isFinite(limit) || limit < 0) {
    return res.status(400).json({ error: 'Informe um limite mensal válido.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO budgets (user_id, category, month_key, monthly_limit)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, category, month_key)
       DO UPDATE SET monthly_limit = EXCLUDED.monthly_limit, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, cleanCategory, monthKey, limit]
    );

    const budget = result.rows[0];
    res.status(201).json({
      id: budget.id,
      categoria: budget.category,
      mes: budget.month_key,
      limite: Number(budget.monthly_limit)
    });
  } catch (error) {
    console.error('Erro ao guardar orçamento:', error);
    res.status(500).json({ error: 'Erro ao guardar orçamento.' });
  }
};

const deleteBudget = async (req, res) => {
  const { id } = req.params;

  try {
    const params = [id];
    const ownerFilter = appendOwnerFilter(req, params);
    const result = await pool.query(`DELETE FROM budgets WHERE id = $1${ownerFilter} RETURNING id`, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Orçamento não encontrado.' });
    }

    res.json({ message: 'Orçamento eliminado com sucesso.' });
  } catch (error) {
    console.error('Erro ao eliminar orçamento:', error);
    res.status(500).json({ error: 'Erro ao eliminar orçamento.' });
  }
};

function mapShoppingList(row, items = []) {
  const listItems = items.map(item => ({
    id: item.id,
    nome: item.item_name,
    categoria: item.category,
    quantidade: Number(item.quantity || 1),
    precoEstimado: Number(item.estimated_price || 0),
    total: Number(item.quantity || 1) * Number(item.estimated_price || 0),
    comprado: Boolean(item.is_checked)
  }));

  return {
    id: row.id,
    nome: row.name,
    mes: row.month_key,
    totalEstimado: listItems.reduce((sum, item) => sum + item.total, 0),
    itens: listItems
  };
}

const getShoppingLists = async (req, res) => {
  const { userId } = req.params;
  const monthKey = getMonthKey(req.query.month);
  const { monthStartKey } = getMonthBounds(monthKey);

  try {
    const [listsRes, itemsRes, budgetsRes, expensesRes] = await Promise.all([
      pool.query(
        `SELECT id, name, month_key
         FROM shopping_lists
         WHERE user_id = $1 AND month_key = $2
         ORDER BY created_at DESC`,
        [userId, monthKey]
      ),
      pool.query(
        `SELECT sli.*
         FROM shopping_list_items sli
         INNER JOIN shopping_lists sl ON sl.id = sli.list_id
         WHERE sli.user_id = $1 AND sl.month_key = $2
         ORDER BY sli.created_at ASC`,
        [userId, monthKey]
      ),
      pool.query(
        `SELECT category, monthly_limit
         FROM budgets
         WHERE user_id = $1 AND month_key = $2`,
        [userId, monthKey]
      ),
      pool.query(
        `SELECT category, COALESCE(SUM(amount), 0) AS spent
         FROM transactions
         WHERE user_id = $1
           AND type = 'expense'
           AND transaction_date >= $2::date
           AND transaction_date < ($2::date + INTERVAL '1 month')
         GROUP BY category`,
        [userId, monthStartKey]
      )
    ]);

    const itemsByList = itemsRes.rows.reduce((acc, item) => {
      acc[item.list_id] = acc[item.list_id] || [];
      acc[item.list_id].push(item);
      return acc;
    }, {});
    const lists = listsRes.rows.map(row => mapShoppingList(row, itemsByList[row.id] || []));
    const plannedByCategory = itemsRes.rows.reduce((acc, item) => {
      const category = item.category || 'Sem categoria';
      acc[category] = (acc[category] || 0) + Number(item.quantity || 1) * Number(item.estimated_price || 0);
      return acc;
    }, {});
    const spentByCategory = expensesRes.rows.reduce((acc, row) => {
      acc[row.category || 'Sem categoria'] = Number(row.spent || 0);
      return acc;
    }, {});
    const budgetByCategory = budgetsRes.rows.reduce((acc, row) => {
      acc[row.category] = Number(row.monthly_limit || 0);
      return acc;
    }, {});
    const categories = [...new Set([
      ...Object.keys(plannedByCategory),
      ...Object.keys(spentByCategory),
      ...Object.keys(budgetByCategory)
    ])].filter(Boolean);

    const categoryAnalysis = categories
      .map(category => {
        const budget = budgetByCategory[category] || 0;
        const spent = spentByCategory[category] || 0;
        const planned = plannedByCategory[category] || 0;
        const afterShopping = budget - spent - planned;
        const status = budget <= 0
          ? 'sem_orcamento'
          : afterShopping < 0
            ? 'excede'
            : afterShopping <= budget * 0.15
              ? 'apertado'
              : 'ok';

        return {
          categoria: category,
          orcamento: budget,
          jaGasto: spent,
          previstoLista: planned,
          saldoDepoisCompra: afterShopping,
          status
        };
      })
      .sort((a, b) => {
        if (a.status === 'excede' && b.status !== 'excede') return -1;
        if (b.status === 'excede' && a.status !== 'excede') return 1;
        return b.previstoLista - a.previstoLista;
      });

    const totalEstimated = lists.reduce((sum, list) => sum + list.totalEstimado, 0);
    const totalBudget = budgetsRes.rows.reduce((sum, row) => sum + Number(row.monthly_limit || 0), 0);
    const totalSpent = expensesRes.rows.reduce((sum, row) => sum + Number(row.spent || 0), 0);

    res.json({
      month: monthKey,
      lists,
      summary: {
        totalEstimated,
        totalBudget,
        totalSpent,
        totalAvailable: totalBudget - totalSpent,
        afterShoppingBalance: totalBudget - totalSpent - totalEstimated,
        categoryAnalysis
      }
    });
  } catch (error) {
    console.error('Erro ao carregar lista de compras:', error);
    res.status(500).json({ error: 'Erro ao carregar lista de compras.' });
  }
};

const createShoppingList = async (req, res) => {
  let { userId, name, month } = req.body;
  userId = getRequestUserId(req, userId);

  const cleanName = cleanShoppingText(name || 'Lista de Mercado');
  const monthKey = getMonthKey(month);

  if (!cleanName) {
    return res.status(400).json({ error: 'Informe o nome da lista.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO shopping_lists (user_id, name, month_key)
       VALUES ($1, $2, $3)
       RETURNING id, name, month_key`,
      [userId, cleanName, monthKey]
    );

    res.status(201).json(mapShoppingList(result.rows[0], []));
  } catch (error) {
    console.error('Erro ao criar lista de compras:', error);
    res.status(500).json({ error: 'Erro ao criar lista de compras.' });
  }
};

const addShoppingListItem = async (req, res) => {
  const { listId } = req.params;
  const { name, category, quantity, estimatedPrice } = req.body;
  const cleanName = cleanShoppingText(name);
  const cleanCategory = cleanBudgetCategory(category || 'Alimentação / Casa');
  const cleanQuantity = Number(quantity || 1);
  const cleanPrice = Number(estimatedPrice || 0);

  if (!cleanName) {
    return res.status(400).json({ error: 'Informe o nome do item.' });
  }

  if (!Number.isFinite(cleanQuantity) || cleanQuantity <= 0 || !Number.isFinite(cleanPrice) || cleanPrice < 0) {
    return res.status(400).json({ error: 'Informe quantidade e preço estimado válidos.' });
  }

  try {
    const list = await getOwnedResource(pool, 'shopping_lists', listId, req);
    if (!list) return res.status(404).json({ error: 'Lista de compras não encontrada.' });

    const result = await pool.query(
      `INSERT INTO shopping_list_items (list_id, user_id, item_name, category, quantity, estimated_price)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [listId, list.user_id, cleanName, cleanCategory, cleanQuantity, cleanPrice]
    );

    res.status(201).json(mapShoppingList({ id: list.id, name: list.name, month_key: list.month_key }, [result.rows[0]]).itens[0]);
  } catch (error) {
    console.error('Erro ao adicionar item na lista:', error);
    res.status(500).json({ error: 'Erro ao adicionar item na lista.' });
  }
};

const updateShoppingListItem = async (req, res) => {
  const { id } = req.params;
  const { name, category, quantity, estimatedPrice, isChecked } = req.body;
  const cleanName = cleanShoppingText(name);
  const cleanCategory = cleanBudgetCategory(category || 'Alimentação / Casa');
  const cleanQuantity = Number(quantity || 1);
  const cleanPrice = Number(estimatedPrice || 0);

  if (!cleanName) {
    return res.status(400).json({ error: 'Informe o nome do item.' });
  }

  if (!Number.isFinite(cleanQuantity) || cleanQuantity <= 0 || !Number.isFinite(cleanPrice) || cleanPrice < 0) {
    return res.status(400).json({ error: 'Informe quantidade e preço estimado válidos.' });
  }

  try {
    const params = [cleanName, cleanCategory, cleanQuantity, cleanPrice, Boolean(isChecked), id];
    const ownerFilter = appendOwnerFilter(req, params);
    const result = await pool.query(
      `UPDATE shopping_list_items
       SET item_name = $1, category = $2, quantity = $3, estimated_price = $4, is_checked = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6${ownerFilter}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item não encontrado.' });
    }

    res.json(mapShoppingList({ id: result.rows[0].list_id, name: '', month_key: '' }, [result.rows[0]]).itens[0]);
  } catch (error) {
    console.error('Erro ao atualizar item da lista:', error);
    res.status(500).json({ error: 'Erro ao atualizar item da lista.' });
  }
};

const deleteShoppingListItem = async (req, res) => {
  const { id } = req.params;

  try {
    const params = [id];
    const ownerFilter = appendOwnerFilter(req, params);
    const result = await pool.query(`DELETE FROM shopping_list_items WHERE id = $1${ownerFilter} RETURNING id`, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item não encontrado.' });
    }

    res.json({ message: 'Item removido com sucesso.' });
  } catch (error) {
    console.error('Erro ao remover item da lista:', error);
    res.status(500).json({ error: 'Erro ao remover item da lista.' });
  }
};

const deleteShoppingList = async (req, res) => {
  const { id } = req.params;

  try {
    const params = [id];
    const ownerFilter = appendOwnerFilter(req, params);
    const result = await pool.query(`DELETE FROM shopping_lists WHERE id = $1${ownerFilter} RETURNING id`, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lista de compras não encontrada.' });
    }

    res.json({ message: 'Lista de compras eliminada com sucesso.' });
  } catch (error) {
    console.error('Erro ao eliminar lista de compras:', error);
    res.status(500).json({ error: 'Erro ao eliminar lista de compras.' });
  }
};

const createAccount = async (req, res) => {
  let { userId, name, type, balance, currency, color_code, iban } = req.body;
  userId = getRequestUserId(req, userId);

  try {
    const result = await pool.query(
      `INSERT INTO accounts (user_id, name, type, balance, currency, color_code, iban) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, name, type, balance || 0, currency || 'AOA', color_code || '#000000', iban || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar conta:', error);
    res.status(500).json({ error: 'Erro ao criar conta na base de dados.' });
  }
};

const createTransaction = async (req, res) => {
  let { userId, accountId, type, category, description, amount, transaction_date } = req.body;
  userId = getRequestUserId(req, userId);

  const client = await pool.connect();

  try {
    await client.query('BEGIN'); // Start transaction for safety

    const ownsAccount = await ensureAccountOwnership(client, accountId, userId);
    if (!ownsAccount) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Conta não pertence ao utilizador autenticado.' });
    }

    // 1. Inserir a transação
    const transResult = await client.query(
      `INSERT INTO transactions (user_id, account_id, type, category, description, amount, transaction_date) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, accountId, type, category, description, amount, transaction_date]
    );

    const newTransaction = transResult.rows[0];

    // 2. Atualizar o saldo da conta
    const balanceAdjustment = type === 'income' ? amount : -amount;
    await client.query(
      `UPDATE accounts SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3`,
      [balanceAdjustment, accountId, userId]
    );

    await client.query('COMMIT');
    res.status(201).json(newTransaction);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao registar transação:', error);
    res.status(500).json({ error: 'Erro ao registar transação.' });
  } finally {
    client.release();
  }
};

const createDebt = async (req, res) => {
  let { userId, person_name, type, amount, due_date, purpose } = req.body;
  userId = getRequestUserId(req, userId);
  try {
    const result = await pool.query(
      `INSERT INTO debts (user_id, person_name, type, amount, due_date, purpose) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, person_name, type, amount, due_date || null, purpose || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar dívida:', error);
    res.status(500).json({ error: 'Erro ao registar dívida.' });
  }
};

const payDebt = async (req, res) => {
  const { id } = req.params;
  const { accountId } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const debt = await getOwnedResource(client, 'debts', id, req);
    if (!debt) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Dívida não encontrada.' });
    }

    const ownsAccount = await ensureAccountOwnership(client, accountId, debt.user_id);
    if (!ownsAccount) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Conta não pertence ao utilizador autenticado.' });
    }

    // Atualizar estado da dívida
    await client.query('UPDATE debts SET is_paid = true WHERE id = $1 AND user_id = $2', [id, debt.user_id]);

    // Atualizar saldo da conta: se eu pago uma dívida a pagar, sai dinheiro. Se recebo, entra dinheiro.
    const balanceAdjustment = debt.type === 'to_pay' ? -Number(debt.amount) : Number(debt.amount);
    await client.query(
      `UPDATE accounts SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3`,
      [balanceAdjustment, accountId, debt.user_id]
    );

    // Registar a transação
    await client.query(
      `INSERT INTO transactions (user_id, account_id, type, category, description, amount, transaction_date) 
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)`,
      [debt.user_id, accountId, debt.type === 'to_pay' ? 'expense' : 'income', 'dívida', `Liquidação de dívida: ${debt.person_name}`, debt.amount]
    );

    await client.query('COMMIT');
    res.status(200).json({ status: 'success' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao pagar dívida:', error);
    res.status(500).json({ error: 'Erro ao liquidar dívida.' });
  } finally {
    client.release();
  }
};

const createFixedPayment = async (req, res) => {
  let { userId, name, category, amount, due_day } = req.body;
  userId = getRequestUserId(req, userId);
  try {
    const result = await pool.query(
      `INSERT INTO fixed_payments (user_id, name, category, amount, due_day) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, name, category, amount, due_day]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar pagamento fixo:', error);
    res.status(500).json({ error: 'Erro ao registar pagamento fixo.' });
  }
};

const payFixedPayment = async (req, res) => {
  const { id } = req.params;
  const { accountId } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const fixed = await getOwnedResource(client, 'fixed_payments', id, req);
    if (!fixed) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pagamento fixo não encontrado.' });
    }

    const ownsAccount = await ensureAccountOwnership(client, accountId, fixed.user_id);
    if (!ownsAccount) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Conta não pertence ao utilizador autenticado.' });
    }

    // Marcar como pago este mês
    await client.query('UPDATE fixed_payments SET is_paid_this_month = true WHERE id = $1 AND user_id = $2', [id, fixed.user_id]);

    // Atualizar saldo da conta
    await client.query(
      `UPDATE accounts SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3`,
      [fixed.amount, accountId, fixed.user_id]
    );

    // Registar a transação
    await client.query(
      `INSERT INTO transactions (user_id, account_id, type, category, description, amount, transaction_date) 
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)`,
      [fixed.user_id, accountId, 'expense', fixed.category, `Pagamento Fixo: ${fixed.name}`, fixed.amount]
    );

    await client.query('COMMIT');
    res.status(200).json({ status: 'success' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao pagar fixo:', error);
    res.status(500).json({ error: 'Erro ao liquidar pagamento fixo.' });
  } finally {
    client.release();
  }
};

const createKixikila = async (req, res) => {
  let { userId, name, hand_value, quota_value, periodicity, start_date } = req.body;
  userId = getRequestUserId(req, userId);
  try {
    const result = await pool.query(
      `INSERT INTO kixikila_groups (user_id, name, hand_value, quota_value, periodicity, start_date) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, name, hand_value, quota_value, periodicity, start_date]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar kixikila:', error);
    res.status(500).json({ error: 'Erro ao registar kixikila.' });
  }
};

const receiveKixikilaHand = async (req, res) => {
  const { id } = req.params;
  const { accountId } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const kixikila = await getOwnedResource(client, 'kixikila_groups', id, req);
    if (!kixikila) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Kixikila não encontrada.' });
    }

    const ownsAccount = await ensureAccountOwnership(client, accountId, kixikila.user_id);
    if (!ownsAccount) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Conta não pertence ao utilizador autenticado.' });
    }

    // Atualizar saldo da conta
    await client.query(
      `UPDATE accounts SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3`,
      [kixikila.hand_value, accountId, kixikila.user_id]
    );

    // Registar a transação
    await client.query(
      `INSERT INTO transactions (user_id, account_id, type, category, description, amount, transaction_date) 
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)`,
      [kixikila.user_id, accountId, 'income', 'kixikila', `Mão da Kixikila: ${kixikila.name}`, kixikila.hand_value]
    );

    await client.query('COMMIT');
    res.status(200).json({ status: 'success' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao receber kixikila:', error);
    res.status(500).json({ error: 'Erro ao receber mão da kixikila.' });
  } finally {
    client.release();
  }
};

const createProject = async (req, res) => {
  let { userId, name, category, target_amount, saved_amount, deadline } = req.body;
  userId = getRequestUserId(req, userId);
  try {
    const result = await pool.query(
      `INSERT INTO projects (user_id, name, category, target_amount, saved_amount, deadline) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, name, category, target_amount, saved_amount || 0, deadline]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar projeto:', error);
    res.status(500).json({ error: 'Erro ao registar projeto.' });
  }
};

const createForeignCurrency = async (req, res) => {
  let { userId, accountId, currency, amount_bought, exchange_rate } = req.body;
  userId = getRequestUserId(req, userId);
  const total_spent_aoa = amount_bought * exchange_rate;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ownsAccount = await ensureAccountOwnership(client, accountId, userId);
    if (!ownsAccount) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Conta não pertence ao utilizador autenticado.' });
    }
    
    // Inserir compra de divisas
    const result = await client.query(
      `INSERT INTO foreign_currency (user_id, currency, amount_bought, exchange_rate, total_spent_aoa, purchase_date) 
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE) RETURNING *`,
      [userId, currency, amount_bought, exchange_rate, total_spent_aoa]
    );

    // Deduzir da conta
    await client.query(
      `UPDATE accounts SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3`,
      [total_spent_aoa, accountId, userId]
    );

    // Registar a transação
    await client.query(
      `INSERT INTO transactions (user_id, account_id, type, category, description, amount, transaction_date) 
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)`,
      [userId, accountId, 'expense', 'cambio', `Compra de ${amount_bought} ${currency}`, total_spent_aoa]
    );

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao comprar divisas:', error);
    res.status(500).json({ error: 'Erro ao comprar divisas.' });
  } finally {
    client.release();
  }
};

const fundProject = async (req, res) => {
  const { id } = req.params;
  const { accountId, amount } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const project = await getOwnedResource(client, 'projects', id, req);
    if (!project) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Projeto não encontrado.' });
    }

    const ownsAccount = await ensureAccountOwnership(client, accountId, project.user_id);
    if (!ownsAccount) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Conta não pertence ao utilizador autenticado.' });
    }

    // Atualizar valor guardado
    await client.query(
      `UPDATE projects SET saved_amount = saved_amount + $1 WHERE id = $2 AND user_id = $3`,
      [amount, id, project.user_id]
    );

    // Deduzir da conta
    await client.query(
      `UPDATE accounts SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3`,
      [amount, accountId, project.user_id]
    );

    // Registar a transação
    await client.query(
      `INSERT INTO transactions (user_id, account_id, type, category, description, amount, transaction_date) 
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)`,
      [project.user_id, accountId, 'expense', 'projeto', `Depósito no Projeto: ${project.name}`, amount]
    );

    await client.query('COMMIT');
    res.status(200).json({ status: 'success' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao financiar projeto:', error);
    res.status(500).json({ error: 'Erro ao financiar projeto.' });
  } finally {
    client.release();
  }
};


const uploadPaymentProof = async (req, res) => {
  let { userId, proofImage, planRequested } = req.body;
  userId = getRequestUserId(req, userId);
  try {
    if (!userId || !proofImage) {
      return res.status(400).json({ error: 'Faltam dados do comprovativo.' });
    }

    const normalizedPlan = planRequested === 'semestral' ? 'semestral' : 'anual';
    const result = await pool.query(
      'INSERT INTO payment_approvals (user_id, plan_requested, proof_image, status, notified_user) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, normalizedPlan, proofImage, 'pending', false]
    );
    res.status(201).json({ message: 'Comprovativo enviado com sucesso.', proof: result.rows[0] });
  } catch (err) {
    console.error('Erro ao enviar comprovativo:', err);
    res.status(500).json({ error: 'Erro interno ao processar comprovativo.' });
  }
};

const getPaymentStatus = async (req, res) => {
  const { userId } = req.params;
  try {
    // Busca pagamentos aprovados ou rejeitados que ainda não foram notificados
    const result = await pool.query(
      `SELECT id, status, submitted_at FROM payment_approvals 
       WHERE user_id = $1 AND status IN ('approved', 'rejected') AND notified_user = false`,
      [userId]
    );

    if (result.rows.length > 0) {
      // Marcar como notificados para não enviar novamente
      const ids = result.rows.map(r => r.id);
      await pool.query(
        `UPDATE payment_approvals SET notified_user = true WHERE id = ANY($1)`,
        [ids]
      );
    }

    res.json({ notifications: result.rows });
  } catch (err) {
    console.error('Erro ao verificar status de pagamento:', err);
    res.json({ notifications: [] });
  }
};

// ==========================================
// UPDATE & DELETE ENDPOINTS
// ==========================================

// --- TRANSACTIONS ---
const updateTransaction = async (req, res) => {
  const { id } = req.params;
  const { description, amount, category, transaction_date, accountId, type } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Get old transaction to reverse balance
    const old = await getOwnedResource(client, 'transactions', id, req);
    if (!old) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Transação não encontrada.' });
    }
    const oldAmount = Number(old.amount);
    const newAmount = Number(amount);
    const newType = ['income', 'expense'].includes(type) ? type : old.type;
    const newAccountId = accountId || old.account_id;

    const ownsNewAccount = await ensureAccountOwnership(client, newAccountId, old.user_id);
    if (!ownsNewAccount) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Conta nÃ£o pertence ao utilizador autenticado.' });
    }

    const oldReverse = old.type === 'income' ? -oldAmount : oldAmount;
    const newImpact = newType === 'income' ? newAmount : -newAmount;

    await client.query(
      'UPDATE accounts SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3',
      [oldReverse, old.account_id, old.user_id]
    );

    await client.query(
      'UPDATE accounts SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3',
      [newImpact, newAccountId, old.user_id]
    );

    const result = await client.query(
      'UPDATE transactions SET account_id = $1, type = $2, description = $3, amount = $4, category = $5, transaction_date = $6 WHERE id = $7 AND user_id = $8 RETURNING *',
      [newAccountId, newType, description, newAmount, category, transaction_date, id, old.user_id]
    );
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao atualizar transação:', error);
    res.status(500).json({ error: 'Erro ao atualizar transação.' });
  } finally {
    client.release();
  }
};

const deleteTransaction = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const old = await getOwnedResource(client, 'transactions', id, req);
    if (!old) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Transação não encontrada.' });
    }

    // Reverse balance impact
    if (old.type === 'expense') {
      await client.query('UPDATE accounts SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3', [Number(old.amount), old.account_id, old.user_id]);
    } else {
      await client.query('UPDATE accounts SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3', [Number(old.amount), old.account_id, old.user_id]);
    }

    await client.query('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [id, old.user_id]);
    await client.query('COMMIT');
    res.json({ message: 'Transação eliminada com sucesso.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao eliminar transação:', error);
    res.status(500).json({ error: 'Erro ao eliminar transação.' });
  } finally {
    client.release();
  }
};

// --- ACCOUNTS ---
const updateAccount = async (req, res) => {
  const { id } = req.params;
  const { name, type, iban, color_code, balance } = req.body;
  try {
    const balanceValue = balance === undefined || balance === null || balance === '' ? null : Number(balance);
    const params = [name, type, iban || null, color_code || '#373392', balanceValue, id];
    const ownerFilter = appendOwnerFilter(req, params);
    const result = await pool.query(
      `UPDATE accounts SET name = $1, type = $2, iban = $3, color_code = $4, balance = COALESCE($5, balance), updated_at = CURRENT_TIMESTAMP WHERE id = $6${ownerFilter} RETURNING *`,
      params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Conta não encontrada.' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar conta:', error);
    res.status(500).json({ error: 'Erro ao atualizar conta.' });
  }
};

const deleteAccount = async (req, res) => {
  const { id } = req.params;
  try {
    const params = [id];
    const ownerFilter = appendOwnerFilter(req, params);
    const result = await pool.query(`DELETE FROM accounts WHERE id = $1${ownerFilter} RETURNING id`, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Conta não encontrada.' });
    res.json({ message: 'Conta eliminada com sucesso.' });
  } catch (error) {
    console.error('Erro ao eliminar conta:', error);
    res.status(500).json({ error: 'Erro ao eliminar conta.' });
  }
};

// --- DEBTS ---
const updateDebt = async (req, res) => {
  const { id } = req.params;
  const { person_name, type, amount, due_date, purpose } = req.body;
  try {
    const params = [person_name, type, Number(amount), due_date, purpose, id];
    const ownerFilter = appendOwnerFilter(req, params);
    const result = await pool.query(
      `UPDATE debts SET person_name = $1, type = $2, amount = $3, due_date = $4, purpose = $5 WHERE id = $6${ownerFilter} RETURNING *`,
      params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Dívida não encontrada.' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar dívida:', error);
    res.status(500).json({ error: 'Erro ao atualizar dívida.' });
  }
};

const deleteDebt = async (req, res) => {
  const { id } = req.params;
  try {
    const params = [id];
    const ownerFilter = appendOwnerFilter(req, params);
    const result = await pool.query(`DELETE FROM debts WHERE id = $1${ownerFilter} RETURNING id`, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Dívida não encontrada.' });
    res.json({ message: 'Dívida eliminada com sucesso.' });
  } catch (error) {
    console.error('Erro ao eliminar dívida:', error);
    res.status(500).json({ error: 'Erro ao eliminar dívida.' });
  }
};

// --- FIXED PAYMENTS ---
const updateFixedPayment = async (req, res) => {
  const { id } = req.params;
  const { name, amount, due_day, category } = req.body;
  try {
    const params = [name, Number(amount), Number(due_day), category, id];
    const ownerFilter = appendOwnerFilter(req, params);
    const result = await pool.query(
      `UPDATE fixed_payments SET name = $1, amount = $2, due_day = $3, category = $4 WHERE id = $5${ownerFilter} RETURNING *`,
      params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pagamento fixo não encontrado.' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar pagamento fixo:', error);
    res.status(500).json({ error: 'Erro ao atualizar pagamento fixo.' });
  }
};

const deleteFixedPayment = async (req, res) => {
  const { id } = req.params;
  try {
    const params = [id];
    const ownerFilter = appendOwnerFilter(req, params);
    const result = await pool.query(`DELETE FROM fixed_payments WHERE id = $1${ownerFilter} RETURNING id`, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pagamento fixo não encontrado.' });
    res.json({ message: 'Pagamento fixo eliminado com sucesso.' });
  } catch (error) {
    console.error('Erro ao eliminar pagamento fixo:', error);
    res.status(500).json({ error: 'Erro ao eliminar pagamento fixo.' });
  }
};

// --- PROJECTS ---
const updateProject = async (req, res) => {
  const { id } = req.params;
  const { name, category, target_amount, saved_amount, deadline } = req.body;
  try {
    const params = [name, category, Number(target_amount), Number(saved_amount || 0), deadline || null, id];
    const ownerFilter = appendOwnerFilter(req, params);
    const result = await pool.query(
      `UPDATE projects SET name = $1, category = $2, target_amount = $3, saved_amount = $4, deadline = $5 WHERE id = $6${ownerFilter} RETURNING *`,
      params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Projeto não encontrado.' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar projeto:', error);
    res.status(500).json({ error: 'Erro ao atualizar projeto.' });
  }
};

const deleteProject = async (req, res) => {
  const { id } = req.params;
  try {
    const params = [id];
    const ownerFilter = appendOwnerFilter(req, params);
    const result = await pool.query(`DELETE FROM projects WHERE id = $1${ownerFilter} RETURNING id`, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Projeto não encontrado.' });
    res.json({ message: 'Projeto eliminado com sucesso.' });
  } catch (error) {
    console.error('Erro ao eliminar projeto:', error);
    res.status(500).json({ error: 'Erro ao eliminar projeto.' });
  }
};

// --- KIXIKILAS ---
const updateKixikila = async (req, res) => {
  const { id } = req.params;
  const { name, periodicity, quota_value, hand_value, start_date } = req.body;
  try {
    const params = [name, periodicity, Number(quota_value), Number(hand_value), start_date || null, id];
    const ownerFilter = appendOwnerFilter(req, params);
    const result = await pool.query(
      `UPDATE kixikila_groups SET name = $1, periodicity = $2, quota_value = $3, hand_value = $4, start_date = $5 WHERE id = $6${ownerFilter} RETURNING *`,
      params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Kixikila não encontrada.' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar kixikila:', error);
    res.status(500).json({ error: 'Erro ao atualizar kixikila.' });
  }
};

const deleteKixikila = async (req, res) => {
  const { id } = req.params;
  try {
    const params = [id];
    const ownerFilter = appendOwnerFilter(req, params);
    const result = await pool.query(`DELETE FROM kixikila_groups WHERE id = $1${ownerFilter} RETURNING id`, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Kixikila não encontrada.' });
    res.json({ message: 'Kixikila eliminada com sucesso.' });
  } catch (error) {
    console.error('Erro ao eliminar kixikila:', error);
    res.status(500).json({ error: 'Erro ao eliminar kixikila.' });
  }
};


module.exports = {
  getUserFinances,
  createAccount, updateAccount, deleteAccount,
  createTransaction, updateTransaction, deleteTransaction,
  createDebt, updateDebt, deleteDebt,
  payDebt,
  createFixedPayment, updateFixedPayment, deleteFixedPayment,
  payFixedPayment,
  createKixikila, updateKixikila, deleteKixikila,
  receiveKixikilaHand,
  createProject, updateProject, deleteProject,
  fundProject,
  createForeignCurrency,
  getFinancialCalendar,
  getMonthEndForecast,
  getBudgets,
  upsertBudget,
  deleteBudget,
  getShoppingLists,
  createShoppingList,
  addShoppingListItem,
  updateShoppingListItem,
  deleteShoppingListItem,
  deleteShoppingList,
  uploadPaymentProof,
  getPaymentStatus
};
