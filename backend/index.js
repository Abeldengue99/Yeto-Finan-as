const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pool = require('./config/database');
const {
  corsOptions,
  createRateLimiter,
  errorHandler,
  notFoundHandler,
  requestLogger,
  requireJsonContent,
  sanitizeRequest,
  securityHeaders
} = require('./middleware/security');
const { authenticate, requireAdmin } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

const authRoutes = require('./routes/authRoutes');
const financeRoutes = require('./routes/financeRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const gamificationRoutes = require('./routes/gamificationRoutes');
const assistantRoutes = require('./routes/assistantRoutes');
const syncRoutes = require('./routes/syncRoutes');
const testimonialRoutes = require('./routes/testimonialRoutes');

app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);

app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(express.json({ limit: process.env.JSON_LIMIT || '5mb', strict: true }));
app.use(requireJsonContent);
app.use(sanitizeRequest);
app.use(requestLogger);
app.use(createRateLimiter({ windowMs: 60 * 1000, max: 180, keyPrefix: 'api' }));

app.use('/api/auth', createRateLimiter({ windowMs: 15 * 60 * 1000, max: 25, keyPrefix: 'auth' }), authRoutes);
app.use('/api/finances', financeRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/testimonials', testimonialRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Yeto Financas API ativa.' });
});

app.get('/api/db-test', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS current_time');
    res.status(200).json({
      status: 'success',
      message: 'Conexão à base de dados bem-sucedida.',
      time: result.rows[0].current_time
    });
  } catch (error) {
    console.error('Erro ao conectar a BD:', error);
    res.status(500).json({ status: 'error', message: 'Falha na conexão à base de dados.' });
  }
});

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
