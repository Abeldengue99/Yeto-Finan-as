const crypto = require('crypto');
const pool = require('../config/database');

const TOKEN_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS || 2 * 60 * 60);
const FALLBACK_SECRET = 'dev-only-yeto-session-secret-change-before-production';
const FALLBACK_ADMIN_ID = '00000000-0000-0000-0000-000000000000';
const ADMIN_PERMISSION_KEYS = ['dashboard', 'users', 'payments', 'assistant', 'reports', 'settings', 'marketing'];

function getFullAdminPermissions() {
  return ADMIN_PERMISSION_KEYS.reduce((acc, key) => {
    acc[key] = true;
    return acc;
  }, { all: true });
}

function hasFullAdminAccess(user) {
  if (user?.plan_type !== 'admin') return false;
  if (user.id === FALLBACK_ADMIN_ID) return true;
  const permissions = user.admin_permissions || {};
  return Boolean(permissions.all || permissions.all_access);
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET || process.env.JWT_SECRET || process.env.DB_PASSWORD || FALLBACK_SECRET;

  if (process.env.NODE_ENV === 'production' && secret.length < 32) {
    throw new Error('SESSION_SECRET deve ter pelo menos 32 caracteres em produção.');
  }

  return secret;
}

function base64UrlEncode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signPayload(unsignedToken) {
  return crypto
    .createHmac('sha256', getSessionSecret())
    .update(unsignedToken)
    .digest('base64url');
}

function signSession(user) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.plan_type,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS
  };
  const unsignedToken = `${base64UrlEncode(header)}.${base64UrlEncode(payload)}`;

  return `${unsignedToken}.${signPayload(unsignedToken)}`;
}

function parseToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const expectedSignature = signPayload(`${header}.${payload}`);
  const received = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.sub || !data.exp || data.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return data;
  } catch (error) {
    return null;
  }
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice('Bearer '.length).trim();
}

function getEffectiveExpiry(user) {
  if (!user || user.plan_type === 'admin') return null;
  if (user.plan_expires_at) return new Date(user.plan_expires_at);

  if (user.plan_type === 'free' && user.created_at) {
    const createdAt = new Date(user.created_at);
    if (!Number.isNaN(createdAt.getTime())) {
      return new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    }
  }

  return null;
}

function hasActivePlanAccess(user) {
  if (user?.plan_type === 'admin') return true;
  const expiresAt = getEffectiveExpiry(user);
  return Boolean(expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt > new Date());
}

function isActiveFreeTrial(user) {
  if (user?.plan_type !== 'free') return false;
  const expiresAt = getEffectiveExpiry(user);
  return Boolean(expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt > new Date());
}

function hasAnnualFeatureAccess(user) {
  if (user?.plan_type === 'admin') return true;
  if (isActiveFreeTrial(user)) return true;
  if (!hasActivePlanAccess(user)) return false;
  return user?.subscription_plan === 'anual';
}

async function getAdminPermissionsForUser(user) {
  if (user?.plan_type !== 'admin') return {};
  if (user.id === FALLBACK_ADMIN_ID) return getFullAdminPermissions();

  try {
    const result = await pool.query(
      'SELECT permissions FROM admin_permissions WHERE user_id = $1',
      [user.id]
    );

    return result.rows[0]?.permissions || {};
  } catch (error) {
    if (error.code === '42P01') return {};
    throw error;
  }
}

async function authenticate(req, res, next) {
  const token = getBearerToken(req);
  const session = parseToken(token);

  if (!session) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada. Inicie sessão novamente.' });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, email, plan_type, subscription_plan, status, created_at, plan_expires_at
       FROM users
       WHERE id = $1`,
      [session.sub]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Sessão inválida.' });
    }

    const user = result.rows[0];
    if (user.status === 'blocked') {
      return res.status(403).json({ error: 'A sua conta encontra-se bloqueada. Contacte o suporte.' });
    }

    req.user = {
      ...user,
      admin_permissions: await getAdminPermissionsForUser(user)
    };
    next();
  } catch (error) {
    console.error('Erro ao validar sessão:', error);
    res.status(500).json({ error: 'Erro ao validar sessão.' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.plan_type !== 'admin') {
    return res.status(403).json({ error: 'Acesso reservado ao administrador.' });
  }

  next();
}

function requireAdminPermission(permission) {
  return async (req, res, next) => {
    if (req.user?.plan_type !== 'admin') {
      return res.status(403).json({ error: 'Acesso reservado ao administrador.' });
    }

    if (!permission || req.user.id === FALLBACK_ADMIN_ID) {
      return next();
    }

    try {
      const permissions = req.user.admin_permissions || await getAdminPermissionsForUser(req.user);
      if (permissions.all || permissions.all_access || permissions[permission]) {
        return next();
      }

      return res.status(403).json({ error: 'Sem permissao para gerir esta area administrativa.' });
    } catch (error) {
      if (error.code === '42P01') {
        return res.status(403).json({ error: 'Sem permissao para gerir esta area administrativa.' });
      }

      console.error('Erro ao validar permissao admin:', error);
      return res.status(500).json({ error: 'Erro ao validar permissao administrativa.' });
    }
  };
}

function requireSelfParam(paramName = 'userId') {
  return (req, res, next) => {
    if (hasFullAdminAccess(req.user)) return next();
    if (req.params[paramName] !== req.user?.id) {
      return res.status(403).json({ error: 'Não pode aceder aos dados de outro utilizador.' });
    }

    next();
  };
}

function requireSelfBody(fieldName = 'userId') {
  return (req, res, next) => {
    if (hasFullAdminAccess(req.user)) return next();

    if (req.body?.[fieldName] && req.body[fieldName] !== req.user?.id) {
      return res.status(403).json({ error: 'Não pode alterar dados de outro utilizador.' });
    }

    req.body[fieldName] = req.user.id;
    next();
  };
}

function requirePlanAccess(req, res, next) {
  if (!hasActivePlanAccess(req.user)) {
    return res.status(402).json({
      error: 'Plano expirado. Renove para usar esta funcionalidade Premium.',
      planExpired: true
    });
  }

  next();
}

function requireAnnualFeatureAccess(req, res, next) {
  if (!hasAnnualFeatureAccess(req.user)) {
    return res.status(402).json({
      error: 'Funcionalidade exclusiva do plano Anual. Durante o mês grátis também fica disponível.',
      annualRequired: true
    });
  }

  next();
}

module.exports = {
  authenticate,
  hasAnnualFeatureAccess,
  hasActivePlanAccess,
  requireAdmin,
  requireAdminPermission,
  requireAnnualFeatureAccess,
  requirePlanAccess,
  requireSelfBody,
  requireSelfParam,
  signSession,
  getAdminPermissionsForUser,
  hasFullAdminAccess
};
