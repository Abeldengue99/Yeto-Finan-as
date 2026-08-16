const pool = require('./config/database');

async function runMigration() {
  try {
    console.log('Iniciando migração de expiração de planos...');

    await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP;
    `);

    await pool.query(`
      UPDATE users
      SET plan_expires_at = COALESCE(created_at, NOW()) + INTERVAL '30 days'
      WHERE plan_type = 'free'
        AND plan_expires_at IS NULL;
    `);

    await pool.query(`
      UPDATE users
      SET plan_expires_at = NOW() + INTERVAL '1 year'
      WHERE plan_type = 'premium'
        AND plan_expires_at IS NULL;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS payment_approvals (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_requested VARCHAR(50) DEFAULT 'anual',
        proof_image TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      ALTER TABLE payment_approvals
      ADD COLUMN IF NOT EXISTS plan_requested VARCHAR(50) DEFAULT 'anual',
      ADD COLUMN IF NOT EXISTS proof_image TEXT,
      ADD COLUMN IF NOT EXISTS notified_user BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;
    `);

    await pool.query(`
      UPDATE payment_approvals
      SET plan_requested = CASE
        WHEN plan_requested IN ('semestral', 'anual') THEN plan_requested
        WHEN plan_requested IN ('annual', 'premium') THEN 'anual'
        ELSE 'anual'
      END
      WHERE plan_requested IS NULL
         OR plan_requested NOT IN ('semestral', 'anual');
    `);

    await pool.query(`
      UPDATE payment_approvals
      SET notified_user = FALSE
      WHERE notified_user IS NULL;
    `);

    console.log('Migração concluída com sucesso.');
  } catch (error) {
    console.error('Erro na migração:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runMigration();
