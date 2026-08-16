const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// PUT /api/users/profile
router.put('/profile', userController.updateProfile);

module.exports = router;
