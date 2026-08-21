ALTER TABLE payment_approvals
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
