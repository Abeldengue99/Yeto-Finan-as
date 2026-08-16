const pool = require('./config/database');

async function migrateAssistant() {
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS support_conversations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subject VARCHAR(140) NOT NULL DEFAULT 'Assistente Yeto',
        status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
        priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        last_message_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS support_messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        conversation_id UUID NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
        sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        sender_role VARCHAR(20) NOT NULL CHECK (sender_role IN ('user', 'admin')),
        message TEXT NOT NULL,
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query('CREATE INDEX IF NOT EXISTS idx_support_conversations_user_id ON support_conversations(user_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_support_conversations_last_message ON support_conversations(last_message_at DESC);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_support_messages_conversation ON support_messages(conversation_id, created_at ASC);');

    console.log('Sistema de assistente migrado com sucesso.');
  } catch (error) {
    console.error('Erro na migracao do assistente:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrateAssistant();
