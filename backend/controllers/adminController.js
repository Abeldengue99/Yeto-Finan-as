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
      SELECT id, name, email, email_verified, plan_type, subscription_plan, status, occupation, created_at, plan_expires_at
      FROM users
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar utilizadores:', error);
    res.status(500).json({ error: 'Erro ao buscar utilizadores.' });
  }
};

const updateUserStatus = async (req, res) => {
  const { userId } = req.params;
  const { status } = req.body;
  const adminId = req.user?.id || FALLBACK_ADMIN_ID;

  if (!['active', 'blocked'].includes(status)) {
    return res.status(400).json({ error: 'Estado inválido.' });
  }

  try {
    const currentRes = await pool.query('SELECT id, name, email, plan_type FROM users WHERE id = $1', [userId]);
    const target = currentRes.rows[0];

    if (!target) {
      return res.status(404).json({ error: 'Utilizador não encontrado.' });
    }

    if (target.plan_type === 'admin') {
      return res.status(403).json({ error: 'Não é permitido bloquear uma conta administrativa.' });
    }

    const result = await pool.query(
      `UPDATE users
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, name, email, email_verified, plan_type, subscription_plan, status, occupation, created_at, plan_expires_at`,
      [status, userId]
    );

    await pool.query(
      'INSERT INTO admin_logs (admin_id, action_type, description) VALUES ($1, $2, $3)',
      [adminId, status === 'blocked' ? 'user_blocked' : 'user_unblocked', `${status === 'blocked' ? 'Bloqueou' : 'Ativou'} a conta de ${target.name || target.email}`]
    );

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Erro ao atualizar estado do utilizador:', error);
    res.status(500).json({ error: 'Erro ao atualizar estado do utilizador.' });
  }
};

const grantUserPremium = async (req, res) => {
  const { userId } = req.params;
  const adminId = req.user?.id || FALLBACK_ADMIN_ID;

  try {
    const currentRes = await pool.query('SELECT id, name, email, plan_type FROM users WHERE id = $1', [userId]);
    const target = currentRes.rows[0];

    if (!target) {
      return res.status(404).json({ error: 'Utilizador não encontrado.' });
    }

    if (target.plan_type === 'admin') {
      return res.status(403).json({ error: 'Esta ação não se aplica a contas administrativas.' });
    }

    const result = await pool.query(
      `UPDATE users
       SET
         plan_type = 'premium',
         subscription_plan = 'anual',
         status = 'active',
         plan_expires_at = GREATEST(NOW(), COALESCE(plan_expires_at, NOW())) + INTERVAL '30 days',
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, name, email, email_verified, plan_type, subscription_plan, status, occupation, created_at, plan_expires_at`,
      [userId]
    );

    await pool.query(
      'INSERT INTO admin_logs (admin_id, action_type, description) VALUES ($1, $2, $3)',
      [adminId, 'user_premium_granted', `Concedeu Premium manual a ${target.name || target.email}`]
    );

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Erro ao conceder premium:', error);
    res.status(500).json({ error: 'Erro ao conceder Premium.' });
  }
};

const deleteUser = async (req, res) => {
  const { userId } = req.params;
  const adminId = req.user?.id || FALLBACK_ADMIN_ID;

  if (userId === req.user?.id) {
    return res.status(400).json({ error: 'Não pode eliminar a sua própria conta administrativa.' });
  }

  try {
    const currentRes = await pool.query('SELECT id, name, email, plan_type FROM users WHERE id = $1', [userId]);
    const target = currentRes.rows[0];

    if (!target) {
      return res.status(404).json({ error: 'Utilizador não encontrado.' });
    }

    if (target.plan_type === 'admin') {
      return res.status(403).json({ error: 'Não é permitido eliminar uma conta administrativa.' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [userId]);

    await pool.query(
      'INSERT INTO admin_logs (admin_id, action_type, description) VALUES ($1, $2, $3)',
      [adminId, 'user_deleted', `Eliminou a conta de ${target.name || target.email}`]
    );

    res.json({ message: 'Utilizador eliminado com sucesso.' });
  } catch (error) {
    console.error('Erro ao eliminar utilizador:', error);
    res.status(500).json({ error: 'Erro ao eliminar utilizador.' });
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
      SELECT *
      FROM (
        SELECT
          l.id::text AS id,
          l.action_type,
          l.description,
          l.created_at,
          u.name AS admin_name
        FROM admin_logs l
        LEFT JOIN users u ON l.admin_id = u.id

        UNION ALL

        SELECT
          ('user-' || u.id::text) AS id,
          'user_created' AS action_type,
          'Nova conta criada: ' || COALESCE(u.name, u.email) AS description,
          u.created_at,
          NULL AS admin_name
        FROM users u
        WHERE u.plan_type != 'admin'

        UNION ALL

        SELECT
          ('payment-' || p.id::text) AS id,
          CASE
            WHEN p.status = 'approved' THEN 'payment_approved'
            WHEN p.status = 'rejected' THEN 'payment_rejected'
            ELSE 'payment_pending'
          END AS action_type,
          CASE
            WHEN p.status = 'approved' THEN 'Pagamento aprovado'
            WHEN p.status = 'rejected' THEN 'Pagamento rejeitado'
            ELSE 'Comprovativo recebido'
          END || ' (' || COALESCE(p.plan_requested, 'anual') || ') de ' || COALESCE(u.name, u.email, 'utilizador') AS description,
          p.submitted_at AS created_at,
          NULL AS admin_name
        FROM payment_approvals p
        LEFT JOIN users u ON p.user_id = u.id

        UNION ALL

        SELECT
          ('assistant-' || m.id::text) AS id,
          'assistant_message' AS action_type,
          CASE
            WHEN m.sender_role = 'user' THEN 'Nova mensagem do utilizador no Assistente: '
            ELSE 'Resposta enviada pelo admin no Assistente: '
          END || COALESCE(u.name, 'Utilizador') AS description,
          m.created_at,
          NULL AS admin_name
        FROM support_messages m
        LEFT JOIN users u ON m.sender_id = u.id
      ) activity
      ORDER BY created_at DESC
      LIMIT 80
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
        subscription_plan = $3,
        plan_expires_at = GREATEST(NOW(), COALESCE(plan_expires_at, NOW())) + ($2::int * INTERVAL '1 month'),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, name, email, plan_type, subscription_plan, plan_expires_at
    `, [payment.user_id, monthsToAdd, requestedPlan]);

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
  updateUserStatus,
  grantUserPremium,
  deleteUser,
  sendPromotions,
  approvePayment,
  rejectPayment
};
