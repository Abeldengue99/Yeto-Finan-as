const pool = require('./config/database');

async function migratePaymentReviewFields() {
  try {
    await pool.query('ALTER TABLE payment_approvals ADD COLUMN IF NOT EXISTS rejection_reason TEXT');
    console.log('Campos de revisao de pagamentos preparados com sucesso.');
  } catch (error) {
    console.error('Erro ao preparar campos de revisao de pagamentos:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migratePaymentReviewFields();
