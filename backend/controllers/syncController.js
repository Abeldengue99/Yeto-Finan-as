const pool = require('../config/database');
const financeController = require('./financeController');
const { hasActivePlanAccess } = require('../middleware/auth');

const MAX_SYNC_CHANGES = Number(process.env.SYNC_BATCH_LIMIT || 100);
const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

class SyncHttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function buildRoute(method, pattern, handler, options = {}) {
  return { method, pattern, handler, ...options };
}

const ALLOWED_ROUTES = [
  buildRoute('POST', /^\/api\/finances\/account$/, financeController.createAccount, { resource: 'account', table: 'accounts' }),
  buildRoute('PUT', new RegExp(`^/api/finances/account/(${UUID_PATTERN})$`, 'i'), financeController.updateAccount, { resource: 'account', table: 'accounts', params: ['id'] }),
  buildRoute('DELETE', new RegExp(`^/api/finances/account/(${UUID_PATTERN})$`, 'i'), financeController.deleteAccount, { resource: 'account', table: 'accounts', params: ['id'] }),

  buildRoute('POST', /^\/api\/finances\/transaction$/, financeController.createTransaction, { resource: 'transaction', table: 'transactions' }),
  buildRoute('PUT', new RegExp(`^/api/finances/transaction/(${UUID_PATTERN})$`, 'i'), financeController.updateTransaction, { resource: 'transaction', table: 'transactions', params: ['id'] }),
  buildRoute('DELETE', new RegExp(`^/api/finances/transaction/(${UUID_PATTERN})$`, 'i'), financeController.deleteTransaction, { resource: 'transaction', table: 'transactions', params: ['id'] }),

  buildRoute('POST', /^\/api\/finances\/debt$/, financeController.createDebt, { resource: 'debt', table: 'debts' }),
  buildRoute('PUT', new RegExp(`^/api/finances/debt/(${UUID_PATTERN})$`, 'i'), financeController.updateDebt, { resource: 'debt', table: 'debts', params: ['id'] }),
  buildRoute('DELETE', new RegExp(`^/api/finances/debt/(${UUID_PATTERN})$`, 'i'), financeController.deleteDebt, { resource: 'debt', table: 'debts', params: ['id'] }),
  buildRoute('PUT', new RegExp(`^/api/finances/debt/(${UUID_PATTERN})/pay$`, 'i'), financeController.payDebt, { resource: 'debt-payment', table: 'debts', params: ['id'] }),

  buildRoute('POST', /^\/api\/finances\/fixed-payment$/, financeController.createFixedPayment, { resource: 'fixed-payment', table: 'fixed_payments' }),
  buildRoute('PUT', new RegExp(`^/api/finances/fixed-payment/(${UUID_PATTERN})$`, 'i'), financeController.updateFixedPayment, { resource: 'fixed-payment', table: 'fixed_payments', params: ['id'] }),
  buildRoute('DELETE', new RegExp(`^/api/finances/fixed-payment/(${UUID_PATTERN})$`, 'i'), financeController.deleteFixedPayment, { resource: 'fixed-payment', table: 'fixed_payments', params: ['id'] }),
  buildRoute('PUT', new RegExp(`^/api/finances/fixed-payment/(${UUID_PATTERN})/pay$`, 'i'), financeController.payFixedPayment, { resource: 'fixed-payment-pay', table: 'fixed_payments', params: ['id'] }),

  buildRoute('POST', /^\/api\/finances\/budget$/, financeController.upsertBudget, { resource: 'budget', table: 'budgets', premium: true }),
  buildRoute('DELETE', new RegExp(`^/api/finances/budget/(${UUID_PATTERN})$`, 'i'), financeController.deleteBudget, { resource: 'budget', table: 'budgets', params: ['id'], premium: true }),

  buildRoute('POST', /^\/api\/finances\/shopping-list$/, financeController.createShoppingList, { resource: 'shopping-list', table: 'shopping_lists', premium: true }),
  buildRoute('DELETE', new RegExp(`^/api/finances/shopping-list/(${UUID_PATTERN})$`, 'i'), financeController.deleteShoppingList, { resource: 'shopping-list', table: 'shopping_lists', params: ['id'], premium: true }),
  buildRoute('POST', new RegExp(`^/api/finances/shopping-list/(${UUID_PATTERN})/item$`, 'i'), financeController.addShoppingListItem, { resource: 'shopping-list-item', table: 'shopping_list_items', params: ['listId'], premium: true }),
  buildRoute('PUT', new RegExp(`^/api/finances/shopping-list-item/(${UUID_PATTERN})$`, 'i'), financeController.updateShoppingListItem, { resource: 'shopping-list-item', table: 'shopping_list_items', params: ['id'], premium: true }),
  buildRoute('DELETE', new RegExp(`^/api/finances/shopping-list-item/(${UUID_PATTERN})$`, 'i'), financeController.deleteShoppingListItem, { resource: 'shopping-list-item', table: 'shopping_list_items', params: ['id'], premium: true }),

  buildRoute('POST', /^\/api\/finances\/project$/, financeController.createProject, { resource: 'project', table: 'projects', premium: true }),
  buildRoute('PUT', new RegExp(`^/api/finances/project/(${UUID_PATTERN})$`, 'i'), financeController.updateProject, { resource: 'project', table: 'projects', params: ['id'], premium: true }),
  buildRoute('DELETE', new RegExp(`^/api/finances/project/(${UUID_PATTERN})$`, 'i'), financeController.deleteProject, { resource: 'project', table: 'projects', params: ['id'], premium: true }),
  buildRoute('PUT', new RegExp(`^/api/finances/project/(${UUID_PATTERN})/fund$`, 'i'), financeController.fundProject, { resource: 'project-fund', table: 'projects', params: ['id'], premium: true }),

  buildRoute('POST', /^\/api\/finances\/kixikila$/, financeController.createKixikila, { resource: 'kixikila', table: 'kixikila_groups', premium: true }),
  buildRoute('PUT', new RegExp(`^/api/finances/kixikila/(${UUID_PATTERN})$`, 'i'), financeController.updateKixikila, { resource: 'kixikila', table: 'kixikila_groups', params: ['id'], premium: true }),
  buildRoute('DELETE', new RegExp(`^/api/finances/kixikila/(${UUID_PATTERN})$`, 'i'), financeController.deleteKixikila, { resource: 'kixikila', table: 'kixikila_groups', params: ['id'], premium: true }),
  buildRoute('PUT', new RegExp(`^/api/finances/kixikila/(${UUID_PATTERN})/pay$`, 'i'), financeController.receiveKixikilaHand, { resource: 'kixikila-pay', table: 'kixikila_groups', params: ['id'], premium: true }),

  buildRoute('POST', /^\/api\/finances\/currency$/, financeController.createForeignCurrency, { resource: 'currency', table: 'foreign_currency', premium: true })
];

function normalizePath(path) {
  const cleanPath = String(path || '').trim();
  if (!cleanPath.startsWith('/api/finances/')) {
    throw new SyncHttpError(400, 'Operação offline não autorizada.');
  }

  return cleanPath.split('?')[0];
}

function replaceOfflineRefs(value, idMap) {
  if (!value || Object.keys(idMap).length === 0) return value;

  if (typeof value === 'string') {
    return idMap[value] || value;
  }

  if (Array.isArray(value)) {
    return value.map(item => replaceOfflineRefs(item, idMap));
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replaceOfflineRefs(item, idMap)])
    );
  }

  return value;
}

function resolvePath(path, idMap) {
  return Object.entries(idMap).reduce(
    (resolved, [temporaryId, realId]) => resolved.replaceAll(temporaryId, String(realId)),
    path
  );
}

function matchRoute(method, path) {
  const cleanMethod = String(method || 'POST').toUpperCase();

  for (const route of ALLOWED_ROUTES) {
    if (route.method !== cleanMethod) continue;

    const match = path.match(route.pattern);
    if (!match) continue;

    const params = {};
    (route.params || []).forEach((name, index) => {
      params[name] = match[index + 1];
    });

    return { ...route, params };
  }

  throw new SyncHttpError(400, 'Operação offline não suportada pelo servidor.');
}

function createResponseCollector() {
  let statusCode = 200;
  let payload = null;

  return {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      payload = data;
      return this;
    },
    send(data) {
      payload = data;
      return this;
    },
    getStatusCode() {
      return statusCode;
    },
    getPayload() {
      return payload;
    }
  };
}

async function logSyncEvent({ req, deviceId, operation, resource, path, method, status, errorMessage }) {
  try {
    await pool.query(
      `INSERT INTO sync_events (user_id, device_id, operation_id, resource, method, path, status, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        req.user.id,
        deviceId || null,
        operation.id || operation.localId || null,
        resource || operation.resource || null,
        method,
        path,
        status,
        errorMessage || null
      ]
    );
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Tabela de histórico de sync ainda não disponível:', error.message);
    }
  }
}

async function stampSyncedRow({ table, rowId, req, deviceId, operation }) {
  if (!table || !rowId || String(rowId).startsWith('offline_')) return;

  const syncId = operation.localId || operation.id || null;
  const ownerFilter = req.user?.plan_type === 'admin' ? '' : ' AND user_id = $4';
  const params = req.user?.plan_type === 'admin'
    ? [syncId, deviceId || null, rowId]
    : [syncId, deviceId || null, rowId, req.user.id];

  try {
    await pool.query(
      `UPDATE ${table}
       SET sync_id = COALESCE(sync_id, $1), device_id = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3${ownerFilter}`,
      params
    );
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Metadados de sync ainda não disponíveis:', error.message);
    }
  }
}

async function executeChange({ req, operation, deviceId, idMap }) {
  const method = String(operation.method || 'POST').toUpperCase();
  const path = normalizePath(resolvePath(operation.path, idMap));
  const body = replaceOfflineRefs(operation.body || {}, idMap);
  const route = matchRoute(method, path);

  if (route.premium && !hasActivePlanAccess(req.user)) {
    throw new SyncHttpError(402, 'O plano expirou. Renove para sincronizar esta funcionalidade Premium.');
  }

  const safeBody = {
    ...body,
    ...(req.user?.plan_type === 'admin' ? {} : { userId: req.user.id })
  };
  const syncReq = {
    ...req,
    params: route.params,
    body: safeBody,
    query: {},
    user: req.user
  };
  const syncRes = createResponseCollector();

  await route.handler(syncReq, syncRes);

  const statusCode = syncRes.getStatusCode();
  const payload = syncRes.getPayload() || {};

  if (statusCode >= 400) {
    throw new SyncHttpError(statusCode, payload.error || 'Falha ao sincronizar operação offline.');
  }

  if (operation.localId && payload.id) {
    idMap[operation.localId] = payload.id;
  }

  const rowId = payload.id || route.params.id;
  if (method !== 'DELETE') {
    await stampSyncedRow({ table: route.table, rowId, req, deviceId, operation });
  }

  await logSyncEvent({
    req,
    deviceId,
    operation,
    resource: route.resource,
    path,
    method,
    status: 'synced'
  });

  return {
    id: operation.id || null,
    localId: operation.localId || null,
    resource: route.resource,
    status: 'synced',
    data: payload
  };
}

const pushSyncBatch = async (req, res) => {
  const { deviceId, changes } = req.body || {};

  if (!Array.isArray(changes)) {
    return res.status(400).json({ error: 'Envie uma lista de alterações para sincronizar.' });
  }

  if (changes.length > MAX_SYNC_CHANGES) {
    return res.status(413).json({ error: `Sincronize no máximo ${MAX_SYNC_CHANGES} alterações de cada vez.` });
  }

  const idMap = {};
  const results = [];

  for (let index = 0; index < changes.length; index += 1) {
    const operation = changes[index] || {};

    try {
      const result = await executeChange({ req, operation, deviceId, idMap });
      results.push(result);
    } catch (error) {
      const statusCode = error.statusCode || 500;
      const path = String(operation.path || '');
      const method = String(operation.method || 'POST').toUpperCase();

      await logSyncEvent({
        req,
        deviceId,
        operation,
        resource: operation.resource,
        path,
        method,
        status: 'failed',
        errorMessage: error.message
      });

      return res.status(207).json({
        ok: false,
        syncedCount: results.length,
        failedAt: index,
        idMap,
        results,
        error: {
          statusCode,
          message: error.message || 'Falha ao sincronizar alterações offline.'
        }
      });
    }
  }

  return res.json({
    ok: true,
    syncedCount: results.length,
    failedAt: null,
    idMap,
    results
  });
};

const getSyncHistory = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, device_id, operation_id, resource, method, path, status, error_message, created_at
       FROM sync_events
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id]
    );

    return res.json({ history: result.rows });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Histórico de sync indisponível:', error.message);
    }

    return res.json({ history: [] });
  }
};

module.exports = {
  getSyncHistory,
  pushSyncBatch
};
