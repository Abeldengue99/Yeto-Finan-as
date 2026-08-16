const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, requireSelfBody } = require('../middleware/auth');

router.put('/profile', authenticate, requireSelfBody('userId'), userController.updateProfile);

module.exports = router;
