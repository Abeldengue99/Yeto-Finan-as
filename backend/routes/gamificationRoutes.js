const express = require('express');
const router = express.Router();
const gamificationController = require('../controllers/gamificationController');
const { authenticate, requireSelfBody, requireSelfParam } = require('../middleware/auth');
const { validateUuidParam } = require('../middleware/security');

router.get('/:userId', authenticate, validateUuidParam('userId'), requireSelfParam('userId'), gamificationController.getSummary);
router.post('/claim', authenticate, requireSelfBody('userId'), gamificationController.claim);
router.post('/redeem', authenticate, requireSelfBody('userId'), gamificationController.redeemPremium);

module.exports = router;
