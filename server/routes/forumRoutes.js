const express = require('express');
const forumController = require('../controllers/forumController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', forumController.listPosts);

router.use(protect);

router.post('/', forumController.createPost);
router.post('/:id/comments', forumController.addComment);
router.patch('/:id/like', forumController.toggleLike);

module.exports = router;
