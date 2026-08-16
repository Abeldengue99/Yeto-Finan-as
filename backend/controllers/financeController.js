const pool = require('../config/database');

const getUserFinances = async (req, res) => {
  const { userId } = req.params;

  try {
    // 0. Fetch User Info
    const userRes = await pool.query('SELECT name, email, occupation, avatar_url, yeto_points, plan_type, created_at FROM users WHERE id = $1', [userId]);
    const user = userRes.rows[0];

    // 1. Fetch Accounts
    const accountsResult = await pool.query('SELECT * FROM accounts WHERE user_id = $1', [userId]);
    const accounts = accountsResult.rows;

    // 2. Fetch Transactions (Recent)
    const transactionsResult = await pool.query('SELECT * FROM transactions WHERE user_id = $1 ORDER BY transaction_date DESC LIMIT 50', [userId]);
    const transactions = transactionsResult.rows;

    // 3. Fetch Debts
    const debtsResult = await pool.query('SELECT * FROM debts WHERE user_id = $1', [userId]);
    const debts = debtsResult.rows;

    // 4. Fetch Fixed Payments
    const fixedPaymentsResult = await pool.query('SELECT * FROM fixed_payments WHERE user_id = $1', [userId]);
    const fixedPayments = fixedPaymentsResult.rows;

    // 5. Fetch Projects
    const projectsResult = await pool.query('SELECT * FROM projects WHERE user_id = $1', [userId]);
    const projects = projectsResult.rows;

    // 6. Fetch Kixikilas
    const kixikilasResult = await pool.query('SELECT * FROM kixikila_groups WHERE user_id = $1', [userId]);
    const kixikilas = kixikilasResult.rows;

    // 7. Fetch Divisas
    const divisasResult = await pool.query('SELECT * FROM foreign_currency WHERE user_id = $1 ORDER BY purchase_date DESC', [userId]);
    const divisas = divisasResult.rows;

    // Calculate Total Balance directly from accounts
    const saldoTotal = accounts.reduce((acc, curr) => acc + Number(curr.balance), 0);

    // Calculate despesas/entradas from transactions (for simplicity, we return the raw transactions and let frontend handle, or we can aggregate)
    const despesas = transactions.filter(t => t.type === 'expense').map(t => ({ id: t.id, descricao: t.description, valor: Number(t.amount), categoria: t.category, data: t.transaction_date }));
    
    // Map data to match frontend expectations
    res.status(200).json({
      user,
      saldoTotal,
      accounts: accounts.map(a => ({
        id: a.id,
        nome: a.name,
        tipo: a.type,
        saldo: Number(a.balance),
        cor: a.color_code,
        iban: a.iban || ''
      })),
      movimentos: transactions.map(t => ({
        id: t.id,
        tipo_movimento: t.type === 'income' ? 'entrada' : 'saida',
        descricao: t.description,
        valor: Number(t.amount),
        categoria: t.category,
        data: t.transaction_date
      })),
      despesas,
      dividas: debts.map(d => ({
        id: d.id,
        pessoa: d.person_name,
        valor: Number(d.amount),
        tipo: d.type === 'to_receive' ? 'a_receber' : 'a_pagar',
        finalidade: d.purpose || '',
        dataVencimento: d.due_date ? new Date(d.due_date).toISOString().split('T')[0] : '',
        paga: d.is_paid
      })),
      pagamentosFixos: fixedPayments.map(p => ({
        id: p.id,
        nome: p.name,
        valor: Number(p.amount),
        diaVencimento: p.due_day,
        pagoEsteMes: p.is_paid_this_month
      })),
      projetos: projects.map(p => ({
        id: p.id,
        nome: p.name,
        categoria: p.category,
        objetivo: Number(p.target_amount),
        valorGuardado: Number(p.saved_amount),
        prazo: p.deadline ? new Date(p.deadline).toISOString().split('T')[0] : ''
      })),
      kixikilas: kixikilas.map(k => ({
        id: k.id,
        nome: k.name,
        membros: [], // Para simplicidade vamos assumir array vazio até termos a gestão de membros na UI
        periodicidade: k.periodicity,
        minhaPosicao: 1, // Mock
        valorQuota: Number(k.quota_value),
        valorMao: Number(k.hand_value),
        proximaData: k.start_date ? new Date(k.start_date).toISOString().split('T')[0] : ''
      })),
      divisas: divisas.map(d => ({
        id: d.id,
        moeda: d.currency,
        montante: Number(d.amount_bought),
        taxaCompra: Number(d.exchange_rate),
        data: d.purchase_date ? new Date(d.purchase_date).toISOString().split('T')[0] : ''
      }))
    });

  } catch (error) {
    console.error('Error fetching user finances:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao carregar finanças.' });
  }
};

const createAccount = async (req, res) => {
  const { userId, name, type, balance, currency, color_code, iban } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO accounts (user_id, name, type, balance, currency, color_code, iban) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, name, type, balance || 0, currency || 'AOA', color_code || '#000000', iban || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar conta:', error);
    res.status(500).json({ error: 'Erro ao criar conta na base de dados.' });
  }
};

const createTransaction = async (req, res) => {
  const { userId, accountId, type, category, description, amount, transaction_date } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN'); // Start transaction for safety

    // 1. Inserir a transação
    const transResult = await client.query(
      `INSERT INTO transactions (user_id, account_id, type, category, description, amount, transaction_date) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, accountId, type, category, description, amount, transaction_date]
    );

    const newTransaction = transResult.rows[0];

    // 2. Atualizar o saldo da conta
    const balanceAdjustment = type === 'income' ? amount : -amount;
    await client.query(
      `UPDATE accounts SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [balanceAdjustment, accountId]
    );

    await client.query('COMMIT');
    res.status(201).json(newTransaction);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao registar transação:', error);
    res.status(500).json({ error: 'Erro ao registar transação.' });
  } finally {
    client.release();
  }
};

const createDebt = async (req, res) => {
  const { userId, person_name, type, amount, due_date, purpose } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO debts (user_id, person_name, type, amount, due_date, purpose) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, person_name, type, amount, due_date || null, purpose || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar dívida:', error);
    res.status(500).json({ error: 'Erro ao registar dívida.' });
  }
};

const payDebt = async (req, res) => {
  const { id } = req.params;
  const { accountId } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const debtRes = await client.query('SELECT * FROM debts WHERE id = $1', [id]);
    if (debtRes.rows.length === 0) throw new Error('Dívida não encontrada.');
    const debt = debtRes.rows[0];

    // Atualizar estado da dívida
    await client.query('UPDATE debts SET is_paid = true WHERE id = $1', [id]);

    // Atualizar saldo da conta: se eu pago uma dívida a pagar, sai dinheiro. Se recebo, entra dinheiro.
    const balanceAdjustment = debt.type === 'to_pay' ? -Number(debt.amount) : Number(debt.amount);
    await client.query(
      `UPDATE accounts SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [balanceAdjustment, accountId]
    );

    // Registar a transação
    await client.query(
      `INSERT INTO transactions (user_id, account_id, type, category, description, amount, transaction_date) 
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)`,
      [debt.user_id, accountId, debt.type === 'to_pay' ? 'expense' : 'income', 'dívida', `Liquidação de dívida: ${debt.person_name}`, debt.amount]
    );

    await client.query('COMMIT');
    res.status(200).json({ status: 'success' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao pagar dívida:', error);
    res.status(500).json({ error: 'Erro ao liquidar dívida.' });
  } finally {
    client.release();
  }
};

const createFixedPayment = async (req, res) => {
  const { userId, name, category, amount, due_day } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO fixed_payments (user_id, name, category, amount, due_day) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, name, category, amount, due_day]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar pagamento fixo:', error);
    res.status(500).json({ error: 'Erro ao registar pagamento fixo.' });
  }
};

const payFixedPayment = async (req, res) => {
  const { id } = req.params;
  const { accountId } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const fixRes = await client.query('SELECT * FROM fixed_payments WHERE id = $1', [id]);
    if (fixRes.rows.length === 0) throw new Error('Pagamento fixo não encontrado.');
    const fixed = fixRes.rows[0];

    // Marcar como pago este mês
    await client.query('UPDATE fixed_payments SET is_paid_this_month = true WHERE id = $1', [id]);

    // Atualizar saldo da conta
    await client.query(
      `UPDATE accounts SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [fixed.amount, accountId]
    );

    // Registar a transação
    await client.query(
      `INSERT INTO transactions (user_id, account_id, type, category, description, amount, transaction_date) 
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)`,
      [fixed.user_id, accountId, 'expense', fixed.category, `Pagamento Fixo: ${fixed.name}`, fixed.amount]
    );

    await client.query('COMMIT');
    res.status(200).json({ status: 'success' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao pagar fixo:', error);
    res.status(500).json({ error: 'Erro ao liquidar pagamento fixo.' });
  } finally {
    client.release();
  }
};

const createKixikila = async (req, res) => {
  const { userId, name, hand_value, quota_value, periodicity, start_date } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO kixikila_groups (user_id, name, hand_value, quota_value, periodicity, start_date) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, name, hand_value, quota_value, periodicity, start_date]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar kixikila:', error);
    res.status(500).json({ error: 'Erro ao registar kixikila.' });
  }
};

const receiveKixikilaHand = async (req, res) => {
  const { id } = req.params;
  const { accountId } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const kixRes = await client.query('SELECT * FROM kixikila_groups WHERE id = $1', [id]);
    if (kixRes.rows.length === 0) throw new Error('Kixikila não encontrada.');
    const kixikila = kixRes.rows[0];

    // Atualizar saldo da conta
    await client.query(
      `UPDATE accounts SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [kixikila.hand_value, accountId]
    );

    // Registar a transação
    await client.query(
      `INSERT INTO transactions (user_id, account_id, type, category, description, amount, transaction_date) 
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)`,
      [kixikila.user_id, accountId, 'income', 'kixikila', `Mão da Kixikila: ${kixikila.name}`, kixikila.hand_value]
    );

    await client.query('COMMIT');
    res.status(200).json({ status: 'success' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao receber kixikila:', error);
    res.status(500).json({ error: 'Erro ao receber mão da kixikila.' });
  } finally {
    client.release();
  }
};

const createProject = async (req, res) => {
  const { userId, name, category, target_amount, saved_amount, deadline } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO projects (user_id, name, category, target_amount, saved_amount, deadline) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, name, category, target_amount, saved_amount || 0, deadline]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar projeto:', error);
    res.status(500).json({ error: 'Erro ao registar projeto.' });
  }
};

const createForeignCurrency = async (req, res) => {
  const { userId, accountId, currency, amount_bought, exchange_rate } = req.body;
  const total_spent_aoa = amount_bought * exchange_rate;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Inserir compra de divisas
    const result = await client.query(
      `INSERT INTO foreign_currency (user_id, currency, amount_bought, exchange_rate, total_spent_aoa, purchase_date) 
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE) RETURNING *`,
      [userId, currency, amount_bought, exchange_rate, total_spent_aoa]
    );

    // Deduzir da conta
    await client.query(
      `UPDATE accounts SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [total_spent_aoa, accountId]
    );

    // Registar a transação
    await client.query(
      `INSERT INTO transactions (user_id, account_id, type, category, description, amount, transaction_date) 
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)`,
      [userId, accountId, 'expense', 'cambio', `Compra de ${amount_bought} ${currency}`, total_spent_aoa]
    );

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao comprar divisas:', error);
    res.status(500).json({ error: 'Erro ao comprar divisas.' });
  } finally {
    client.release();
  }
};

const fundProject = async (req, res) => {
  const { id } = req.params;
  const { accountId, amount } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const projRes = await client.query('SELECT * FROM projects WHERE id = $1', [id]);
    if (projRes.rows.length === 0) throw new Error('Projeto não encontrado.');
    const project = projRes.rows[0];

    // Atualizar valor guardado
    await client.query(
      `UPDATE projects SET saved_amount = saved_amount + $1 WHERE id = $2`,
      [amount, id]
    );

    // Deduzir da conta
    await client.query(
      `UPDATE accounts SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [amount, accountId]
    );

    // Registar a transação
    await client.query(
      `INSERT INTO transactions (user_id, account_id, type, category, description, amount, transaction_date) 
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)`,
      [project.user_id, accountId, 'expense', 'projeto', `Depósito no Projeto: ${project.name}`, amount]
    );

    await client.query('COMMIT');
    res.status(200).json({ status: 'success' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao financiar projeto:', error);
    res.status(500).json({ error: 'Erro ao financiar projeto.' });
  } finally {
    client.release();
  }
};


const uploadPaymentProof = async (req, res) => {
  const { userId, proofImage } = req.body;
  try {
    if (!userId || !proofImage) {
      return res.status(400).json({ error: 'Faltam dados do comprovativo.' });
    }
    const result = await pool.query(
      'INSERT INTO payment_approvals (user_id, proof_image, status) VALUES ($1, $2, $3) RETURNING *',
      [userId, proofImage, 'pending']
    );
    res.status(201).json({ message: 'Comprovativo enviado com sucesso.', proof: result.rows[0] });
  } catch (err) {
    console.error('Erro ao enviar comprovativo:', err);
    res.status(500).json({ error: 'Erro interno ao processar comprovativo.' });
  }
};

const getPaymentStatus = async (req, res) => {
  const { userId } = req.params;
  try {
    // Busca pagamentos aprovados ou rejeitados que ainda não foram notificados
    const result = await pool.query(
      `SELECT id, status, submitted_at FROM payment_approvals 
       WHERE user_id = $1 AND status IN ('approved', 'rejected') AND notified_user = false`,
      [userId]
    );

    if (result.rows.length > 0) {
      // Marcar como notificados para não enviar novamente
      const ids = result.rows.map(r => r.id);
      await pool.query(
        `UPDATE payment_approvals SET notified_user = true WHERE id = ANY($1)`,
        [ids]
      );
    }

    res.json({ notifications: result.rows });
  } catch (err) {
    console.error('Erro ao verificar status de pagamento:', err);
    res.json({ notifications: [] });
  }
};

// ==========================================
// UPDATE & DELETE ENDPOINTS
// ==========================================

// --- TRANSACTIONS ---
const updateTransaction = async (req, res) => {
  const { id } = req.params;
  const { description, amount, category, transaction_date } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Get old transaction to reverse balance
    const oldRes = await client.query('SELECT * FROM transactions WHERE id = $1', [id]);
    if (oldRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Transação não encontrada.' }); }
    const old = oldRes.rows[0];
    const oldAmount = Number(old.amount);
    const newAmount = Number(amount);

    // Reverse old balance impact, apply new
    if (old.type === 'expense') {
      await client.query('UPDATE accounts SET balance = balance + $1 - $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3', [oldAmount, newAmount, old.account_id]);
    } else {
      await client.query('UPDATE accounts SET balance = balance - $1 + $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3', [oldAmount, newAmount, old.account_id]);
    }

    const result = await client.query(
      'UPDATE transactions SET description = $1, amount = $2, category = $3, transaction_date = $4 WHERE id = $5 RETURNING *',
      [description, newAmount, category, transaction_date, id]
    );
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao atualizar transação:', error);
    res.status(500).json({ error: 'Erro ao atualizar transação.' });
  } finally {
    client.release();
  }
};

const deleteTransaction = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const oldRes = await client.query('SELECT * FROM transactions WHERE id = $1', [id]);
    if (oldRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Transação não encontrada.' }); }
    const old = oldRes.rows[0];

    // Reverse balance impact
    if (old.type === 'expense') {
      await client.query('UPDATE accounts SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [Number(old.amount), old.account_id]);
    } else {
      await client.query('UPDATE accounts SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [Number(old.amount), old.account_id]);
    }

    await client.query('DELETE FROM transactions WHERE id = $1', [id]);
    await client.query('COMMIT');
    res.json({ message: 'Transação eliminada com sucesso.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao eliminar transação:', error);
    res.status(500).json({ error: 'Erro ao eliminar transação.' });
  } finally {
    client.release();
  }
};

// --- ACCOUNTS ---
const updateAccount = async (req, res) => {
  const { id } = req.params;
  const { name, type, iban, color_code } = req.body;
  try {
    const result = await pool.query(
      'UPDATE accounts SET name = $1, type = $2, iban = $3, color_code = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
      [name, type, iban || null, color_code || '#373392', id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Conta não encontrada.' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar conta:', error);
    res.status(500).json({ error: 'Erro ao atualizar conta.' });
  }
};

const deleteAccount = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM accounts WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Conta não encontrada.' });
    res.json({ message: 'Conta eliminada com sucesso.' });
  } catch (error) {
    console.error('Erro ao eliminar conta:', error);
    res.status(500).json({ error: 'Erro ao eliminar conta.' });
  }
};

// --- DEBTS ---
const updateDebt = async (req, res) => {
  const { id } = req.params;
  const { person_name, type, amount, due_date, purpose } = req.body;
  try {
    const result = await pool.query(
      'UPDATE debts SET person_name = $1, type = $2, amount = $3, due_date = $4, purpose = $5 WHERE id = $6 RETURNING *',
      [person_name, type, Number(amount), due_date, purpose, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Dívida não encontrada.' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar dívida:', error);
    res.status(500).json({ error: 'Erro ao atualizar dívida.' });
  }
};

const deleteDebt = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM debts WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Dívida não encontrada.' });
    res.json({ message: 'Dívida eliminada com sucesso.' });
  } catch (error) {
    console.error('Erro ao eliminar dívida:', error);
    res.status(500).json({ error: 'Erro ao eliminar dívida.' });
  }
};

// --- FIXED PAYMENTS ---
const updateFixedPayment = async (req, res) => {
  const { id } = req.params;
  const { name, amount, due_day, category } = req.body;
  try {
    const result = await pool.query(
      'UPDATE fixed_payments SET name = $1, amount = $2, due_day = $3, category = $4 WHERE id = $5 RETURNING *',
      [name, Number(amount), Number(due_day), category, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pagamento fixo não encontrado.' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar pagamento fixo:', error);
    res.status(500).json({ error: 'Erro ao atualizar pagamento fixo.' });
  }
};

const deleteFixedPayment = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM fixed_payments WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pagamento fixo não encontrado.' });
    res.json({ message: 'Pagamento fixo eliminado com sucesso.' });
  } catch (error) {
    console.error('Erro ao eliminar pagamento fixo:', error);
    res.status(500).json({ error: 'Erro ao eliminar pagamento fixo.' });
  }
};

// --- PROJECTS ---
const updateProject = async (req, res) => {
  const { id } = req.params;
  const { name, category, target_amount, deadline } = req.body;
  try {
    const result = await pool.query(
      'UPDATE projects SET name = $1, category = $2, target_amount = $3, deadline = $4 WHERE id = $5 RETURNING *',
      [name, category, Number(target_amount), deadline || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Projeto não encontrado.' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar projeto:', error);
    res.status(500).json({ error: 'Erro ao atualizar projeto.' });
  }
};

const deleteProject = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM projects WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Projeto não encontrado.' });
    res.json({ message: 'Projeto eliminado com sucesso.' });
  } catch (error) {
    console.error('Erro ao eliminar projeto:', error);
    res.status(500).json({ error: 'Erro ao eliminar projeto.' });
  }
};

// --- KIXIKILAS ---
const updateKixikila = async (req, res) => {
  const { id } = req.params;
  const { name, periodicity, quota_value, hand_value, start_date } = req.body;
  try {
    const result = await pool.query(
      'UPDATE kixikila_groups SET name = $1, periodicity = $2, quota_value = $3, hand_value = $4, start_date = $5 WHERE id = $6 RETURNING *',
      [name, periodicity, Number(quota_value), Number(hand_value), start_date || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Kixikila não encontrada.' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar kixikila:', error);
    res.status(500).json({ error: 'Erro ao atualizar kixikila.' });
  }
};

const deleteKixikila = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM kixikila_groups WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Kixikila não encontrada.' });
    res.json({ message: 'Kixikila eliminada com sucesso.' });
  } catch (error) {
    console.error('Erro ao eliminar kixikila:', error);
    res.status(500).json({ error: 'Erro ao eliminar kixikila.' });
  }
};


module.exports = {
  getUserFinances,
  createAccount, updateAccount, deleteAccount,
  createTransaction, updateTransaction, deleteTransaction,
  createDebt, updateDebt, deleteDebt,
  payDebt,
  createFixedPayment, updateFixedPayment, deleteFixedPayment,
  payFixedPayment,
  createKixikila, updateKixikila, deleteKixikila,
  receiveKixikilaHand,
  createProject, updateProject, deleteProject,
  fundProject,
  createForeignCurrency,
  uploadPaymentProof,
  getPaymentStatus
};
