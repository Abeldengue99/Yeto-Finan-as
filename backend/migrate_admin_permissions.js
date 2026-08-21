const pool = require('./config/database');

async function migrateAdminPermissions() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_permissions (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
        granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_permissions_granted_by
      ON admin_permissions(granted_by)
    `);

    console.log('Permissoes administrativas preparadas com sucesso.');
  } catch (error) {
    console.error('Erro ao preparar permissoes administrativas:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrateAdminPermissions();
