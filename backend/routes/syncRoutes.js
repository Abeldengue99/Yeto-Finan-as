const express = require('express');
const router = express.Router();
const syncController = require('../controllers/syncController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.post('/push', syncController.pushSyncBatch);
router.get('/history', syncController.getSyncHistory);

module.exports = router;
