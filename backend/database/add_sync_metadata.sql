CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS sync_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(160),
  operation_id VARCHAR(180),
  resource VARCHAR(80),
  method VARCHAR(12),
  path TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'synced',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_events_user_created_at ON sync_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_events_status ON sync_events(status);

DO $$
DECLARE
  table_name TEXT;
  tables TEXT[] := ARRAY[
    'accounts',
    'transactions',
    'debts',
    'fixed_payments',
    'projects',
    'kixikila_groups',
    'foreign_currency',
    'budgets',
    'shopping_lists',
    'shopping_list_items'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS sync_id VARCHAR(180)', table_name);
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS device_id VARCHAR(160)', table_name);
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE', table_name);
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP', table_name);
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (user_id, updated_at)', 'idx_' || table_name || '_user_updated_at', table_name);
      EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON %I (user_id, sync_id) WHERE sync_id IS NOT NULL', 'idx_' || table_name || '_user_sync_id', table_name);
    END IF;
  END LOOP;
END $$;
