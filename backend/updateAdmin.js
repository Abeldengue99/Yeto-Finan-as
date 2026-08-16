const pool = require('./config/database');

async function updateAdmin() {
  try {
    // Apaga o admin antigo se existir
    await pool.query("DELETE FROM users WHERE email = 'admin@yeto.com'");

    // Verifica se o novo admin já existe
    const res = await pool.query("SELECT * FROM users WHERE email = 'tabelaabel99@gmail.com'");
    
    if (res.rows.length === 0) {
      // Insere o novo admin
      await pool.query(`
        INSERT INTO users (id, name, email, password_hash, plan_type) 
        VALUES (
          '00000000-0000-0000-0000-000000000000', 
          'Super Admin', 
          'tabelaabel99@gmail.com', 
          '$2y$10$simulatedHashFor3A11199903052025', 
          'admin'
        )
      `);
      console.log('✅ Utilizador tabelaabel99@gmail.com inserido com sucesso!');
    } else {
      console.log('✅ Utilizador tabelaabel99@gmail.com já existe na base de dados.');
    }
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    pool.end();
  }
}

updateAdmin();
