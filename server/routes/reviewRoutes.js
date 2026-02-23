const express = require('express');
const { body } = require('express-validator');
const reviewController = require('../controllers/reviewController');
const { protect } = require('../middleware/authMiddleware');
const { restrictTo } = require('../middleware/roleMiddleware');
const validateRequest = require('../middleware/validateMiddleware');

const router = express.Router();

router.get('/product/:productId', reviewController.listProductReviews);

router.post(
  '/',
  protect,
  restrictTo('buyer'),
  [
    body('productId').notEmpty().withMessage('Product ID is required'),
    body('orderId').notEmpty().withMessage('Order ID is required'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    validateRequest,
  ],
  reviewController.createReview,
);

module.exports = router;
