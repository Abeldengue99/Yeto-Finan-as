const express = require('express');
const router = express.Router();
const gamificationController = require('../controllers/gamificationController');
const { authenticate, requireSelfBody } = require('../middleware/auth');

router.post('/redeem', authenticate, requireSelfBody('userId'), gamificationController.redeemPremium);

module.exports = router;
