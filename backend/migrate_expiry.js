const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: 'postgres',
  password: '5850',
  host: 'localhost',
  port: 5432,
  database: 'Yeto Finanças'
});

async function runMigration() {
  try {
    console.log('Iniciando migração de expiração de planos...');
    
    // 1. Adicionar coluna
    console.log('1. A adicionar coluna plan_expires_at...');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP;');
    
    // 2. Definir expiração para todos os utilizadores (30 dias para gratuitos, 1 ano para admin/premium)
    console.log('2. A configurar datas de expiração iniciais...');
    
    // Para utilizadores com plano "free", define a expiração para 30 dias após a data de criação
    // Se a data de criação + 30 dias já passou, eles ficarão "expirados"
    await pool.query(`
      UPDATE users 
      SET plan_expires_at = created_at + INTERVAL '30 days' 
      WHERE plan_type = 'free' AND plan_expires_at IS NULL;
    `);

    // Para utilizadores premium ou admin, dá 1 ano de bónus a partir de hoje
    await pool.query(`
      UPDATE users 
      SET plan_expires_at = NOW() + INTERVAL '1 year' 
      WHERE plan_type != 'free' AND plan_expires_at IS NULL;
    `);

    console.log('✅ Migração concluída com sucesso!');
  } catch (error) {
    console.error('❌ Erro na migração:', error);
  } finally {
    pool.end();
  }
}

runMigration();
