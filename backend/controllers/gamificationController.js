const pool = require('../config/database');

const redeemPremium = async (req, res) => {
  const { userId } = req.body;
  const PREMIUM_COST = 2000; // Custo em YetoPoints para 1 mês de premium

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Buscar utilizador
    const userRes = await client.query('SELECT yeto_points, plan_type, plan_expires_at FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) throw new Error('Utilizador não encontrado.');
    const user = userRes.rows[0];

    if (user.yeto_points < PREMIUM_COST) {
      throw new Error(`Pontos insuficientes. São necessários ${PREMIUM_COST} pontos.`);
    }

    // Deduzir pontos e atualizar plano
    const updatedUserRes = await client.query(
      `UPDATE users SET
        yeto_points = yeto_points - $1,
        plan_type = 'premium',
        plan_expires_at = GREATEST(NOW(), COALESCE(plan_expires_at, NOW())) + INTERVAL '1 month',
        updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 RETURNING id, yeto_points, plan_type, plan_expires_at`,
      [PREMIUM_COST, userId]
    );

    // Registar log (opcional, como é o próprio sistema a fazer, pode não precisar de admin_logs, mas vamos colocar para auditoria)
    await client.query(
      `INSERT INTO admin_logs (action_type, description) VALUES ($1, $2)`,
      ['info', `Utilizador ${userId} resgatou um mês Premium com YetoPoints.`]
    );

    await client.query('COMMIT');
    res.status(200).json({ 
      success: true, 
      message: 'Plano Premium ativado com sucesso!',
      user: updatedUserRes.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao resgatar premium:', error);
    res.status(400).json({ error: error.message || 'Erro ao resgatar recompensa.' });
  } finally {
    client.release();
  }
};

module.exports = {
  redeemPremium
};
