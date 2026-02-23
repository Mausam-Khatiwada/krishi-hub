const express = require('express');
const { body } = require('express-validator');
const orderController = require('../controllers/orderController');
const { protect } = require('../middleware/authMiddleware');
const { restrictTo } = require('../middleware/roleMiddleware');
const validateRequest = require('../middleware/validateMiddleware');

const router = express.Router();

router.use(protect);

router.post(
  '/',
  restrictTo('buyer'),
  [
    body('items').isArray({ min: 1 }).withMessage('Items are required'),
    body('items.*.productId').notEmpty().withMessage('Product id is required'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    validateRequest,
  ],
  orderController.createOrder,
);

router.post('/payments/confirm', restrictTo('buyer'), orderController.markPaymentBySession);
router.get('/my', restrictTo('buyer'), orderController.getMyOrders);
router.get('/farmer', restrictTo('farmer'), orderController.getFarmerOrders);
router.get('/analytics/farmer', restrictTo('farmer'), orderController.getFarmerAnalytics);
router.get('/admin/all', restrictTo('admin'), orderController.listAllOrders);
router.get('/:id', orderController.getOrderById);
router.get('/:id/invoice', orderController.generateInvoice);
router.patch('/:id/farmer-decision', restrictTo('farmer'), orderController.setFarmerDecision);
router.patch('/:id/status', restrictTo('admin', 'farmer'), orderController.updateOrderStatus);
router.patch('/:id/tracking', restrictTo('admin'), orderController.updateTracking);

module.exports = router;
