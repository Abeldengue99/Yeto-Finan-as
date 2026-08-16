const pool = require('./config/database');

async function cleanupDuplicates() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Obter todas as transações de salário deste mês
    const res = await client.query(
      `SELECT id, amount, account_id FROM transactions 
       WHERE category = 'salario' AND description = 'Salário Mensal' 
       ORDER BY transaction_date ASC, created_at ASC`
    );

    const salaries = res.rows;
    console.log(`Found ${salaries.length} salary transactions.`);

    // Se houver mais de uma, apagar as duplicatas (ou seja, apagar todas, já que o usuário disse que para este mês já foi)
    if (salaries.length > 0) {
      console.log('Removing duplicated salaries to fix the balance...');
      let totalAmountToDeduct = 0;
      
      // Agrupar por conta bancária para reverter os saldos
      const accountDeductions = {};

      for (let tr of salaries) {
         if (!accountDeductions[tr.account_id]) {
            accountDeductions[tr.account_id] = 0;
         }
         accountDeductions[tr.account_id] += Number(tr.amount);
         
         await client.query('DELETE FROM transactions WHERE id = $1', [tr.id]);
      }

      // Reverter o saldo das contas
      for (const accountId in accountDeductions) {
         const amount = accountDeductions[accountId];
         console.log(`Deducting ${amount} from account ${accountId}`);
         await client.query(
           'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
           [amount, accountId]
         );
      }
      console.log('Cleanup completed successfully.');
    } else {
      console.log('No duplicated salaries found.');
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error cleaning up:', error);
  } finally {
    client.release();
    pool.end();
  }
}

cleanupDuplicates();
