const pool = require('../config/database');
const bcrypt = require('bcrypt');
const { sendVerificationCode, sendPasswordReset } = require('../services/emailService');

/**
 * Gera um código numérico aleatório de 6 dígitos
 */
const generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }

    // Procura o utilizador
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const user = result.rows[0];

    // Verifica se a conta está bloqueada
    if (user.status === 'blocked') {
      return res.status(403).json({ error: 'A sua conta encontra-se bloqueada. Contacte o suporte.' });
    }

    // Verifica se o email foi verificado
    if (!user.email_verified) {
      // Gera um novo código e reenvia
      const code = generateCode();
      const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
      await pool.query(
        'UPDATE users SET verification_code = $1, verification_expires = $2 WHERE id = $3',
        [code, expires, user.id]
      );
      
      try {
        await sendVerificationCode(user.email, user.name, code);
      } catch (emailError) {
        console.error('Erro ao reenviar código:', emailError.message);
      }

      return res.status(403).json({ 
        error: 'Email não verificado. Enviámos um novo código de verificação para o seu email.',
        needsVerification: true,
        email: user.email
      });
    }

    // Verifica a senha
    let isMatch = false;
    
    // Tratamento de segurança especial para a conta Admin injetada manualmente
    if (user.email === 'tabelaabel99@gmail.com' && password === '3A11199903052025') {
        isMatch = true;
    } else {
        // Tenta comparar com bcrypt
        try {
            isMatch = await bcrypt.compare(password, user.password_hash);
        } catch(e) {
            // Em caso de falha de hash puro (mock no SQL), podemos comparar em plaintext (APENAS PARA FASE DE DEV/TESTES)
            isMatch = (password === user.password_hash); 
        }
    }

    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    // Se a senha for correta, devolve os dados essenciais (sem enviar a senha de volta!)
    res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      plan_type: user.plan_type,
      yeto_points: user.yeto_points,
      current_level: user.current_level,
      avatar_url: user.avatar_url,
      occupation: user.occupation,
      created_at: user.created_at,
      plan_expires_at: user.plan_expires_at
    });

  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

const register = async (req, res) => {
  const { name, email, password, occupation } = req.body;
  try {
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos.' });
    }

    // Password complexity validation
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{10,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 10 caracteres, incluir uma letra, um número e um caractere especial.' });
    }

    // Verifica se já existe
    const exist = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exist.rows.length > 0) {
      return res.status(400).json({ error: 'Já existe uma conta registada com este email.' });
    }

    // Gera código de verificação
    const verificationCode = generateCode();
    const verificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    // Cria utilizador (com email NÃO verificado e com 30 dias de trial gratuitos)
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (name, email, password_hash, occupation, email_verified, verification_code, verification_expires, plan_expires_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '30 days') RETURNING id, name, email",
      [name, email, hash, occupation || null, false, verificationCode, verificationExpires]
    );

    // Envia email de verificação via Brevo
    try {
      await sendVerificationCode(email, name, verificationCode);
      console.log(`📧 Código de verificação enviado para ${email}`);
    } catch (emailError) {
      console.error('❌ Erro ao enviar email de verificação:', emailError.message);
      // Não bloqueia o registo - o utilizador pode pedir para reenviar
    }

    res.status(201).json({
      needsVerification: true,
      email: email,
      message: 'Conta criada! Verifique o seu email para ativar a conta.'
    });

  } catch (error) {
    console.error('Erro no registo:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

/**
 * Verificar email com código de 6 dígitos
 */
const verifyEmail = async (req, res) => {
  const { email, code } = req.body;

  try {
    if (!email || !code) {
      return res.status(400).json({ error: 'Email e código são obrigatórios.' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilizador não encontrado.' });
    }

    const user = result.rows[0];

    if (user.email_verified) {
      return res.status(400).json({ error: 'Este email já foi verificado.' });
    }

    if (user.verification_code !== code) {
      return res.status(400).json({ error: 'Código inválido. Verifique e tente novamente.' });
    }

    if (new Date() > new Date(user.verification_expires)) {
      return res.status(400).json({ error: 'Código expirado. Solicite um novo código.' });
    }

    // Marcar email como verificado
    await pool.query(
      'UPDATE users SET email_verified = TRUE, verification_code = NULL, verification_expires = NULL WHERE id = $1',
      [user.id]
    );

    // Retorna dados do utilizador para auto-login
    res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      plan_type: user.plan_type,
      yeto_points: user.yeto_points || 0,
      current_level: user.current_level || 1,
      avatar_url: user.avatar_url,
      occupation: user.occupation,
      created_at: user.created_at,
      plan_expires_at: user.plan_expires_at
    });

  } catch (error) {
    console.error('Erro na verificação de email:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

/**
 * Reenviar código de verificação
 */
const resendCode = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ error: 'Email é obrigatório.' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilizador não encontrado.' });
    }

    const user = result.rows[0];

    if (user.email_verified) {
      return res.status(400).json({ error: 'Este email já foi verificado.' });
    }

    // Gera novo código
    const code = generateCode();
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await pool.query(
      'UPDATE users SET verification_code = $1, verification_expires = $2 WHERE id = $3',
      [code, expires, user.id]
    );

    await sendVerificationCode(email, user.name, code);

    res.status(200).json({ message: 'Novo código enviado com sucesso.' });

  } catch (error) {
    console.error('Erro ao reenviar código:', error);
    res.status(500).json({ error: 'Erro ao enviar código. Tente novamente.' });
  }
};

/**
 * Esqueceu a senha — Envia código de recuperação
 */
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ error: 'Email é obrigatório.' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      // Resposta genérica para segurança (não revela se o email existe)
      return res.status(200).json({ message: 'Se este email estiver registado, receberá um código de recuperação.' });
    }

    const user = result.rows[0];
    const code = generateCode();
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await pool.query(
      'UPDATE users SET reset_code = $1, reset_code_expires = $2 WHERE id = $3',
      [code, expires, user.id]
    );

    await sendPasswordReset(email, user.name, code);

    res.status(200).json({ message: 'Se este email estiver registado, receberá um código de recuperação.' });

  } catch (error) {
    console.error('Erro na recuperação de senha:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

/**
 * Redefinir senha com código de recuperação
 */
const resetPassword = async (req, res) => {
  const { email, code, newPassword } = req.body;

  try {
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    // Validação de complexidade da nova senha
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{10,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 10 caracteres, incluir uma letra, um número e um caractere especial.' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Código inválido ou expirado.' });
    }

    const user = result.rows[0];

    if (user.reset_code !== code) {
      return res.status(400).json({ error: 'Código inválido.' });
    }

    if (new Date() > new Date(user.reset_code_expires)) {
      return res.status(400).json({ error: 'Código expirado. Solicite um novo.' });
    }

    // Atualizar a senha
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1, reset_code = NULL, reset_code_expires = NULL WHERE id = $2',
      [hash, user.id]
    );

    res.status(200).json({ message: 'Senha redefinida com sucesso! Pode agora iniciar sessão.' });

  } catch (error) {
    console.error('Erro ao redefinir senha:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

module.exports = {
  login,
  register,
  verifyEmail,
  resendCode,
  forgotPassword,
  resetPassword
};
