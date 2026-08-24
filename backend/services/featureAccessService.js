const pool = require('../config/database');

const FEATURE_CATALOG = [
  {
    key: 'orcamento',
    label: 'Orçamento Familiar',
    description: 'Definir limites por categoria e acompanhar gastos do mês.',
    monthlyPrice: 900,
    tab: 'orcamento',
    dependencyNote: 'Lê transações e categorias já registadas.'
  },
  {
    key: 'calendario',
    label: 'Calendário Financeiro',
    description: 'Ver salários, contas fixas, dívidas, kixikila e metas no mês.',
    monthlyPrice: 1000,
    tab: 'calendario',
    dependencyNote: 'Lê contas fixas, dívidas, kixikila, projetos e movimentos.'
  },
  {
    key: 'lista_compras',
    label: 'Lista de Compras com Orçamento',
    description: 'Criar listas e comparar a compra prevista com o orçamento.',
    monthlyPrice: 900,
    tab: 'lista_compras',
    dependencyNote: 'Pode ler limites do Orçamento Familiar quando existirem.'
  },
  {
    key: 'previsao',
    label: 'Previsão do Fim do Mês',
    description: 'Estimar saldo final e acionar Modo Emergência quando necessário.',
    monthlyPrice: 1500,
    tab: 'previsao',
    dependencyNote: 'Lê saldo, transações, contas fixas, dívidas e compromissos.'
  },
  {
    key: 'projetos',
    label: 'Projetos e Metas',
    description: 'Organizar objetivos familiares e acompanhar poupanças.',
    monthlyPrice: 800,
    tab: 'projetos',
    dependencyNote: 'Usa contas e movimentos para financiar metas.'
  },
  {
    key: 'divisas',
    label: 'Câmbio e Divisas',
    description: 'Controlar moeda estrangeira, compras e conversões.',
    monthlyPrice: 800,
    tab: 'divisas',
    dependencyNote: 'Usa contas para registar saídas e entradas.'
  },
  {
    key: 'kixikila',
    label: 'Kixikila',
    description: 'Gerir grupos, contribuições, mãos e calendário de recebimentos.',
    monthlyPrice: 900,
    tab: 'kixikila',
    dependencyNote: 'Pode aparecer no Calendário Financeiro quando houver acesso.'
  },
  {
    key: 'gamificacao',
    label: 'Desafios Familiares',
    description: 'Ganhar YetoPoints e trocar conquistas por benefícios.',
    monthlyPrice: 700,
    tab: 'gamificacao',
    dependencyNote: 'Lê atividades financeiras para validar missões.'
  },
  {
    key: 'yeto_ai',
    label: 'Yeto AI',
    description: 'Conselheiro financeiro com leituras inteligentes e análise profunda.',
    monthlyPrice: 1200,
    tab: 'dashboard',
    dependencyNote: 'Lê receitas, despesas, dívidas, projetos e compromissos para gerar conselhos.'
  },
  {
    key: 'relatorios_pdf',
    label: 'Relatórios PDF',
    description: 'Gerar relatórios profissionais para análise familiar.',
    monthlyPrice: 1000,
    tab: 'dashboard',
    dependencyNote: 'Lê dados financeiros já registados para gerar o documento.'
  }
];

const FEATURE_KEYS = new Set(FEATURE_CATALOG.map(feature => feature.key));
const DURATION_DISCOUNTS = {
  1: 0,
  6: 0.1,
  12: 0.2
};

let schemaReady = false;

function normalizeDurationMonths(value) {
  const duration = Number(value);
  return [1, 6, 12].includes(duration) ? duration : 1;
}

function normalizeFeatureKeys(featureKeys = []) {
  const source = Array.isArray(featureKeys) ? featureKeys : [];
  return [...new Set(source.map(key => String(key || '').trim()).filter(key => FEATURE_KEYS.has(key)))];
}

function calculateCustomPlanAmount(featureKeys = [], durationMonths = 1) {
  const cleanKeys = normalizeFeatureKeys(featureKeys);
  const months = normalizeDurationMonths(durationMonths);
  const monthlyTotal = cleanKeys.reduce((sum, key) => {
    const feature = FEATURE_CATALOG.find(item => item.key === key);
    return sum + Number(feature?.monthlyPrice || 0);
  }, 0);
  const discount = DURATION_DISCOUNTS[months] || 0;

  return Math.max(0, Math.round(monthlyTotal * months * (1 - discount)));
}

async function ensureFeatureAccessSchema(db = pool) {
  if (schemaReady) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_feature_access (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      feature_key VARCHAR(80) NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      source VARCHAR(80) DEFAULT 'custom_plan',
      payment_id UUID REFERENCES payment_approvals(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      PRIMARY KEY (user_id, feature_key)
    )
  `);
  await db.query('CREATE INDEX IF NOT EXISTS idx_user_feature_access_expires ON user_feature_access(user_id, expires_at)');
  await db.query("ALTER TABLE payment_approvals ADD COLUMN IF NOT EXISTS selected_features JSONB NOT NULL DEFAULT '[]'::jsonb");
  await db.query('ALTER TABLE payment_approvals ADD COLUMN IF NOT EXISTS custom_amount INTEGER DEFAULT 0');
  await db.query('ALTER TABLE payment_approvals ADD COLUMN IF NOT EXISTS custom_duration_months INTEGER DEFAULT 0');

  schemaReady = true;
}

async function getActiveFeatureKeys(userId, db = pool) {
  if (!userId) return [];
  await ensureFeatureAccessSchema(db);

  const result = await db.query(
    `SELECT feature_key
     FROM user_feature_access
     WHERE user_id = $1
       AND expires_at > NOW()
     ORDER BY feature_key`,
    [userId]
  );

  return result.rows.map(row => row.feature_key);
}

async function grantFeatureAccess({ userId, featureKeys, durationMonths = 1, paymentId = null }, db = pool) {
  const cleanKeys = normalizeFeatureKeys(featureKeys);
  const months = normalizeDurationMonths(durationMonths);
  if (cleanKeys.length === 0) return [];

  await ensureFeatureAccessSchema(db);

  for (const key of cleanKeys) {
    await db.query(
      `INSERT INTO user_feature_access (user_id, feature_key, expires_at, source, payment_id, created_at, updated_at)
       VALUES ($1, $2, NOW() + ($3::int * INTERVAL '1 month'), 'custom_plan', $4, NOW(), NOW())
       ON CONFLICT (user_id, feature_key)
       DO UPDATE SET
         expires_at = GREATEST(user_feature_access.expires_at, NOW()) + ($3::int * INTERVAL '1 month'),
         payment_id = EXCLUDED.payment_id,
         source = 'custom_plan',
         updated_at = NOW()`,
      [userId, key, months, paymentId]
    );
  }

  return getActiveFeatureKeys(userId, db);
}

function isFullPlanUser(user) {
  if (user?.plan_type === 'admin') return true;
  if (user?.plan_type !== 'premium') return false;
  return ['semestral', 'anual', 'premium'].includes(user?.subscription_plan);
}

module.exports = {
  FEATURE_CATALOG,
  calculateCustomPlanAmount,
  ensureFeatureAccessSchema,
  getActiveFeatureKeys,
  grantFeatureAccess,
  isFullPlanUser,
  normalizeDurationMonths,
  normalizeFeatureKeys
};
