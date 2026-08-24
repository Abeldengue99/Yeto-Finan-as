const pool = require('../config/database');
const bcrypt = require('bcrypt');
const { sendVerificationCode, sendPasswordReset } = require('../services/emailService');
const { signSession, getAdminPermissionsForUser } = require('../middleware/auth');
const { getActiveFeatureKeys } = require('../services/featureAccessService');

/**
 * Gera um código numérico aleatório de 6 dígitos
 */
const generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function cleanText(value, maxLength = 120) {
  return String(value || '').trim().slice(0, maxLength) || null;
}

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim().slice(0, 80);
  }

  return String(req.ip || req.socket?.remoteAddress || '').slice(0, 80) || null;
}

function summarizeDevice(deviceInfo = {}, userAgent = '') {
  return [
    deviceInfo.deviceType,
    deviceInfo.browser,
    deviceInfo.os
  ].filter(Boolean).join(' - ') || String(userAgent || '').slice(0, 180) || 'Dispositivo desconhecido';
}

async function saveUserDevice(userId, req, deviceInfo = {}) {
  if (!userId) return;

  const userAgent = String(req.headers['user-agent'] || '').slice(0, 500);
  const ipAddress = getClientIp(req);
  const deviceId = cleanText(deviceInfo.deviceId, 180) || `server-${Buffer.from(`${userAgent}:${ipAddress || ''}`).toString('base64url').slice(0, 80)}`;
  const deviceType = cleanText(deviceInfo.deviceType, 80);
  const browser = cleanText(deviceInfo.browser, 120);
  const os = cleanText(deviceInfo.os, 120);
  const screen = cleanText(deviceInfo.screen, 80);
  const language = cleanText(deviceInfo.language, 40);
  const summary = summarizeDevice({ deviceType, browser, os }, userAgent);

  try {
    await pool.query(
      `INSERT INTO user_devices (user_id, device_id, device_type, browser, os, screen, language, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id, device_id)
       DO UPDATE SET
         device_type = EXCLUDED.device_type,
         browser = EXCLUDED.browser,
         os = EXCLUDED.os,
         screen = EXCLUDED.screen,
         language = EXCLUDED.language,
         user_agent = EXCLUDED.user_agent,
         ip_address = EXCLUDED.ip_address,
         last_seen_at = CURRENT_TIMESTAMP,
         login_count = user_devices.login_count + 1`,
      [userId, deviceId, deviceType, browser, os, screen, language, userAgent, ipAddress]
    );

    await pool.query(
      `UPDATE users
       SET last_login_at = CURRENT_TIMESTAMP,
           last_login_ip = $1,
           last_login_device = $2,
           last_login_user_agent = $3
       WHERE id = $4`,
      [ipAddress, summary, userAgent, userId]
    );
  } catch (error) {
    console.warn('NÃ£o foi possÃ­vel guardar informaÃ§Ã£o do dispositivo:', error.message);
  }
}

const buildSessionResponse = async (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  email_verified: Boolean(user.email_verified),
  plan_type: user.plan_type,
  subscription_plan: user.subscription_plan || (user.plan_type === 'admin' ? 'admin' : user.plan_type === 'premium' ? 'anual' : 'free'),
  custom_features: await getActiveFeatureKeys(user.id),
  admin_permissions: await getAdminPermissionsForUser(user),
  yeto_points: user.yeto_points || 0,
  current_level: user.current_level || 1,
  avatar_url: user.avatar_url,
  occupation: user.occupation,
  gender: user.gender,
  province: user.province,
  municipality: user.municipality,
  city: user.city,
  created_at: user.created_at,
  plan_expires_at: user.plan_expires_at,
  token: signSession(user)
});

const login = async (req, res) => {
  const { email, password, deviceInfo } = req.body;
  const cleanEmail = normalizeEmail(email);

  try {
    if (!cleanEmail || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }

    // Procura o utilizador
    const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const user = result.rows[0];

    // Verifica se a conta está bloqueada
    if (user.status === 'blocked') {
      return res.status(403).json({ error: 'A sua conta encontra-se bloqueada. Contacte o suporte.' });
    }

    // Verifica se o email foi verificado
    if (false) {
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

    if (!user.email_verified) {
      const code = generateCode();
      const expires = new Date(Date.now() + 15 * 60 * 1000);
      await pool.query(
        'UPDATE users SET verification_code = $1, verification_expires = $2 WHERE id = $3',
        [code, expires, user.id]
      );

      try {
        await sendVerificationCode(user.email, user.name, code);
      } catch (emailError) {
        console.error('Erro ao reenviar cÃ³digo:', emailError.message);
      }

      await saveUserDevice(user.id, req, deviceInfo);

      return res.status(403).json({
        error: 'Email não verificado. Enviámos um novo código para o seu email.',
        needsVerification: true,
        email: user.email
      });
    }

    if (user.plan_type === 'free' && !user.plan_expires_at && user.created_at) {
      const expiryResult = await pool.query(
        "UPDATE users SET plan_expires_at = created_at + INTERVAL '30 days' WHERE id = $1 AND plan_expires_at IS NULL RETURNING plan_expires_at",
        [user.id]
      );

      if (expiryResult.rows[0]) {
        user.plan_expires_at = expiryResult.rows[0].plan_expires_at;
      }
    }

    await saveUserDevice(user.id, req, deviceInfo);

    // Se a senha for correta, devolve os dados essenciais (sem enviar a senha de volta!)
    res.status(200).json(await buildSessionResponse(user));

  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

const register = async (req, res) => {
  const { name, email, password, occupation, gender, province, municipality, city, deviceInfo } = req.body;
  const cleanEmail = normalizeEmail(email);
  try {
    if (!name || !cleanEmail || !password) {
      return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos.' });
    }

    // Password complexity validation
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{10,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 10 caracteres, incluir uma letra, um número e um caractere especial.' });
    }

    // Verifica se já existe
    const exist = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    if (exist.rows.length > 0) {
      return res.status(400).json({ error: 'Já existe uma conta registada com este email.' });
    }

    // Gera código de verificação
    const verificationCode = generateCode();
    const verificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    // Cria utilizador (com email NÃO verificado e com 30 dias de trial gratuitos)
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (
        name, email, password_hash, occupation, gender, province, municipality, city,
        email_verified, verification_code, verification_expires, plan_expires_at, subscription_plan
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, $9, $10, NOW() + INTERVAL '30 days', 'free')
       RETURNING id, name, email`,
      [
        cleanText(name),
        cleanEmail,
        hash,
        cleanText(occupation),
        cleanText(gender, 30),
        cleanText(province),
        cleanText(municipality),
        cleanText(city),
        verificationCode,
        verificationExpires
      ]
    );

    // Envia email de verificação via Brevo
    try {
      await sendVerificationCode(cleanEmail, name, verificationCode);
      console.log(`📧 Código de verificação enviado para ${email}`);
    } catch (emailError) {
      console.error('❌ Erro ao enviar email de verificação:', emailError.message);
      // Não bloqueia o registo - o utilizador pode pedir para reenviar
    }

    await saveUserDevice(result.rows[0].id, req, deviceInfo);

    res.status(201).json({
      needsVerification: true,
      email: cleanEmail,
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
  const { email, code, deviceInfo } = req.body;
  const cleanEmail = normalizeEmail(email);

  try {
    if (!cleanEmail || !code) {
      return res.status(400).json({ error: 'Email e código são obrigatórios.' });
    }

    const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    
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
    user.email_verified = true;
    user.verification_code = null;
    user.verification_expires = null;
    await saveUserDevice(user.id, req, deviceInfo);

    // Retorna dados do utilizador para auto-login
    res.status(200).json(await buildSessionResponse(user));

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
  const cleanEmail = normalizeEmail(email);

  try {
    if (!cleanEmail) {
      return res.status(400).json({ error: 'Email é obrigatório.' });
    }

    const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    
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

    await sendVerificationCode(user.email, user.name, code);

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
  const cleanEmail = normalizeEmail(email);

  try {
    if (!cleanEmail) {
      return res.status(400).json({ error: 'Email é obrigatório.' });
    }

    const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    
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

    await sendPasswordReset(user.email, user.name, code);

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
  const cleanEmail = normalizeEmail(email);

  try {
    if (!cleanEmail || !code || !newPassword) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    // Validação de complexidade da nova senha
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{10,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 10 caracteres, incluir uma letra, um número e um caractere especial.' });
    }

    const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    
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
