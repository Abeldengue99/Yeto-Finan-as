const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:4174',
  'http://127.0.0.1:4174'
];

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH']);
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getAllowedOrigins() {
  const configured = process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGINS;
  if (!configured) return DEFAULT_ALLOWED_ORIGINS;

  return configured
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
}

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);

    const allowedOrigins = getAllowedOrigins();
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origem bloqueada pela politica CORS.'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 600
};

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");

  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
}

function requireJsonContent(req, res, next) {
  if (MUTATING_METHODS.has(req.method) && Number(req.headers['content-length'] || 0) > 0 && !req.is('application/json')) {
    return res.status(415).json({ error: 'Content-Type deve ser application/json.' });
  }

  next();
}

function sanitizeValue(value) {
  if (typeof value === 'string') {
    return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
        delete value[key];
      } else {
        value[key] = sanitizeValue(value[key]);
      }
    }
  }

  return value;
}

function sanitizeRequest(req, res, next) {
  if (req.body) sanitizeValue(req.body);
  if (req.query) sanitizeValue(req.query);
  if (req.params) sanitizeValue(req.params);
  next();
}

function validateUuidParam(paramName) {
  return (req, res, next) => {
    const value = req.params[paramName];
    if (!value || !UUID_REGEX.test(value)) {
      return res.status(400).json({ error: 'Identificador invalido.' });
    }

    next();
  };
}

function getClientKey(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function createRateLimiter({ windowMs = 60_000, max = 120, keyPrefix = 'global' } = {}) {
  const hits = new Map();

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (record.resetAt <= now) hits.delete(key);
    }
  }, windowMs);

  cleanup.unref?.();

  return (req, res, next) => {
    const now = Date.now();
    const key = `${keyPrefix}:${getClientKey(req)}`;
    const record = hits.get(key);

    if (!record || record.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader('RateLimit-Limit', String(max));
      res.setHeader('RateLimit-Remaining', String(max - 1));
      return next();
    }

    record.count += 1;
    const remaining = Math.max(0, max - record.count);
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil(record.resetAt / 1000)));

    if (record.count > max) {
      return res.status(429).json({ error: 'Muitas tentativas. Aguarde um pouco e tente novamente.' });
    }

    next();
  };
}

function requestLogger(req, res, next) {
  const startedAt = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startedAt;
    if (res.statusCode >= 400) {
      console.warn(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Rota nao encontrada.' });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({ error: 'Origem nao autorizada.' });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON invalido.' });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Pedido demasiado grande.' });
  }

  console.error('Erro inesperado:', err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
}

module.exports = {
  corsOptions,
  createRateLimiter,
  errorHandler,
  notFoundHandler,
  requestLogger,
  requireJsonContent,
  sanitizeRequest,
  securityHeaders,
  validateUuidParam
};
