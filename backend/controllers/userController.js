const pool = require('../config/database');
const bcrypt = require('bcrypt');

function cleanText(value, maxLength = 120) {
  return String(value || '').trim().slice(0, maxLength);
}

const updateProfile = async (req, res) => {
  const { userId, name, occupation, avatar_url, newPassword, gender, province, municipality, city } = req.body;

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Utilizador não encontrado.' });
    }

    const currentUser = userResult.rows[0];
    const queryParams = [
      cleanText(name || currentUser.name),
      cleanText(occupation),
      avatar_url || '',
      cleanText(gender, 40),
      cleanText(province, 80),
      cleanText(municipality, 80),
      cleanText(city, 80)
    ];

    let updateQuery = `
      UPDATE users
      SET name = $1,
          occupation = $2,
          avatar_url = $3,
          gender = $4,
          province = $5,
          municipality = $6,
          city = $7,
          updated_at = CURRENT_TIMESTAMP
    `;

    if (newPassword && newPassword.trim() !== '') {
      const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{10,}$/;
      if (!passwordRegex.test(newPassword)) {
        return res.status(400).json({ error: 'A senha deve ter pelo menos 10 caracteres, incluir uma letra, um número e um caractere especial.' });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      updateQuery += `, password_hash = $${queryParams.length + 1}`;
      queryParams.push(hashedPassword);
    }

    updateQuery += ` WHERE id = $${queryParams.length + 1}
      RETURNING id, name, email, email_verified, occupation, avatar_url,
        gender, province, municipality, city,
        last_login_at, last_login_ip, last_login_device,
        plan_type, subscription_plan, created_at, plan_expires_at`;
    queryParams.push(userId);

    const result = await pool.query(updateQuery, queryParams);
    const deviceCount = await pool.query('SELECT COUNT(*)::int AS count FROM user_devices WHERE user_id = $1', [userId]);

    res.status(200).json({
      message: 'Perfil atualizado com sucesso!',
      user: {
        ...result.rows[0],
        device_count: deviceCount.rows[0]?.count || 0
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    res.status(500).json({ error: 'Erro no servidor ao atualizar o perfil.' });
  }
};

module.exports = {
  updateProfile
};
