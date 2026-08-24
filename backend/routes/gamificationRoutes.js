const express = require('express');
const router = express.Router();
const gamificationController = require('../controllers/gamificationController');
const { authenticate, requireFeatureAccess, requireSelfBody, requireSelfParam } = require('../middleware/auth');
const { validateUuidParam } = require('../middleware/security');

router.get('/:userId', authenticate, validateUuidParam('userId'), requireSelfParam('userId'), requireFeatureAccess('gamificacao'), gamificationController.getSummary);
router.post('/claim', authenticate, requireSelfBody('userId'), requireFeatureAccess('gamificacao'), gamificationController.claim);
router.post('/redeem', authenticate, requireSelfBody('userId'), requireFeatureAccess('gamificacao'), gamificationController.redeemPremium);

module.exports = router;
