CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS province VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS municipality VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(80);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_device VARCHAR(180);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_user_agent TEXT;

UPDATE users SET email = LOWER(TRIM(email)) WHERE email IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_users_email_lower_unique'
  )
  AND NOT EXISTS (
    SELECT LOWER(email)
    FROM users
    WHERE email IS NOT NULL
    GROUP BY LOWER(email)
    HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX idx_users_email_lower_unique ON users (LOWER(email));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS user_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(180) NOT NULL,
  device_type VARCHAR(80),
  browser VARCHAR(120),
  os VARCHAR(120),
  screen VARCHAR(80),
  language VARCHAR(40),
  user_agent TEXT,
  ip_address VARCHAR(80),
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  login_count INTEGER NOT NULL DEFAULT 1,
  UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_user_devices_user_last_seen ON user_devices(user_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_devices_device_type ON user_devices(device_type);
