const pool = require('../config/database');

let notificationsReady = false;

async function ensureUserNotificationsTable(db = pool) {
  if (notificationsReady) return;

  await db.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_notifications (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(160) NOT NULL,
      message TEXT NOT NULL,
      tab VARCHAR(80),
      type VARCHAR(40) NOT NULL DEFAULT 'info',
      delivered_at TIMESTAMP WITH TIME ZONE,
      read_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  await db.query('CREATE INDEX IF NOT EXISTS idx_user_notifications_user_pending ON user_notifications(user_id, delivered_at, created_at DESC)');
  notificationsReady = true;
}

async function createUserNotification({ userId, title, message, tab = null, type = 'info' }, db = pool) {
  if (!userId || !title || !message) return null;

  await ensureUserNotificationsTable(db);
  const result = await db.query(
    `INSERT INTO user_notifications (user_id, title, message, tab, type)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, title, message, tab, type, created_at`,
    [userId, String(title).slice(0, 160), String(message).slice(0, 1000), tab, type]
  );

  return result.rows[0] || null;
}

async function consumeUserNotifications(userId, db = pool) {
  await ensureUserNotificationsTable(db);

  const result = await db.query(
    `SELECT id, title, message, tab, type, created_at
     FROM user_notifications
     WHERE user_id = $1 AND delivered_at IS NULL
     ORDER BY created_at DESC
     LIMIT 30`,
    [userId]
  );

  if (result.rows.length > 0) {
    await db.query(
      'UPDATE user_notifications SET delivered_at = NOW() WHERE id = ANY($1::uuid[])',
      [result.rows.map(item => item.id)]
    );
  }

  return result.rows;
}

module.exports = {
  ensureUserNotificationsTable,
  createUserNotification,
  consumeUserNotifications
};
