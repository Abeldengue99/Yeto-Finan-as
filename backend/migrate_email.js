// Script de migração: Adicionar colunas de verificação de email
const pool = require('./config/database');

async function migrate() {
  try {
    console.log('🔄 A executar migração de verificação de email...');
    
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE`);
    console.log('✅ Coluna email_verified adicionada.');
    
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code VARCHAR(6)`);
    console.log('✅ Coluna verification_code adicionada.');
    
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_expires TIMESTAMP`);
    console.log('✅ Coluna verification_expires adicionada.');
    
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code VARCHAR(6)`);
    console.log('✅ Coluna reset_code adicionada.');
    
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code_expires TIMESTAMP`);
    console.log('✅ Coluna reset_code_expires adicionada.');
    
    // Marcar admin como verificado por defeito
    await pool.query(`UPDATE users SET email_verified = TRUE WHERE id = '00000000-0000-0000-0000-000000000000'`);
    console.log('✅ Admin marcado como verificado.');
    
    console.log('🎉 Migração concluída com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro na migração:', error.message);
    process.exit(1);
  }
}

migrate();
