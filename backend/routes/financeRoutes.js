const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');

// GET /api/finances/:userId
router.get('/:userId', financeController.getUserFinances);

// Accounts
router.post('/account', financeController.createAccount);
router.put('/account/:id', financeController.updateAccount);
router.delete('/account/:id', financeController.deleteAccount);

// Transactions
router.post('/transaction', financeController.createTransaction);
router.put('/transaction/:id', financeController.updateTransaction);
router.delete('/transaction/:id', financeController.deleteTransaction);

// Debts
router.post('/debt', financeController.createDebt);
router.put('/debt/:id', financeController.updateDebt);
router.delete('/debt/:id', financeController.deleteDebt);
router.put('/debt/:id/pay', financeController.payDebt);

// Fixed Payments
router.post('/fixed-payment', financeController.createFixedPayment);
router.put('/fixed-payment/:id', financeController.updateFixedPayment);
router.delete('/fixed-payment/:id', financeController.deleteFixedPayment);
router.put('/fixed-payment/:id/pay', financeController.payFixedPayment);

// Kixikilas
router.post('/kixikila', financeController.createKixikila);
router.put('/kixikila/:id', financeController.updateKixikila);
router.delete('/kixikila/:id', financeController.deleteKixikila);
router.put('/kixikila/:id/pay', financeController.receiveKixikilaHand);

// Projects
router.post('/project', financeController.createProject);
router.put('/project/:id', financeController.updateProject);
router.delete('/project/:id', financeController.deleteProject);
router.put('/project/:id/fund', financeController.fundProject);

// Divisas
router.post('/currency', financeController.createForeignCurrency);

// Pagamento de Subscrição
router.post('/payment-proof', financeController.uploadPaymentProof);
router.get('/payment-status/:userId', financeController.getPaymentStatus);

module.exports = router;
