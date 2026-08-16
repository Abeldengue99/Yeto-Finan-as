const pool = require('../config/database');
const bcrypt = require('bcrypt');

const updateProfile = async (req, res) => {
  const { userId, name, occupation, avatar_url, newPassword } = req.body;

  try {
    // 1. Verificar se o user existe
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Utilizador não encontrado.' });
    }

    // 2. Construir a query dinamicamente
    let updateQuery = 'UPDATE users SET name = $1, occupation = $2, avatar_url = $3, updated_at = CURRENT_TIMESTAMP';
    let queryParams = [name, occupation, avatar_url || ''];

    // Se houver uma nova senha, também a atualiza
    if (newPassword && newPassword.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      updateQuery += ', password_hash = $4';
      queryParams.push(hashedPassword);
    }

    updateQuery += ` WHERE id = $${queryParams.length + 1} RETURNING id, name, email, occupation, avatar_url, plan_type, plan_expires_at`;
    queryParams.push(userId);

    const result = await pool.query(updateQuery, queryParams);
    
    res.status(200).json({
      message: 'Perfil atualizado com sucesso!',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    res.status(500).json({ error: 'Erro no servidor ao atualizar o perfil.' });
  }
};

module.exports = {
  updateProfile
};
