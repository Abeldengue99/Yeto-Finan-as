const pool = require('./config/database');

async function runMigration() {
  try {
    console.log('Iniciando migração da lista de compras...');

    await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS shopping_lists (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(120) NOT NULL,
        month_key CHAR(7) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS shopping_list_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        item_name VARCHAR(120) NOT NULL,
        category VARCHAR(120) NOT NULL,
        quantity NUMERIC(14, 2) NOT NULL DEFAULT 1,
        estimated_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
        is_checked BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query('CREATE INDEX IF NOT EXISTS idx_shopping_lists_user_month ON shopping_lists(user_id, month_key);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_shopping_items_list ON shopping_list_items(list_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_shopping_items_user ON shopping_list_items(user_id);');

    console.log('Migração da lista de compras concluída com sucesso.');
  } catch (error) {
    console.error('Erro na migração da lista de compras:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runMigration();
