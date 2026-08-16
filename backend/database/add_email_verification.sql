-- Migração: Adicionar colunas de verificação de email e reset de senha
-- Data: 2026-08-16
-- Descrição: Suporte à integração Brevo para verificação de conta e recuperação de senha

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code VARCHAR(6);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_expires TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code VARCHAR(6);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code_expires TIMESTAMP;

-- Marcar o admin como verificado por defeito
UPDATE users SET email_verified = TRUE WHERE id = '00000000-0000-0000-0000-000000000000';
