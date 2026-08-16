const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pool = require('./config/database');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Importação das Rotas
const authRoutes = require('./routes/authRoutes');
const financeRoutes = require('./routes/financeRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const gamificationRoutes = require('./routes/gamificationRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/finances', financeRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/gamification', gamificationRoutes);

// Rotas Base
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Yeto Finanças API is running smoothly.' });
});

// Teste de Conexão à Base de Dados
app.get('/api/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS current_time');
    res.status(200).json({ status: 'success', message: 'Conexão à base de dados bem-sucedida!', time: result.rows[0].current_time });
  } catch (error) {
    console.error('Erro ao conectar à BD:', error);
    res.status(500).json({ status: 'error', message: 'Falha na conexão à base de dados.', error: error.message });
  }
});

// Inicialização do Servidor
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
