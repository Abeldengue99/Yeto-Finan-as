const pool = require('./config/database');
const { signSession } = require('./middleware/auth');

const API_BASE_URL = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

const featureRoutes = [
  {
    name: 'Orçamento Familiar',
    path: userId => `/api/finances/${userId}/budgets`
  },
  {
    name: 'Calendário Financeiro',
    path: userId => `/api/finances/${userId}/calendar`
  },
  {
    name: 'Previsão & Emergência',
    path: userId => `/api/finances/${userId}/forecast`
  },
  {
    name: 'Lista de Compras',
    path: userId => `/api/finances/${userId}/shopping-lists`
  },
  {
    name: 'Assistente',
    path: () => '/api/assistant/conversations'
  }
];

async function getTestUser() {
  const admin = await pool.query(
    `SELECT id, email, plan_type
     FROM users
     WHERE plan_type = 'admin'
     ORDER BY created_at DESC
     LIMIT 1`
  );

  if (admin.rows[0]) return admin.rows[0];

  const regular = await pool.query(
    `SELECT id, email, plan_type
     FROM users
     ORDER BY created_at DESC
     LIMIT 1`
  );

  return regular.rows[0] || null;
}

async function requestRoute(route, token, userId) {
  const response = await fetch(`${API_BASE_URL}${route.path(userId)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const text = await response.text();
  let body;

  try {
    body = JSON.parse(text);
  } catch (error) {
    body = { raw: text };
  }

  return {
    name: route.name,
    status: response.status,
    ok: response.status !== 404,
    error: body?.error || ''
  };
}

async function main() {
  const user = await getTestUser();
  if (!user) {
    throw new Error('Não existe nenhum utilizador para testar as rotas.');
  }

  const token = signSession(user);
  const results = await Promise.all(featureRoutes.map(route => requestRoute(route, token, user.id)));
  const missing = results.filter(result => !result.ok);

  console.log(JSON.stringify(results, null, 2));

  if (missing.length > 0) {
    throw new Error(`Rotas não encontradas: ${missing.map(item => item.name).join(', ')}`);
  }
}

main()
  .catch(error => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
