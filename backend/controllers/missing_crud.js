const pool = require('../config/database');

const updateAccount = async (req, res) => {
  const { id } = req.params;
  const { name, type, color_code, iban } = req.body;
  try {
    const result = await pool.query(
      'UPDATE accounts SET name = $1, type = $2, color_code = $3, iban = $4 WHERE id = $5 RETURNING *',
      [name, type, color_code, iban, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Conta não encontrada.' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar conta.' });
  }
};

const deleteAccount = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM accounts WHERE id = $1', [id]);
    res.json({ message: 'Conta eliminada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao eliminar conta.' });
  }
};

const updateTransaction = async (req, res) => {
  const { id } = req.params;
  const { category, description, amount, transaction_date } = req.body;
  try {
    const result = await pool.query(
      'UPDATE transactions SET category = $1, description = $2, amount = $3, transaction_date = $4 WHERE id = $5 RETURNING *',
      [category, description, amount, transaction_date, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Transação não encontrada.' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar transação.' });
  }
};

const deleteTransaction = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const trRes = await client.query('SELECT * FROM transactions WHERE id = $1', [id]);
    if (trRes.rows.length === 0) throw new Error('Transação não encontrada');
    const tr = trRes.rows[0];
    
    // Reverse balance
    const balanceAdjustment = tr.type === 'income' ? -tr.amount : tr.amount;
    await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [balanceAdjustment, tr.account_id]);
    
    await client.query('DELETE FROM transactions WHERE id = $1', [id]);
    await client.query('COMMIT');
    res.json({ message: 'Transação eliminada' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Erro ao eliminar transação.' });
  } finally {
    client.release();
  }
};

const updateDebt = async (req, res) => {
  const { id } = req.params;
  const { person_name, type, amount, due_date, purpose } = req.body;
  try {
    const result = await pool.query(
      'UPDATE debts SET person_name = $1, type = $2, amount = $3, due_date = $4, purpose = $5 WHERE id = $6 RETURNING *',
      [person_name, type, amount, due_date, purpose, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Dívida não encontrada.' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar dívida.' });
  }
};

const deleteDebt = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM debts WHERE id = $1', [id]);
    res.json({ message: 'Dívida eliminada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao eliminar dívida.' });
  }
};

const updateFixedPayment = async (req, res) => {
  const { id } = req.params;
  const { name, category, amount, due_day } = req.body;
  try {
    const result = await pool.query(
      'UPDATE fixed_payments SET name = $1, category = $2, amount = $3, due_day = $4 WHERE id = $5 RETURNING *',
      [name, category, amount, due_day, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pagamento não encontrado.' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar pagamento.' });
  }
};

const deleteFixedPayment = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM fixed_payments WHERE id = $1', [id]);
    res.json({ message: 'Pagamento fixo eliminado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao eliminar pagamento fixo.' });
  }
};

const updateProject = async (req, res) => {
  const { id } = req.params;
  const { name, category, target_amount, deadline } = req.body;
  try {
    const result = await pool.query(
      'UPDATE projects SET name = $1, category = $2, target_amount = $3, deadline = $4 WHERE id = $5 RETURNING *',
      [name, category, target_amount, deadline, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Projeto não encontrado.' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar projeto.' });
  }
};

const deleteProject = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM projects WHERE id = $1', [id]);
    res.json({ message: 'Projeto eliminado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao eliminar projeto.' });
  }
};

module.exports = {
  updateAccount, deleteAccount,
  updateTransaction, deleteTransaction,
  updateDebt, deleteDebt,
  updateFixedPayment, deleteFixedPayment,
  updateProject, deleteProject
};
