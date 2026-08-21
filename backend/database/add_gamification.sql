CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE users
ADD COLUMN IF NOT EXISTS yeto_points INTEGER DEFAULT 0;

UPDATE users
SET yeto_points = COALESCE(yeto_points, 0)
WHERE yeto_points IS NULL;

CREATE TABLE IF NOT EXISTS gamification_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_key VARCHAR(100) NOT NULL,
  source_type VARCHAR(80),
  source_id VARCHAR(120),
  period_key VARCHAR(20),
  points INTEGER NOT NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gamification_events_user_created
ON gamification_events(user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gamification_events_source_once
ON gamification_events(user_id, action_key, source_type, source_id)
WHERE source_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_gamification_events_period_once
ON gamification_events(user_id, action_key, period_key)
WHERE source_id IS NULL AND period_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_gamification_events_action_once
ON gamification_events(user_id, action_key)
WHERE source_id IS NULL AND period_key IS NULL;
