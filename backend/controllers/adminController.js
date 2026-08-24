const pool = require('../config/database');
const { sendMassPromotion, sendPaymentApproved, sendVerificationCode } = require('../services/emailService');
const { createUserNotification } = require('../services/notificationService');
const { ensureGamificationSchema } = require('../services/gamificationService');
const {
  ensureFeatureAccessSchema,
  getActiveFeatureKeys,
  grantFeatureAccess,
  normalizeDurationMonths,
  normalizeFeatureKeys
} = require('../services/featureAccessService');

const FALLBACK_ADMIN_ID = '00000000-0000-0000-0000-000000000000';

const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();
const ADMIN_PERMISSION_KEYS = ['dashboard', 'users', 'payments', 'assistant', 'reports', 'settings', 'marketing'];
const ADMIN_PERMISSION_LABELS = {
  dashboard: 'Visao Geral',
  users: 'Utilizadores',
  payments: 'Pagamentos',
  assistant: 'Assistente',
  reports: 'Relatorios',
  settings: 'Definicoes',
  marketing: 'Marketing'
};
const ADMIN_PERMISSION_TABS = {
  dashboard: 'admin_dashboard',
  users: 'admin_users',
  payments: 'admin_payments',
  assistant: 'assistente',
  reports: 'admin_logs',
  settings: 'admin_settings',
  marketing: 'admin_settings'
};

let adminPermissionsReady = false;
let paymentReviewFieldsReady = false;

const ensureAdminPermissionsTable = async (db = pool) => {
  if (adminPermissionsReady) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS admin_permissions (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
      granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  await db.query('CREATE INDEX IF NOT EXISTS idx_admin_permissions_granted_by ON admin_permissions(granted_by)');
  adminPermissionsReady = true;
};

const normalizeAdminPermissions = (permissions = {}) => {
  const source = Array.isArray(permissions)
    ? permissions.reduce((acc, key) => ({ ...acc, [key]: true }), {})
    : permissions;

  return ADMIN_PERMISSION_KEYS.reduce((acc, key) => {
    acc[key] = Boolean(source?.[key]);
    return acc;
  }, {});
};

const hasDelegatedArea = (permissions) => (
  ADMIN_PERMISSION_KEYS.some(key => key !== 'dashboard' && Boolean(permissions[key]))
);

const ensurePaymentReviewFields = async (db = pool) => {
  if (paymentReviewFieldsReady) return;

  await db.query('ALTER TABLE payment_approvals ADD COLUMN IF NOT EXISTS rejection_reason TEXT');
  await ensureFeatureAccessSchema(db);
  paymentReviewFieldsReady = true;
};

const selectAdminUserById = async (userId) => {
  await ensureAdminPermissionsTable();
  const result = await pool.query(`
    SELECT
      u.id,
      u.name,
      u.email,
      u.email_verified,
      u.avatar_url,
      u.plan_type,
      u.subscription_plan,
      u.status,
      u.occupation,
      u.gender,
      u.province,
      u.municipality,
      u.city,
      u.created_at,
      u.plan_expires_at,
      u.last_login_at,
      u.last_login_ip,
      u.last_login_device,
      u.last_login_user_agent,
      u.updated_at,
      COALESCE(ap.permissions, '{}'::jsonb) AS admin_permissions,
      ap.created_at AS admin_granted_at,
      ap.updated_at AS admin_permissions_updated_at,
      grantor.name AS admin_granted_by_name,
      COUNT(d.id)::int AS device_count,
      MAX(d.last_seen_at) AS last_device_seen_at
    FROM users u
    LEFT JOIN user_devices d ON d.user_id = u.id
    LEFT JOIN admin_permissions ap ON ap.user_id = u.id
    LEFT JOIN users grantor ON grantor.id = ap.granted_by
    WHERE u.id = $1
    GROUP BY u.id, ap.permissions, ap.created_at, ap.updated_at, grantor.name
  `, [userId]);

  return result.rows[0] || null;
};

const getDashboardStats = async (req, res) => {
  try {
    const usersStatsRes = await pool.query(`
      SELECT
        COUNT(*)::int AS total_users,
        COUNT(*) FILTER (WHERE plan_type = 'admin')::int AS admin_users,
        COUNT(*) FILTER (WHERE plan_type != 'admin')::int AS regular_users,
        COUNT(*) FILTER (
          WHERE plan_type IN ('premium', 'custom')
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
          WHERE created_at >= NOW() - INTERVAL '7 days'
        )::int AS new_users_7d,
        COUNT(*) FILTER (
          WHERE created_at >= CURRENT_DATE
        )::int AS new_users_today,
        COUNT(*) FILTER (
          WHERE email_verified IS TRUE
        )::int AS verified_users,
        COUNT(*) FILTER (
          WHERE COALESCE(email_verified, FALSE) = FALSE
        )::int AS unverified_users
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
    const regularUsers = Number(userStats.regular_users || 0);
    const activeSubscriptions = Number(userStats.active_subscriptions || 0);
    const monthlyRevenue = activeSubscriptions * premiumPrice;
    const conversionRate = regularUsers > 0 ? Number(((activeSubscriptions / regularUsers) * 100).toFixed(1)) : 0;

    res.json({
      totalUsers,
      adminUsers: Number(userStats.admin_users || 0),
      regularUsers,
      pendingApprovals,
      activeSubscriptions,
      monthlyRevenue,
      conversionRate,
      blockedUsers: Number(userStats.blocked_users || 0),
      expiredUsers: Number(userStats.expired_users || 0),
      expiringSoon: Number(userStats.expiring_soon || 0),
      newUsers7d: Number(userStats.new_users_7d || 0),
      newUsersToday: Number(userStats.new_users_today || 0),
      verifiedUsers: Number(userStats.verified_users || 0),
      unverifiedUsers: Number(userStats.unverified_users || 0),
      assistantUnread
    });
  } catch (error) {
    console.error('Erro ao buscar stats admin:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas.' });
  }
};

const getAllUsers = async (req, res) => {
  try {
    await ensureAdminPermissionsTable();
    const result = await pool.query(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.email_verified,
        u.avatar_url,
        u.plan_type,
        u.subscription_plan,
        u.status,
        u.occupation,
        u.gender,
        u.province,
        u.municipality,
        u.city,
        u.created_at,
        u.plan_expires_at,
        u.last_login_at,
        u.last_login_ip,
        u.last_login_device,
        u.last_login_user_agent,
        u.updated_at,
        COALESCE(ap.permissions, '{}'::jsonb) AS admin_permissions,
        ap.created_at AS admin_granted_at,
        ap.updated_at AS admin_permissions_updated_at,
        grantor.name AS admin_granted_by_name,
        COUNT(d.id)::int AS device_count,
        MAX(d.last_seen_at) AS last_device_seen_at
      FROM users u
      LEFT JOIN user_devices d ON d.user_id = u.id
      LEFT JOIN admin_permissions ap ON ap.user_id = u.id
      LEFT JOIN users grantor ON grantor.id = ap.granted_by
      GROUP BY u.id, ap.permissions, ap.created_at, ap.updated_at, grantor.name
      ORDER BY u.created_at DESC
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
      [adminId, status === 'blocked' ? 'danger' : 'success', `${status === 'blocked' ? 'Bloqueou' : 'Ativou'} a conta de ${target.name || target.email}`]
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
      [adminId, 'success', `Concedeu Premium manual a ${target.name || target.email}`]
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
      [adminId, 'danger', `Eliminou a conta de ${target.name || target.email}`]
    );

    res.json({ message: 'Utilizador eliminado com sucesso.' });
  } catch (error) {
    console.error('Erro ao eliminar utilizador:', error);
    res.status(500).json({ error: 'Erro ao eliminar utilizador.' });
  }
};

const resendUserVerification = async (req, res) => {
  const { userId } = req.params;
  const adminId = req.user?.id || FALLBACK_ADMIN_ID;

  try {
    const result = await pool.query('SELECT id, name, email, email_verified FROM users WHERE id = $1', [userId]);
    const target = result.rows[0];

    if (!target) {
      return res.status(404).json({ error: 'Utilizador nÃ£o encontrado.' });
    }

    if (target.email_verified) {
      return res.status(400).json({ error: 'Este utilizador jÃ¡ verificou o email.' });
    }

    const code = generateCode();
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await pool.query(
      'UPDATE users SET verification_code = $1, verification_expires = $2 WHERE id = $3',
      [code, expires, target.id]
    );

    await sendVerificationCode(target.email, target.name, code);

    await pool.query(
      'INSERT INTO admin_logs (admin_id, action_type, description) VALUES ($1, $2, $3)',
      [adminId, 'success', `Reenviou código de verificação para ${target.name || target.email}`]
    );

    res.json({ message: 'Código de verificação reenviado com sucesso.' });
  } catch (error) {
    console.error('Erro ao reenviar verificaÃ§Ã£o:', error);
    res.status(500).json({ error: 'Erro ao reenviar código de verificação.' });
  }
};

const remindUnverifiedUsers = async (req, res) => {
  const adminId = req.user?.id || FALLBACK_ADMIN_ID;

  try {
    const usersRes = await pool.query(`
      SELECT id, name, email
      FROM users
      WHERE plan_type != 'admin'
        AND status = 'active'
        AND COALESCE(email_verified, FALSE) = FALSE
      ORDER BY created_at DESC
    `);

    if (usersRes.rows.length === 0) {
      return res.json({ message: 'Nao existem utilizadores pendentes de verificacao.', sent: 0, failed: 0, total: 0 });
    }

    let sent = 0;
    let failed = 0;

    for (const user of usersRes.rows) {
      const code = generateCode();
      const expires = new Date(Date.now() + 15 * 60 * 1000);

      await pool.query(
        'UPDATE users SET verification_code = $1, verification_expires = $2 WHERE id = $3',
        [code, expires, user.id]
      );

      try {
        await sendVerificationCode(user.email, user.name || user.email, code);
        sent += 1;
      } catch (emailError) {
        failed += 1;
        console.error(`Erro ao enviar lembrete para ${user.email}:`, emailError.message);
      }
    }

    await pool.query(
      'INSERT INTO admin_logs (admin_id, action_type, description) VALUES ($1, $2, $3)',
      [adminId, 'success', `Enviou lembrete de verificacao para ${sent} utilizador(es) pendente(s).`]
    );

    res.json({
      message: failed > 0
        ? `Lembrete enviado para ${sent} utilizador(es). ${failed} falhou/falharam.`
        : `Lembrete enviado para ${sent} utilizador(es) nao verificado(s).`,
      sent,
      failed,
      total: usersRes.rows.length
    });
  } catch (error) {
    console.error('Erro ao enviar lembretes de verificacao:', error);
    res.status(500).json({ error: 'Erro ao enviar lembretes de verificacao.' });
  }
};

const grantAdminAccess = async (req, res) => {
  const { userId } = req.params;
  const adminId = req.user?.id || FALLBACK_ADMIN_ID;
  const permissions = normalizeAdminPermissions(req.body?.permissions);

  if (userId === adminId) {
    return res.status(400).json({ error: 'Nao pode alterar as suas proprias permissoes administrativas.' });
  }

  if (!hasDelegatedArea(permissions)) {
    return res.status(400).json({ error: 'Selecione pelo menos uma area administrativa para este utilizador.' });
  }

  const client = await pool.connect();

  try {
    await ensureAdminPermissionsTable(client);
    await client.query('BEGIN');

    const targetRes = await client.query(
      'SELECT id, name, email, email_verified FROM users WHERE id = $1',
      [userId]
    );
    const target = targetRes.rows[0];

    if (!target) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Utilizador nao encontrado.' });
    }

    if (!target.email_verified) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Este utilizador precisa verificar o email antes de receber acesso admin.' });
    }

    await client.query(`
      UPDATE users
      SET
        plan_type = 'admin',
        subscription_plan = 'admin',
        status = 'active',
        plan_expires_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [userId]);

    await client.query(`
      INSERT INTO admin_permissions (user_id, permissions, granted_by, created_at, updated_at)
      VALUES ($1, $2::jsonb, $3, NOW(), NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        permissions = EXCLUDED.permissions,
        granted_by = EXCLUDED.granted_by,
        updated_at = NOW()
    `, [userId, JSON.stringify(permissions), adminId]);

    const grantedAreas = ADMIN_PERMISSION_KEYS
      .filter(key => key !== 'dashboard' && permissions[key])
      .map(key => ADMIN_PERMISSION_LABELS[key]);
    const firstGrantedKey = ADMIN_PERMISSION_KEYS.find(key => key !== 'dashboard' && permissions[key]);

    await createUserNotification({
      userId,
      title: 'Permissoes administrativas atribuidas',
      message: `Recebeu acesso administrativo para: ${grantedAreas.join(', ')}.`,
      tab: ADMIN_PERMISSION_TABS[firstGrantedKey] || 'dashboard',
      type: 'success'
    }, client);

    await client.query(
      'INSERT INTO admin_logs (admin_id, action_type, description) VALUES ($1, $2, $3)',
      [adminId, 'success', `Atualizou permissoes administrativas de ${target.name || target.email}`]
    );

    await client.query('COMMIT');

    const user = await selectAdminUserById(userId);
    res.json({ message: 'Permissoes administrativas guardadas com sucesso.', user });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Erro ao guardar permissoes administrativas:', error);
    res.status(500).json({ error: 'Erro ao guardar permissoes administrativas.' });
  } finally {
    client.release();
  }
};

const revokeAdminAccess = async (req, res) => {
  const { userId } = req.params;
  const adminId = req.user?.id || FALLBACK_ADMIN_ID;

  if (userId === adminId || userId === FALLBACK_ADMIN_ID) {
    return res.status(400).json({ error: 'Nao pode remover este acesso administrativo.' });
  }

  const client = await pool.connect();

  try {
    await ensureAdminPermissionsTable(client);
    await client.query('BEGIN');

    const targetRes = await client.query(
      'SELECT id, name, email, plan_type FROM users WHERE id = $1',
      [userId]
    );
    const target = targetRes.rows[0];

    if (!target) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Utilizador nao encontrado.' });
    }

    const permissionRes = await client.query(
      'DELETE FROM admin_permissions WHERE user_id = $1 RETURNING user_id',
      [userId]
    );

    if (target.plan_type === 'admin' && permissionRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Esta conta parece ser admin principal e nao deve ser removida por aqui.' });
    }

    await client.query(`
      UPDATE users
      SET
        plan_type = 'free',
        subscription_plan = 'free',
        plan_expires_at = COALESCE(plan_expires_at, NOW() + INTERVAL '30 days'),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [userId]);

    await createUserNotification({
      userId,
      title: 'Acesso administrativo removido',
      message: 'As suas permissoes administrativas foram removidas. A sua conta voltou ao acesso normal.',
      tab: 'dashboard',
      type: 'warning'
    }, client);

    await client.query(
      'INSERT INTO admin_logs (admin_id, action_type, description) VALUES ($1, $2, $3)',
      [adminId, 'warning', `Removeu acesso administrativo de ${target.name || target.email}`]
    );

    await client.query('COMMIT');

    const user = await selectAdminUserById(userId);
    res.json({ message: 'Acesso administrativo removido com sucesso.', user });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Erro ao remover acesso administrativo:', error);
    res.status(500).json({ error: 'Erro ao remover acesso administrativo.' });
  } finally {
    client.release();
  }
};

const getPendingPayments = async (req, res) => {
  try {
    await ensurePaymentReviewFields();
    const result = await pool.query(`
      SELECT
        p.id,
        p.user_id,
        p.plan_requested,
        p.selected_features,
        p.custom_amount,
        p.custom_duration_months,
        p.proof_image,
        p.status,
        p.rejection_reason,
        p.submitted_at,
        p.approved_at,
        p.rejected_at,
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

const getPayments = async (req, res) => {
  try {
    await ensurePaymentReviewFields();
    const result = await pool.query(`
      SELECT
        p.id,
        p.user_id,
        p.plan_requested,
        p.selected_features,
        p.custom_amount,
        p.custom_duration_months,
        p.proof_image,
        p.status,
        p.rejection_reason,
        p.submitted_at,
        p.approved_at,
        p.rejected_at,
        approver.name AS approved_by_name,
        rejector.name AS rejected_by_name,
        u.name AS user_name,
        u.email AS user_email
      FROM payment_approvals p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN users approver ON approver.id = p.approved_by
      LEFT JOIN users rejector ON rejector.id = p.rejected_by
      ORDER BY p.submitted_at DESC
      LIMIT 500
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar pagamentos:', error);
    res.status(500).json({ error: 'Erro ao buscar pagamentos.' });
  }
};

const getLogs = async (req, res) => {
  try {
    await ensureGamificationSchema();

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

        UNION ALL

        SELECT
          ('sync-' || s.id::text) AS id,
          'sync_failed' AS action_type,
          'Falha de sincronização offline em ' || COALESCE(s.resource, 'recurso') ||
            CASE WHEN u.email IS NOT NULL THEN ' de ' || COALESCE(u.name, u.email) ELSE '' END ||
            CASE WHEN s.error_message IS NOT NULL THEN ': ' || s.error_message ELSE '' END AS description,
          s.created_at,
          NULL AS admin_name
        FROM sync_events s
        LEFT JOIN users u ON s.user_id = u.id
        WHERE s.status != 'synced'

        UNION ALL

        SELECT
          ('gamification-' || g.id::text) AS id,
          'gamification_event' AS action_type,
          'Gamificação: ' || COALESCE(g.title, g.action_key) || ' de ' || COALESCE(u.name, u.email, 'utilizador') ||
            CASE
              WHEN g.points >= 0 THEN ' (+' || g.points::text || ' pontos)'
              ELSE ' (' || g.points::text || ' pontos)'
            END AS description,
          g.created_at,
          NULL AS admin_name
        FROM gamification_events g
        LEFT JOIN users u ON g.user_id = u.id
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

const getGamificationReport = async (req, res) => {
  try {
    await ensureGamificationSchema();

    const [statsRes, topUsersRes, eventsRes, actionsRes] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)::int AS total_events,
          COUNT(DISTINCT user_id)::int AS active_users,
          COALESCE(SUM(points) FILTER (WHERE points > 0), 0)::int AS points_awarded,
          COALESCE(SUM(ABS(points)) FILTER (WHERE points < 0), 0)::int AS points_redeemed,
          COUNT(*) FILTER (WHERE action_key = 'redeem_premium_month')::int AS premium_redemptions,
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int AS events_today,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS events_7d
        FROM gamification_events
      `),
      pool.query(`
        SELECT
          u.id,
          u.name,
          u.email,
          u.gender,
          u.province,
          COALESCE(u.yeto_points, 0)::int AS yeto_points,
          COALESCE(SUM(g.points) FILTER (WHERE g.points > 0), 0)::int AS earned_points,
          COALESCE(SUM(ABS(g.points)) FILTER (WHERE g.points < 0), 0)::int AS redeemed_points,
          COUNT(g.id)::int AS events_count,
          MAX(g.created_at) AS last_event_at
        FROM users u
        LEFT JOIN gamification_events g ON g.user_id = u.id
        WHERE u.plan_type != 'admin'
        GROUP BY u.id, u.name, u.email, u.gender, u.province, u.yeto_points
        HAVING COUNT(g.id) > 0 OR COALESCE(u.yeto_points, 0) > 0
        ORDER BY COALESCE(u.yeto_points, 0) DESC, earned_points DESC, events_count DESC
        LIMIT 30
      `),
      pool.query(`
        SELECT
          g.id,
          g.user_id,
          g.action_key,
          g.source_type,
          g.source_id,
          g.period_key,
          g.points,
          g.title,
          g.description,
          g.created_at,
          u.name AS user_name,
          u.email AS user_email,
          u.gender,
          u.province
        FROM gamification_events g
        JOIN users u ON u.id = g.user_id
        ORDER BY g.created_at DESC
        LIMIT 500
      `),
      pool.query(`
        SELECT
          action_key,
          COUNT(*)::int AS total_events,
          COALESCE(SUM(points), 0)::int AS net_points,
          COALESCE(SUM(points) FILTER (WHERE points > 0), 0)::int AS earned_points,
          COALESCE(SUM(ABS(points)) FILTER (WHERE points < 0), 0)::int AS redeemed_points
        FROM gamification_events
        GROUP BY action_key
        ORDER BY total_events DESC, earned_points DESC
      `)
    ]);

    const stats = statsRes.rows[0] || {};

    res.json({
      stats: {
        totalEvents: Number(stats.total_events || 0),
        activeUsers: Number(stats.active_users || 0),
        pointsAwarded: Number(stats.points_awarded || 0),
        pointsRedeemed: Number(stats.points_redeemed || 0),
        premiumRedemptions: Number(stats.premium_redemptions || 0),
        eventsToday: Number(stats.events_today || 0),
        events7d: Number(stats.events_7d || 0)
      },
      topUsers: topUsersRes.rows.map(user => ({
        id: user.id,
        nome: user.name || 'Utilizador',
        email: user.email,
        genero: user.gender || '',
        provincia: user.province || '',
        pontosAtuais: Number(user.yeto_points || 0),
        pontosGanhos: Number(user.earned_points || 0),
        pontosResgatados: Number(user.redeemed_points || 0),
        totalEventos: Number(user.events_count || 0),
        ultimoEventoRaw: user.last_event_at
      })),
      events: eventsRes.rows.map(event => ({
        id: event.id,
        userId: event.user_id,
        nome: event.user_name || 'Utilizador',
        email: event.user_email,
        genero: event.gender || '',
        provincia: event.province || '',
        actionKey: event.action_key,
        acao: event.title || event.action_key,
        descricao: event.description || '',
        pontos: Number(event.points || 0),
        tipoOrigem: event.source_type || '',
        idOrigem: event.source_id || '',
        periodo: event.period_key || '',
        dataRaw: event.created_at
      })),
      actions: actionsRes.rows.map(action => ({
        actionKey: action.action_key,
        totalEventos: Number(action.total_events || 0),
        pontosLiquidos: Number(action.net_points || 0),
        pontosGanhos: Number(action.earned_points || 0),
        pontosResgatados: Number(action.redeemed_points || 0)
      }))
    });
  } catch (error) {
    console.error('Erro ao buscar relatório de gamificação:', error);
    res.status(500).json({ error: 'Erro ao carregar relatório de gamificação.' });
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
      [adminId, 'success', `Enviou email promocional para ${result.sent} utilizadores: ${subject}`]
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
    await ensurePaymentReviewFields(client);
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

    const requestedPlan = payment.plan_requested === 'personalizado'
      ? 'personalizado'
      : payment.plan_requested === 'semestral'
        ? 'semestral'
        : 'anual';
    const selectedFeatures = normalizeFeatureKeys(payment.selected_features || []);
    const customDurationMonths = normalizeDurationMonths(payment.custom_duration_months || 1);

    if (requestedPlan === 'personalizado' && selectedFeatures.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Este plano personalizado não tem funcionalidades selecionadas.' });
    }

    await client.query(
      "UPDATE payment_approvals SET status = 'approved', approved_by = $1, approved_at = NOW(), notified_user = false WHERE id = $2",
      [adminId, paymentId]
    );

    let updatedUser;
    let activeFeatures = [];

    if (requestedPlan === 'personalizado') {
      updatedUser = await client.query(`
        UPDATE users
        SET
          plan_type = 'custom',
          subscription_plan = 'personalizado',
          plan_expires_at = GREATEST(NOW(), COALESCE(plan_expires_at, NOW())) + ($2::int * INTERVAL '1 month'),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, name, email, plan_type, subscription_plan, plan_expires_at
      `, [payment.user_id, customDurationMonths]);

      activeFeatures = await grantFeatureAccess({
        userId: payment.user_id,
        featureKeys: selectedFeatures,
        durationMonths: customDurationMonths,
        paymentId
      }, client);

      await createUserNotification({
        userId: payment.user_id,
        title: 'Plano personalizado aprovado',
        message: `O seu plano personalizado foi aprovado com ${activeFeatures.length} funcionalidade(s) ativa(s).`,
        tab: 'dashboard',
        type: 'success'
      }, client);
    } else {
      const monthsToAdd = requestedPlan === 'semestral' ? 6 : 12;
      updatedUser = await client.query(`
        UPDATE users
        SET
          plan_type = 'premium',
          subscription_plan = $3,
          plan_expires_at = GREATEST(NOW(), COALESCE(plan_expires_at, NOW())) + ($2::int * INTERVAL '1 month'),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, name, email, plan_type, subscription_plan, plan_expires_at
      `, [payment.user_id, monthsToAdd, requestedPlan]);
    }

    await client.query(
      "INSERT INTO admin_logs (admin_id, action_type, description) VALUES ($1, $2, $3)",
      [
        adminId,
        'success',
        requestedPlan === 'personalizado'
          ? `Aprovou plano personalizado de ${payment.user_name}: ${selectedFeatures.join(', ')}`
          : `Aprovou pagamento ${requestedPlan} de ${payment.user_name}`
      ]
    );

    await client.query('COMMIT');

    if (requestedPlan !== 'personalizado') {
      try {
        await sendPaymentApproved(payment.email, payment.user_name, requestedPlan === 'anual' ? 'annual' : 'semestral');
      } catch (emailError) {
        console.error('Erro ao enviar email de pagamento aprovado:', emailError);
      }
    }

    const responseUser = updatedUser.rows[0];
    responseUser.custom_features = requestedPlan === 'personalizado'
      ? activeFeatures
      : await getActiveFeatureKeys(payment.user_id);

    res.json({ message: 'Pagamento aprovado e plano atualizado!', user: responseUser });
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
      [adminId, 'danger', `Rejeitou o comprovativo ${paymentId}`]
    );

    res.json({ message: 'Pagamento rejeitado.' });
  } catch (error) {
    console.error('Erro ao rejeitar pagamento:', error);
    res.status(500).json({ error: 'Erro ao rejeitar pagamento.' });
  }
};

const rejectPaymentWithReason = async (req, res) => {
  const { paymentId } = req.params;
  const { reason } = req.body || {};
  const adminId = req.user?.id || FALLBACK_ADMIN_ID;
  const rejectionReason = String(reason || '').trim() || 'Comprovativo rejeitado. Por favor, confirme os dados e envie novamente.';
  const client = await pool.connect();

  try {
    await ensurePaymentReviewFields(client);
    await client.query('BEGIN');

    const paymentRes = await client.query(
      `SELECT p.*, u.email, u.name AS user_name
       FROM payment_approvals p
       JOIN users u ON p.user_id = u.id
       WHERE p.id = $1`,
      [paymentId]
    );

    const payment = paymentRes.rows[0];
    if (!payment || payment.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pagamento pendente nao encontrado.' });
    }

    const result = await client.query(
      `UPDATE payment_approvals
       SET status = 'rejected',
           rejected_by = $1,
           rejected_at = NOW(),
           rejection_reason = $2,
           notified_user = false
       WHERE id = $3
       RETURNING *`,
      [adminId, rejectionReason, paymentId]
    );

    await client.query(
      'INSERT INTO admin_logs (admin_id, action_type, description) VALUES ($1, $2, $3)',
      [adminId, 'danger', `Rejeitou comprovativo de ${payment.user_name || payment.email}: ${rejectionReason}`]
    );

    await client.query('COMMIT');

    res.json({ message: 'Pagamento rejeitado. O utilizador sera notificado dentro da plataforma.', payment: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Erro ao rejeitar pagamento:', error);
    res.status(500).json({ error: 'Erro ao rejeitar pagamento.' });
  } finally {
    client.release();
  }
};

module.exports = {
  getDashboardStats,
  getAllUsers,
  getPayments,
  getPendingPayments,
  getLogs,
  getGamificationReport,
  updateUserStatus,
  grantUserPremium,
  deleteUser,
  resendUserVerification,
  remindUnverifiedUsers,
  grantAdminAccess,
  revokeAdminAccess,
  sendPromotions,
  approvePayment,
  rejectPayment: rejectPaymentWithReason
};
