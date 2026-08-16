const pool = require('../config/database');
const { sendMassPromotion, sendPaymentApproved } = require('../services/emailService');

const FALLBACK_ADMIN_ID = '00000000-0000-0000-0000-000000000000';

const getDashboardStats = async (req, res) => {
  try {
    const usersStatsRes = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE plan_type != 'admin')::int AS total_users,
        COUNT(*) FILTER (
          WHERE plan_type = 'premium'
            AND (plan_expires_at IS NULL OR plan_expires_at > NOW())
        )::int AS active_subscriptions,
        COUNT(*) FILTER (WHERE status = 'blocked')::int AS blocked_users,
        COUNT(*) FILTER (
          WHERE plan_type != 'admin'
            AND plan_expires_at IS NOT NULL
            AND plan_expires_at <= NOW()
        )::int AS expired_users,
        COUNT(*) FILTER (
          WHERE plan_type != 'admin'
            AND plan_expires_at IS NOT NULL
            AND plan_expires_at > NOW()
            AND plan_expires_at <= NOW() + INTERVAL '7 days'
        )::int AS expiring_soon,
        COUNT(*) FILTER (
          WHERE plan_type != 'admin'
            AND created_at >= NOW() - INTERVAL '7 days'
        )::int AS new_users_7d,
        COUNT(*) FILTER (
          WHERE plan_type != 'admin'
            AND created_at >= CURRENT_DATE
        )::int AS new_users_today
      FROM users
    `);
    const userStats = usersStatsRes.rows[0] || {};

    const pendingPaymentsRes = await pool.query("SELECT COUNT(*)::int AS count FROM payment_approvals WHERE status = 'pending'");
    const pendingApprovals = Number(pendingPaymentsRes.rows[0]?.count || 0);

    let assistantUnread = 0;
    try {
      const assistantUnreadRes = await pool.query(`
        SELECT COUNT(*)::int AS count
        FROM support_messages
        WHERE sender_role = 'user'
          AND read_at IS NULL
      `);
      assistantUnread = Number(assistantUnreadRes.rows[0]?.count || 0);
    } catch (supportError) {
      console.warn('Métrica do assistente indisponível:', supportError.message);
    }

    const mrrRes = await pool.query("SELECT value FROM system_settings WHERE key = 'premium_price'");
    const premiumPrice = mrrRes.rows.length > 0 ? Number(mrrRes.rows[0].value) : 5999;
    const totalUsers = Number(userStats.total_users || 0);
    const activeSubscriptions = Number(userStats.active_subscriptions || 0);
    const monthlyRevenue = activeSubscriptions * premiumPrice;
    const conversionRate = totalUsers > 0 ? Number(((activeSubscriptions / totalUsers) * 100).toFixed(1)) : 0;

    res.json({
      totalUsers,
      pendingApprovals,
      activeSubscriptions,
      monthlyRevenue,
      conversionRate,
      blockedUsers: Number(userStats.blocked_users || 0),
      expiredUsers: Number(userStats.expired_users || 0),
      expiringSoon: Number(userStats.expiring_soon || 0),
      newUsers7d: Number(userStats.new_users_7d || 0),
      newUsersToday: Number(userStats.new_users_today || 0),
      assistantUnread
    });
  } catch (error) {
    console.error('Erro ao buscar stats admin:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas.' });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, email, plan_type, status, occupation, created_at, plan_expires_at
      FROM users
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar utilizadores:', error);
    res.status(500).json({ error: 'Erro ao buscar utilizadores.' });
  }
};

const getPendingPayments = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        p.id,
        p.user_id,
        p.plan_requested,
        p.proof_image,
        p.status,
        p.submitted_at,
        u.name AS user_name,
        u.email AS user_email
      FROM payment_approvals p
      JOIN users u ON p.user_id = u.id
      WHERE p.status = 'pending'
      ORDER BY p.submitted_at ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar pagamentos pendentes:', error);
    res.status(500).json({ error: 'Erro ao buscar pagamentos pendentes.' });
  }
};

const getLogs = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.id, l.action_type, l.description, l.created_at, u.name AS admin_name
      FROM admin_logs l
      LEFT JOIN users u ON l.admin_id = u.id
      ORDER BY l.created_at DESC
      LIMIT 50
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar logs:', error);
    res.status(500).json({ error: 'Erro ao buscar logs.' });
  }
};

const sendPromotions = async (req, res) => {
  const { subject, htmlContent } = req.body;
  const adminId = req.user?.id || FALLBACK_ADMIN_ID;

  try {
    if (!subject || !htmlContent) {
      return res.status(400).json({ error: 'Assunto e conteúdo são obrigatórios.' });
    }

    const usersRes = await pool.query("SELECT email, name FROM users WHERE email_verified = TRUE");

    if (usersRes.rows.length === 0) {
      return res.status(400).json({ error: 'Não existem utilizadores com email verificado.' });
    }

    const result = await sendMassPromotion(usersRes.rows, subject, htmlContent);

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

const approvePayment = async (req, res) => {
  const { paymentId } = req.params;
  const adminId = req.user?.id || FALLBACK_ADMIN_ID;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const paymentRes = await client.query(
      `SELECT p.*, u.email, u.name AS user_name
       FROM payment_approvals p
       JOIN users u ON p.user_id = u.id
       WHERE p.id = $1`,
      [paymentId]
    );

    if (paymentRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pagamento não encontrado.' });
    }

    const payment = paymentRes.rows[0];
    if (payment.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Pagamento já processado.' });
    }

    const requestedPlan = payment.plan_requested === 'semestral' ? 'semestral' : 'anual';
    const monthsToAdd = requestedPlan === 'semestral' ? 6 : 12;

    await client.query(
      "UPDATE payment_approvals SET status = 'approved', approved_by = $1, approved_at = NOW(), notified_user = false WHERE id = $2",
      [adminId, paymentId]
    );

    const updatedUser = await client.query(`
      UPDATE users
      SET
        plan_type = 'premium',
        plan_expires_at = GREATEST(NOW(), COALESCE(plan_expires_at, NOW())) + ($2::int * INTERVAL '1 month'),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, name, email, plan_type, plan_expires_at
    `, [payment.user_id, monthsToAdd]);

    await client.query(
      "INSERT INTO admin_logs (admin_id, action_type, description) VALUES ($1, $2, $3)",
      [adminId, 'payment_approved', `Aprovou pagamento ${requestedPlan} de ${payment.user_name}`]
    );

    await client.query('COMMIT');

    try {
      await sendPaymentApproved(payment.email, payment.user_name, requestedPlan === 'anual' ? 'annual' : 'semestral');
    } catch (emailError) {
      console.error('Erro ao enviar email de pagamento aprovado:', emailError);
    }

    res.json({ message: 'Pagamento aprovado e plano atualizado!', user: updatedUser.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao aprovar pagamento:', error);
    res.status(500).json({ error: 'Erro ao aprovar pagamento.' });
  } finally {
    client.release();
  }
};

const rejectPayment = async (req, res) => {
  const { paymentId } = req.params;
  const adminId = req.user?.id || FALLBACK_ADMIN_ID;

  try {
    const result = await pool.query(
      "UPDATE payment_approvals SET status = 'rejected', rejected_by = $1, rejected_at = NOW(), notified_user = false WHERE id = $2 AND status = 'pending' RETURNING id",
      [adminId, paymentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pagamento pendente não encontrado.' });
    }

    await pool.query(
      "INSERT INTO admin_logs (admin_id, action_type, description) VALUES ($1, $2, $3)",
      [adminId, 'payment_rejected', `Rejeitou o comprovativo ${paymentId}`]
    );

    res.json({ message: 'Pagamento rejeitado.' });
  } catch (error) {
    console.error('Erro ao rejeitar pagamento:', error);
    res.status(500).json({ error: 'Erro ao rejeitar pagamento.' });
  }
};

module.exports = {
  getDashboardStats,
  getAllUsers,
  getPendingPayments,
  getLogs,
  sendPromotions,
  approvePayment,
  rejectPayment
};
