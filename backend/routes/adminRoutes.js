const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// GET /api/admin/stats
router.get('/stats', adminController.getDashboardStats);

// GET /api/admin/users
router.get('/users', adminController.getAllUsers);

// GET /api/admin/logs
router.get('/logs', adminController.getLogs);

// POST /api/admin/promotions
router.post('/promotions', adminController.sendPromotions);

// PUT /api/admin/payments/:paymentId/approve
router.put('/payments/:paymentId/approve', adminController.approvePayment);

module.exports = router;
