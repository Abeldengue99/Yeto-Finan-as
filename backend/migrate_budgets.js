const pool = require('./config/database');

async function runMigration() {
  try {
    console.log('Iniciando migração de orçamentos familiares...');

    await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS budgets (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category VARCHAR(120) NOT NULL,
        month_key CHAR(7) NOT NULL,
        monthly_limit NUMERIC(14, 2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, category, month_key)
      );
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON budgets(user_id, month_key);');

    console.log('Migração de orçamentos concluída com sucesso.');
  } catch (error) {
    console.error('Erro na migração de orçamentos:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runMigration();
