const crypto = require('crypto');
const pool = require('../config/database');

const TOKEN_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS || 2 * 60 * 60);
const FALLBACK_SECRET = 'dev-only-yeto-session-secret-change-before-production';

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET || process.env.JWT_SECRET || process.env.DB_PASSWORD || FALLBACK_SECRET;

  if (process.env.NODE_ENV === 'production' && secret.length < 32) {
    throw new Error('SESSION_SECRET deve ter pelo menos 32 caracteres em producao.');
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

async function authenticate(req, res, next) {
  const token = getBearerToken(req);
  const session = parseToken(token);

  if (!session) {
    return res.status(401).json({ error: 'Sessao invalida ou expirada. Inicie sessao novamente.' });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, email, plan_type, status, created_at, plan_expires_at
       FROM users
       WHERE id = $1`,
      [session.sub]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Sessao invalida.' });
    }

    const user = result.rows[0];
    if (user.status === 'blocked') {
      return res.status(403).json({ error: 'A sua conta encontra-se bloqueada. Contacte o suporte.' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Erro ao validar sessao:', error);
    res.status(500).json({ error: 'Erro ao validar sessao.' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.plan_type !== 'admin') {
    return res.status(403).json({ error: 'Acesso reservado ao administrador.' });
  }

  next();
}

function requireSelfParam(paramName = 'userId') {
  return (req, res, next) => {
    if (req.user?.plan_type === 'admin') return next();
    if (req.params[paramName] !== req.user?.id) {
      return res.status(403).json({ error: 'Nao pode aceder aos dados de outro utilizador.' });
    }

    next();
  };
}

function requireSelfBody(fieldName = 'userId') {
  return (req, res, next) => {
    if (req.user?.plan_type === 'admin') return next();

    if (req.body?.[fieldName] && req.body[fieldName] !== req.user?.id) {
      return res.status(403).json({ error: 'Nao pode alterar dados de outro utilizador.' });
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

module.exports = {
  authenticate,
  hasActivePlanAccess,
  requireAdmin,
  requirePlanAccess,
  requireSelfBody,
  requireSelfParam,
  signSession
};
