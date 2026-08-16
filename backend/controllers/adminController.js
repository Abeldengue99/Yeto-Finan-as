const pool = require('../config/database');

const getDashboardStats = async (req, res) => {
  try {
    const usersCountRes = await pool.query("SELECT COUNT(*) FROM users WHERE plan_type != 'admin'");
    const totalUsers = parseInt(usersCountRes.rows[0].count);

    const pendingPaymentsRes = await pool.query("SELECT COUNT(*) FROM payment_approvals WHERE status = 'pending'");
    const pendingApprovals = parseInt(pendingPaymentsRes.rows[0].count);

    const activeSubsRes = await pool.query("SELECT COUNT(*) FROM users WHERE plan_type = 'premium'");
    const activeSubscriptions = parseInt(activeSubsRes.rows[0].count);

    // Receita deste mês na plataforma real precisaria ver transações dos utilizadores
    const mrrRes = await pool.query("SELECT value FROM system_settings WHERE key = 'premium_price'");
    const premiumPrice = mrrRes.rows.length > 0 ? Number(mrrRes.rows[0].value) : 5999;
    const monthlyRevenue = activeSubscriptions * premiumPrice;

    res.json({
      totalUsers,
      pendingApprovals,
      activeSubscriptions,
      monthlyRevenue
    });
  } catch (error) {
    console.error('Erro ao buscar stats admin:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas.' });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, email, plan_type, status, occupation, created_at FROM users ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar utilizadores:', error);
    res.status(500).json({ error: 'Erro ao buscar utilizadores.' });
  }
};

const { sendMassPromotion, sendPaymentApproved } = require('../services/emailService');

const getLogs = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.id, l.action_type, l.description, l.created_at, u.name as admin_name 
      FROM admin_logs l 
      LEFT JOIN users u ON l.admin_id = u.id 
      ORDER BY l.created_at DESC LIMIT 50
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar logs:', error);
    res.status(500).json({ error: 'Erro ao buscar logs.' });
  }
};

const sendPromotions = async (req, res) => {
  const { subject, htmlContent } = req.body;
  const adminId = req.user?.id || '00000000-0000-0000-0000-000000000000'; // fallback mock

  try {
    if (!subject || !htmlContent) {
      return res.status(400).json({ error: 'Assunto e conteúdo são obrigatórios.' });
    }

    // Buscar todos os utilizadores verificados
    const usersRes = await pool.query("SELECT email, name FROM users WHERE email_verified = TRUE");
    
    if (usersRes.rows.length === 0) {
      return res.status(400).json({ error: 'Não existem utilizadores com email verificado.' });
    }

    // Enviar emails
    const result = await sendMassPromotion(usersRes.rows, subject, htmlContent);

    // Registar log
    await pool.query(
      "INSERT INTO admin_logs (admin_id, action_type, description) VALUES ($1, $2, $3)",
      [adminId, 'send_mass_email', `Enviou email promocional para ${result.sent} utilizadores: ${subject}`]
    );

    res.json({ message: `Emails enviados com sucesso para ${result.sent} utilizadores.` });
  } catch (error) {
    console.error('Erro ao enviar promoções:', error);
    res.status(500).json({ error: 'Erro interno ao enviar emails.' });
  }
};

// Aprovação de pagamento (novo/integrado)
const approvePayment = async (req, res) => {
  const { paymentId } = req.params;
  const adminId = req.user?.id || '00000000-0000-0000-0000-000000000000';

  try {
    // 1. Get payment details
    const paymentRes = await pool.query(
      "SELECT p.*, u.email, u.name as user_name FROM payment_approvals p JOIN users u ON p.user_id = u.id WHERE p.id = $1", 
      [paymentId]
    );

    if (paymentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Pagamento não encontrado.' });
    }

    const payment = paymentRes.rows[0];
    if (payment.status !== 'pending') {
      return res.status(400).json({ error: 'Pagamento já processado.' });
    }

    // 2. Update payment status
    await pool.query("UPDATE payment_approvals SET status = 'approved', approved_by = $1, approved_at = NOW() WHERE id = $2", [adminId, paymentId]);

    // 3. Update user plan and expiry date
    // Calculate new expiry date based on plan
    let interval = '1 year'; // Default (anual)
    if (payment.plan_type === 'semestral') {
      interval = '6 months';
    }

    await pool.query(`
      UPDATE users 
      SET 
        plan_type = 'premium',
        plan_expires_at = GREATEST(NOW(), COALESCE(plan_expires_at, NOW())) + INTERVAL '${interval}'
      WHERE id = $1
    `, [payment.user_id]);

    // 4. Send email
    try {
      await sendPaymentApproved(payment.email, payment.user_name, payment.plan_type);
    } catch (e) {
      console.error('Erro ao enviar email de pagamento aprovado:', e);
      // Não bloqueia a transação
    }

    res.json({ message: 'Pagamento aprovado e plano atualizado!' });
  } catch (error) {
    console.error('Erro ao aprovar pagamento:', error);
    res.status(500).json({ error: 'Erro ao aprovar pagamento.' });
  }
};

module.exports = {
  getDashboardStats,
  getAllUsers,
  getLogs,
  sendPromotions,
  approvePayment
};
