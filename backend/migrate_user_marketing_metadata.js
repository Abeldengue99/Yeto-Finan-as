const fs = require('fs');
const path = require('path');
const pool = require('./config/database');

async function runMigration() {
  try {
    console.log('A preparar dados de marketing e dispositivos dos utilizadores...');
    const sql = fs.readFileSync(path.join(__dirname, 'database', 'add_user_marketing_metadata.sql'), 'utf8');
    await pool.query(sql);
    console.log('Dados de marketing e dispositivos configurados com sucesso.');
  } catch (error) {
    console.error('Erro ao configurar dados de marketing:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runMigration();
