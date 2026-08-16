const pool = require('../config/database');
const bcrypt = require('bcrypt');

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

    // Verifica a senha. Nota: Para o mock inicial (se a senha não for hash real no DB ainda, fazemos um fallback provisório para testar)
    // O bcrypt.compare vai falhar se a string não for um hash válido do bcrypt.
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
      created_at: user.created_at
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

    // Cria utilizador
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, occupation) VALUES ($1, $2, $3, $4) RETURNING id, name, email, plan_type',
      [name, email, hash, occupation || null]
    );

    const user = result.rows[0];
    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      plan_type: user.plan_type,
      yeto_points: 0,
      current_level: 1,
      avatar_url: null
    });

  } catch (error) {
    console.error('Erro no registo:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

module.exports = {
  login,
  register
};
