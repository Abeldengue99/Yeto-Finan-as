const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// GET /api/admin/stats
router.get('/stats', adminController.getDashboardStats);

// GET /api/admin/users
router.get('/users', adminController.getAllUsers);

// GET /api/admin/logs
router.get('/logs', adminController.getLogs);

// GET /api/admin/payments/pending
router.get('/payments/pending', adminController.getPendingPayments);

// POST /api/admin/promotions
router.post('/promotions', adminController.sendPromotions);

// PUT /api/admin/payments/:paymentId/approve
router.put('/payments/:paymentId/approve', adminController.approvePayment);

// PUT /api/admin/payments/:paymentId/reject
router.put('/payments/:paymentId/reject', adminController.rejectPayment);

module.exports = router;
