const pool = require('./config/database');

async function runMigration() {
  try {
    console.log('Iniciando migração dos logs administrativos...');

    await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action_type VARCHAR(80) NOT NULL DEFAULT 'info',
        description TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query('CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at DESC);');

    console.log('Migração dos logs administrativos concluída com sucesso.');
  } catch (error) {
    console.error('Erro na migração dos logs administrativos:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runMigration();
