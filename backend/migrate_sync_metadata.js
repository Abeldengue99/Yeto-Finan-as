const fs = require('fs');
const path = require('path');
const pool = require('./config/database');

async function runMigration() {
  try {
    console.log('A preparar metadados de sincronização offline...');

    const sqlPath = path.join(__dirname, 'database', 'add_sync_metadata.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(sql);

    console.log('Metadados de sincronização configurados com sucesso.');
  } catch (error) {
    console.error('Erro ao configurar metadados de sincronização:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runMigration();
