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

module.exports = {
  getDashboardStats,
  getAllUsers,
  getLogs
};
