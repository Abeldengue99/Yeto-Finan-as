const express = require('express');
const router = express.Router();
const assistantController = require('../controllers/assistantController');
const { authenticate } = require('../middleware/auth');
const { validateUuidParam } = require('../middleware/security');

router.use(authenticate);

router.get('/conversations', assistantController.listConversations);
router.post('/conversations', assistantController.createConversation);
router.get('/conversations/:id', validateUuidParam('id'), assistantController.getConversation);
router.post('/conversations/:id/messages', validateUuidParam('id'), assistantController.sendMessage);
router.put('/conversations/:id/status', validateUuidParam('id'), assistantController.updateConversationStatus);

module.exports = router;
