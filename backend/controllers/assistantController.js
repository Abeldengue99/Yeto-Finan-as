const pool = require('../config/database');

const MAX_SUBJECT_LENGTH = 140;
const MAX_MESSAGE_LENGTH = 2000;

function isAdmin(req) {
  return req.user?.plan_type === 'admin';
}

function cleanSubject(subject) {
  const value = String(subject || 'Assistente Yeto').trim();
  return value.slice(0, MAX_SUBJECT_LENGTH) || 'Assistente Yeto';
}

function cleanMessage(message) {
  return String(message || '').trim().slice(0, MAX_MESSAGE_LENGTH);
}

async function getConversationForRequest(db, conversationId, req) {
  const params = [conversationId];
  let query = `
    SELECT c.*, u.name AS user_name, u.email AS user_email
    FROM support_conversations c
    JOIN users u ON u.id = c.user_id
    WHERE c.id = $1
  `;

  if (!isAdmin(req)) {
    query += ' AND c.user_id = $2';
    params.push(req.user.id);
  }

  const result = await db.query(query, params);
  return result.rows[0] || null;
}

const listConversations = async (req, res) => {
  try {
    const params = [];
    let where = '';

    if (!isAdmin(req)) {
      params.push(req.user.id);
      where = 'WHERE c.user_id = $1';
    }

    const result = await pool.query(`
      SELECT
        c.id,
        c.subject,
        c.status,
        c.priority,
        c.created_at,
        c.updated_at,
        c.last_message_at,
        u.name AS user_name,
        u.email AS user_email,
        COALESCE(last_msg.message, '') AS last_message,
        COALESCE(unread.unread_count, 0)::int AS unread_count
      FROM support_conversations c
      JOIN users u ON u.id = c.user_id
      LEFT JOIN LATERAL (
        SELECT message
        FROM support_messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC
        LIMIT 1
      ) last_msg ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS unread_count
        FROM support_messages m
        WHERE m.conversation_id = c.id
          AND m.read_at IS NULL
          AND m.sender_role = $${params.length + 1}
      ) unread ON true
      ${where}
      ORDER BY c.last_message_at DESC
      LIMIT 100
    `, [...params, isAdmin(req) ? 'user' : 'admin']);

    res.json({ conversations: result.rows });
  } catch (error) {
    console.error('Erro ao listar conversas do assistente:', error);
    res.status(500).json({ error: 'Erro ao carregar assistente.' });
  }
};

const getConversation = async (req, res) => {
  const { id } = req.params;

  try {
    const conversation = await getConversationForRequest(pool, id, req);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversa nao encontrada.' });
    }

    const unreadSenderRole = isAdmin(req) ? 'user' : 'admin';
    await pool.query(
      `UPDATE support_messages
       SET read_at = NOW()
       WHERE conversation_id = $1 AND sender_role = $2 AND read_at IS NULL`,
      [id, unreadSenderRole]
    );

    const messages = await pool.query(
      `SELECT id, sender_id, sender_role, message, read_at, created_at
       FROM support_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [id]
    );

    res.json({ conversation, messages: messages.rows });
  } catch (error) {
    console.error('Erro ao abrir conversa do assistente:', error);
    res.status(500).json({ error: 'Erro ao abrir conversa.' });
  }
};

const createConversation = async (req, res) => {
  const subject = cleanSubject(req.body.subject);
  const message = cleanMessage(req.body.message);

  if (!message) {
    return res.status(400).json({ error: 'Escreva uma mensagem para iniciar a conversa.' });
  }

  if (isAdmin(req)) {
    return res.status(400).json({ error: 'O admin deve responder a uma conversa existente.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const conversationResult = await client.query(
      `INSERT INTO support_conversations (user_id, subject, status, last_message_at)
       VALUES ($1, $2, 'open', NOW())
       RETURNING *`,
      [req.user.id, subject]
    );
    const conversation = conversationResult.rows[0];

    await client.query(
      `INSERT INTO support_messages (conversation_id, sender_id, sender_role, message)
       VALUES ($1, $2, 'user', $3)`,
      [conversation.id, req.user.id, message]
    );

    await client.query('COMMIT');
    res.status(201).json({ conversation });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao criar conversa do assistente:', error);
    res.status(500).json({ error: 'Erro ao iniciar conversa.' });
  } finally {
    client.release();
  }
};

const sendMessage = async (req, res) => {
  const { id } = req.params;
  const message = cleanMessage(req.body.message);

  if (!message) {
    return res.status(400).json({ error: 'Escreva uma mensagem antes de enviar.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const conversation = await getConversationForRequest(client, id, req);
    if (!conversation) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Conversa nao encontrada.' });
    }

    const senderRole = isAdmin(req) ? 'admin' : 'user';
    const nextStatus = senderRole === 'user' ? 'open' : conversation.status;

    const messageResult = await client.query(
      `INSERT INTO support_messages (conversation_id, sender_id, sender_role, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, sender_id, sender_role, message, read_at, created_at`,
      [id, req.user.id, senderRole, message]
    );

    await client.query(
      `UPDATE support_conversations
       SET status = $1, updated_at = NOW(), last_message_at = NOW()
       WHERE id = $2`,
      [nextStatus, id]
    );

    await client.query('COMMIT');
    res.status(201).json({ message: messageResult.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao enviar mensagem do assistente:', error);
    res.status(500).json({ error: 'Erro ao enviar mensagem.' });
  } finally {
    client.release();
  }
};

const updateConversationStatus = async (req, res) => {
  const { id } = req.params;
  const nextStatus = req.body.status === 'resolved' ? 'resolved' : 'open';

  try {
    const conversation = await getConversationForRequest(pool, id, req);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversa nao encontrada.' });
    }

    const result = await pool.query(
      `UPDATE support_conversations
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [nextStatus, id]
    );

    res.json({ conversation: result.rows[0] });
  } catch (error) {
    console.error('Erro ao atualizar conversa do assistente:', error);
    res.status(500).json({ error: 'Erro ao atualizar estado da conversa.' });
  }
};

module.exports = {
  createConversation,
  getConversation,
  listConversations,
  sendMessage,
  updateConversationStatus
};
