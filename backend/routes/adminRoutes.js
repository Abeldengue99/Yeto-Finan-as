const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// GET /api/admin/stats
router.get('/stats', adminController.getDashboardStats);

// GET /api/admin/users
router.get('/users', adminController.getAllUsers);

// GET /api/admin/logs
router.get('/logs', adminController.getLogs);

module.exports = router;
