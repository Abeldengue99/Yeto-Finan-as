const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validateUuidParam } = require('../middleware/security');

router.use(authenticate, requireAdmin);

router.get('/stats', adminController.getDashboardStats);
router.get('/users', adminController.getAllUsers);
router.get('/logs', adminController.getLogs);
router.get('/payments/pending', adminController.getPendingPayments);
router.post('/promotions', adminController.sendPromotions);
router.put('/payments/:paymentId/approve', validateUuidParam('paymentId'), adminController.approvePayment);
router.put('/payments/:paymentId/reject', validateUuidParam('paymentId'), adminController.rejectPayment);

module.exports = router;
