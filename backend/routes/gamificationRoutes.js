const express = require('express');
const router = express.Router();
const gamificationController = require('../controllers/gamificationController');

// POST /api/gamification/redeem
router.post('/redeem', gamificationController.redeemPremium);

module.exports = router;
