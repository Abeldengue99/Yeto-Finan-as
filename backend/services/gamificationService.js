const pool = require('../config/database');
const { createUserNotification } = require('./notificationService');

const PREMIUM_REWARD_COST = 2000;
const PREMIUM_REWARD_DAYS = 30;

let schemaReady = false;

const LEVELS = [
  { name: 'Primeiros Passos', min: 0, next: 500 },
  { name: 'Guardiões do Orçamento', min: 500, next: 1500 },
  { name: 'Mestres da Poupança', min: 1500, next: 3000 },
  { name: 'Reis do Kwanza', min: 3000, next: null }
];

function getMonthKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 7);
  return date.toISOString().slice(0, 7);
}

function getCurrentLevel(points) {
  const total = Number(points || 0);
  return [...LEVELS].reverse().find(level => total >= level.min) || LEVELS[0];
}

async function ensureGamificationSchema(db = pool) {
  if (schemaReady) return;

  await db.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS yeto_points INTEGER DEFAULT 0');
  await db.query(`
    CREATE TABLE IF NOT EXISTS gamification_events (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action_key VARCHAR(100) NOT NULL,
      source_type VARCHAR(80),
      source_id VARCHAR(120),
      period_key VARCHAR(20),
      points INTEGER NOT NULL,
      title VARCHAR(180) NOT NULL,
      description TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  await db.query('CREATE INDEX IF NOT EXISTS idx_gamification_events_user_created ON gamification_events(user_id, created_at DESC)');
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_gamification_events_source_once
    ON gamification_events(user_id, action_key, source_type, source_id)
    WHERE source_id IS NOT NULL
  `);
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_gamification_events_period_once
    ON gamification_events(user_id, action_key, period_key)
    WHERE source_id IS NULL AND period_key IS NOT NULL
  `);
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_gamification_events_action_once
    ON gamification_events(user_id, action_key)
    WHERE source_id IS NULL AND period_key IS NULL
  `);

  schemaReady = true;
}

async function getClaimedMap(userId, db = pool) {
  const result = await db.query(
    `SELECT action_key, source_type, source_id, period_key
     FROM gamification_events
     WHERE user_id = $1 AND points > 0`,
    [userId]
  );

  return result.rows.reduce((acc, event) => {
    acc.add(buildClaimKey(event.action_key, event.source_type, event.source_id, event.period_key));
    return acc;
  }, new Set());
}

function buildClaimKey(actionKey, sourceType = null, sourceId = null, periodKey = null) {
  return [actionKey || '', sourceType || '', sourceId || '', periodKey || ''].join('|');
}

function mapChallenge({ key, title, description, points, progress, target, icon, periodKey = null, sourceType = null, sourceId = null }, claimedMap) {
  const numericProgress = Number(progress || 0);
  const numericTarget = Math.max(1, Number(target || 1));
  const completed = numericProgress >= numericTarget;
  const claimed = claimedMap.has(buildClaimKey(key, sourceType, sourceId, periodKey));

  return {
    id: sourceId ? `${key}:${sourceId}` : key,
    key,
    titulo: title,
    descricao: description,
    recompensa: points,
    progresso: Math.min(numericProgress, numericTarget),
    meta: numericTarget,
    icone: icon,
    completed,
    claimed,
    canClaim: completed && !claimed,
    periodKey,
    sourceType,
    sourceId
  };
}

async function buildChallenges(userId, monthKey, db = pool) {
  const claimedMap = await getClaimedMap(userId, db);
  const monthStart = `${monthKey}-01`;
  const nextMonth = new Date(`${monthStart}T00:00:00Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const nextMonthKey = nextMonth.toISOString().slice(0, 10);

  const [
    accountsRes,
    incomeRes,
    expenseRes,
    budgetRes,
    shoppingRes,
    fixedPaidRes,
    debtPaidRes,
    projectRes,
    activeDaysRes
  ] = await Promise.all([
    db.query('SELECT COUNT(*)::int AS total FROM accounts WHERE user_id = $1 AND deleted_at IS NULL', [userId]),
    db.query("SELECT COUNT(*)::int AS total FROM transactions WHERE user_id = $1 AND deleted_at IS NULL AND type = 'income'", [userId]),
    db.query("SELECT COUNT(*)::int AS total FROM transactions WHERE user_id = $1 AND deleted_at IS NULL AND type = 'expense'", [userId]),
    db.query('SELECT COUNT(*)::int AS total FROM budgets WHERE user_id = $1 AND deleted_at IS NULL AND month_key = $2', [userId, monthKey]),
    db.query('SELECT COUNT(*)::int AS total FROM shopping_lists WHERE user_id = $1 AND deleted_at IS NULL AND month_key = $2', [userId, monthKey]),
    db.query('SELECT COUNT(*)::int AS total FROM fixed_payments WHERE user_id = $1 AND deleted_at IS NULL AND is_paid_this_month = true', [userId]),
    db.query('SELECT COUNT(*)::int AS total FROM debts WHERE user_id = $1 AND deleted_at IS NULL AND is_paid = true', [userId]),
    db.query(
      `SELECT id, name, target_amount, saved_amount
       FROM projects
       WHERE user_id = $1
         AND deleted_at IS NULL
         AND target_amount > 0
         AND saved_amount >= target_amount
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 5`,
      [userId]
    ),
    db.query(
      `SELECT COUNT(DISTINCT transaction_date)::int AS total
       FROM transactions
       WHERE user_id = $1
         AND deleted_at IS NULL
         AND transaction_date >= $2::date
         AND transaction_date < $3::date`,
      [userId, monthStart, nextMonthKey]
    )
  ]);

  const baseChallenges = [
    mapChallenge({
      key: 'first_account',
      title: 'Primeira conta organizada',
      description: 'Crie pelo menos uma conta ou carteira para acompanhar o dinheiro da família.',
      points: 50,
      progress: accountsRes.rows[0]?.total,
      target: 1,
      icon: '🏦'
    }, claimedMap),
    mapChallenge({
      key: 'first_income',
      title: 'Primeira receita registada',
      description: 'Registe uma entrada de dinheiro para começar a medir o saldo real.',
      points: 40,
      progress: incomeRes.rows[0]?.total,
      target: 1,
      icon: '💰'
    }, claimedMap),
    mapChallenge({
      key: 'first_expense',
      title: 'Despesa com categoria',
      description: 'Registe uma despesa com categoria para perceber para onde o dinheiro vai.',
      points: 40,
      progress: expenseRes.rows[0]?.total,
      target: 1,
      icon: '🧾'
    }, claimedMap),
    mapChallenge({
      key: 'budget_month',
      title: 'Orçamento do mês definido',
      description: 'Defina pelo menos um limite mensal para controlar gastos antes do aperto.',
      points: 100,
      progress: budgetRes.rows[0]?.total,
      target: 1,
      icon: '📋',
      periodKey: monthKey
    }, claimedMap),
    mapChallenge({
      key: 'shopping_list_month',
      title: 'Compra planeada',
      description: 'Crie uma lista de compras para comparar o mercado com o orçamento.',
      points: 120,
      progress: shoppingRes.rows[0]?.total,
      target: 1,
      icon: '🛒',
      periodKey: monthKey
    }, claimedMap),
    mapChallenge({
      key: 'fixed_payment_month',
      title: 'Conta fixa em dia',
      description: 'Marque pelo menos uma conta fixa como paga neste mês.',
      points: 100,
      progress: fixedPaidRes.rows[0]?.total,
      target: 1,
      icon: '📅',
      periodKey: monthKey
    }, claimedMap),
    mapChallenge({
      key: 'debt_paid',
      title: 'Dívida liquidada',
      description: 'Quite uma dívida e reduza o peso financeiro da família.',
      points: 120,
      progress: debtPaidRes.rows[0]?.total,
      target: 1,
      icon: '✅'
    }, claimedMap),
    mapChallenge({
      key: 'active_days_month',
      title: '7 dias de disciplina',
      description: 'Registe movimentos em 7 dias diferentes no mês.',
      points: 200,
      progress: activeDaysRes.rows[0]?.total,
      target: 7,
      icon: '🔥',
      periodKey: monthKey
    }, claimedMap)
  ];

  const projectChallenges = projectRes.rows.map(project => mapChallenge({
    key: 'project_completed',
    title: `Meta concluída: ${project.name}`,
    description: 'Parabéns, esta meta financeira já atingiu o valor definido.',
    points: 300,
    progress: Number(project.saved_amount || 0),
    target: Number(project.target_amount || 1),
    icon: '🎯',
    sourceType: 'project',
    sourceId: String(project.id)
  }, claimedMap));

  return [...baseChallenges, ...projectChallenges].sort((a, b) => {
    if (a.canClaim && !b.canClaim) return -1;
    if (b.canClaim && !a.canClaim) return 1;
    if (a.completed && !b.completed) return -1;
    if (b.completed && !a.completed) return 1;
    return b.recompensa - a.recompensa;
  });
}

async function awardPoints({ userId, actionKey, points, title, description = '', sourceType = null, sourceId = null, periodKey = null }, db = pool) {
  await ensureGamificationSchema(db);

  const claimKey = buildClaimKey(actionKey, sourceType, sourceId, periodKey);
  const duplicateRes = await db.query(
    `SELECT id
     FROM gamification_events
     WHERE user_id = $1
       AND action_key = $2
       AND COALESCE(source_type, '') = $3
       AND COALESCE(source_id, '') = $4
       AND COALESCE(period_key, '') = $5
     LIMIT 1`,
    [userId, actionKey, sourceType || '', sourceId || '', periodKey || '']
  );

  if (duplicateRes.rows.length > 0) {
    return { awarded: false, claimKey };
  }

  await db.query(
    `INSERT INTO gamification_events (user_id, action_key, source_type, source_id, period_key, points, title, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [userId, actionKey, sourceType, sourceId, periodKey, points, title, description]
  );

  const userRes = await db.query(
    `UPDATE users
     SET yeto_points = GREATEST(0, COALESCE(yeto_points, 0) + $1)
     WHERE id = $2
     RETURNING id, yeto_points, plan_type, subscription_plan, plan_expires_at`,
    [points, userId]
  );

  if (points > 0) {
    await createUserNotification({
      userId,
      title: 'YetoPoints ganhos',
      message: `Ganhou ${points} YetoPoints: ${title}.`,
      tab: 'gamificacao',
      type: 'success'
    }, db).catch(() => null);
  }

  return {
    awarded: true,
    claimKey,
    user: userRes.rows[0] || null
  };
}

async function getGamificationSummary(userId, db = pool) {
  await ensureGamificationSchema(db);

  const monthKey = getMonthKey();
  const [userRes, historyRes] = await Promise.all([
    db.query('SELECT id, COALESCE(yeto_points, 0)::int AS yeto_points FROM users WHERE id = $1', [userId]),
    db.query(
      `SELECT id, action_key, points, title, description, created_at
       FROM gamification_events
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId]
    )
  ]);

  const points = Number(userRes.rows[0]?.yeto_points || 0);
  const currentLevel = getCurrentLevel(points);
  const challenges = await buildChallenges(userId, monthKey, db);
  const history = historyRes.rows.map(item => ({
    id: item.id,
    actionKey: item.action_key,
    points: Number(item.points || 0),
    title: item.title,
    description: item.description,
    createdAt: item.created_at
  }));

  const claimedActions = new Set(history.map(item => item.actionKey));
  const completedChallenges = challenges.filter(item => item.completed || item.claimed).length;

  return {
    month: monthKey,
    yetoPoints: points,
    nivelAtual: currentLevel.name,
    nextLevelPoints: currentLevel.next,
    challenges,
    achievements: [
      { id: 'started', titulo: 'Primeiro Passo', descricao: 'Começou a organizar a vida financeira no Yeto.', desbloqueada: true, icone: '🌱' },
      { id: 'budget', titulo: 'Guardião do Orçamento', descricao: 'Definiu orçamento mensal.', desbloqueada: claimedActions.has('budget_month'), icone: '📋' },
      { id: 'shopping', titulo: 'Compra Inteligente', descricao: 'Planeou compras antes de gastar.', desbloqueada: claimedActions.has('shopping_list_month'), icone: '🛒' },
      { id: 'premium_reward', titulo: 'Premium por Mérito', descricao: 'Resgatou Premium com YetoPoints.', desbloqueada: claimedActions.has('redeem_premium_month'), icone: '💎' },
      { id: 'discipline', titulo: 'Disciplina Familiar', descricao: 'Concluiu várias missões financeiras.', desbloqueada: completedChallenges >= 5, icone: '🏆' }
    ],
    rewards: [
      {
        id: 'premium_month',
        title: '1 mês Premium',
        description: 'Acesso total ao sistema por 30 dias.',
        cost: PREMIUM_REWARD_COST,
        days: PREMIUM_REWARD_DAYS,
        canRedeem: points >= PREMIUM_REWARD_COST
      }
    ],
    history
  };
}

async function claimChallenge({ userId, challengeKey, sourceId = null }) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await ensureGamificationSchema(client);

    const monthKey = getMonthKey();
    const challenges = await buildChallenges(userId, monthKey, client);
    const challenge = challenges.find(item => (
      item.key === challengeKey &&
      String(item.sourceId || '') === String(sourceId || '')
    ));

    if (!challenge) {
      throw new Error('Missão não encontrada.');
    }

    if (!challenge.completed) {
      throw new Error('A missão ainda não foi concluída.');
    }

    if (challenge.claimed) {
      throw new Error('Os pontos desta missão já foram resgatados.');
    }

    const award = await awardPoints({
      userId,
      actionKey: challenge.key,
      points: challenge.recompensa,
      title: challenge.titulo,
      description: challenge.descricao,
      sourceType: challenge.sourceType,
      sourceId: challenge.sourceId,
      periodKey: challenge.periodKey
    }, client);

    await client.query('COMMIT');

    return {
      award,
      message: `Ganhou ${challenge.recompensa} YetoPoints.`,
      summary: await getGamificationSummary(userId)
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function redeemPremiumMonth(userId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await ensureGamificationSchema(client);

    const userRes = await client.query(
      `SELECT id, COALESCE(yeto_points, 0)::int AS yeto_points, plan_type, plan_expires_at
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      throw new Error('Utilizador não encontrado.');
    }

    const user = userRes.rows[0];

    if (user.plan_type === 'admin') {
      throw new Error('Conta administrativa não precisa de resgate Premium.');
    }

    if (Number(user.yeto_points || 0) < PREMIUM_REWARD_COST) {
      throw new Error(`Pontos insuficientes. São necessários ${PREMIUM_REWARD_COST} YetoPoints.`);
    }

    await client.query(
      `INSERT INTO gamification_events (user_id, action_key, points, title, description)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        'redeem_premium_month',
        -PREMIUM_REWARD_COST,
        'Resgate de 1 mês Premium',
        'Troca de YetoPoints por 30 dias de acesso Premium.'
      ]
    );

    const updatedUserRes = await client.query(
      `UPDATE users
       SET yeto_points = GREATEST(0, COALESCE(yeto_points, 0) - $1),
           plan_type = 'premium',
           subscription_plan = 'anual',
           plan_expires_at = GREATEST(NOW()::timestamp, COALESCE(plan_expires_at, NOW()::timestamp)) + ($2::text || ' days')::interval,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, yeto_points, plan_type, subscription_plan, plan_expires_at`,
      [PREMIUM_REWARD_COST, PREMIUM_REWARD_DAYS, userId]
    );

    await createUserNotification({
      userId,
      title: 'Premium ativado com YetoPoints',
      message: 'O seu resgate foi concluído. Ganhou 30 dias de acesso Premium.',
      tab: 'gamificacao',
      type: 'success'
    }, client).catch(() => null);

    await client.query('COMMIT');

    return {
      user: updatedUserRes.rows[0],
      message: 'Plano Premium ativado por 30 dias com YetoPoints.',
      summary: await getGamificationSummary(userId)
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  PREMIUM_REWARD_COST,
  PREMIUM_REWARD_DAYS,
  ensureGamificationSchema,
  getGamificationSummary,
  claimChallenge,
  redeemPremiumMonth,
  awardPoints
};
