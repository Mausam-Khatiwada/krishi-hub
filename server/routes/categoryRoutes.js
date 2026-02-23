const express = require('express');
const { body } = require('express-validator');
const categoryController = require('../controllers/categoryController');
const { protect } = require('../middleware/authMiddleware');
const { restrictTo } = require('../middleware/roleMiddleware');
const validateRequest = require('../middleware/validateMiddleware');

const router = express.Router();

router.get('/', categoryController.listCategories);

router.use(protect, restrictTo('admin'));

router.post(
  '/',
  [body('name').trim().notEmpty().withMessage('Category name is required'), validateRequest],
  categoryController.createCategory,
);
router.patch('/:id', categoryController.updateCategory);
router.delete('/:id', categoryController.deleteCategory);

module.exports = router;
