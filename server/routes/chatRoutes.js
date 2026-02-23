const express = require('express');
const chatController = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');
const { restrictTo } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(protect, restrictTo('buyer', 'farmer'));

router.get('/contacts', chatController.listChatContacts);
router.get('/', chatController.listMyChats);
router.post('/', chatController.getOrCreateChat);
router.get('/:chatId/messages', chatController.getChatMessages);
router.patch('/:chatId/read', chatController.markChatRead);
router.post('/:chatId/messages', chatController.sendMessage);

module.exports = router;
