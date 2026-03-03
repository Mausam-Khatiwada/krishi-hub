const express = require('express');
const { body } = require('express-validator');
const orderController = require('../controllers/orderController');
const { protect } = require('../middleware/authMiddleware');
const { restrictTo } = require('../middleware/roleMiddleware');
const validateRequest = require('../middleware/validateMiddleware');

const router = express.Router();

router.get('/payments/esewa/checkout', orderController.serveEsewaCheckoutPage);
router.get('/payments/esewa/callback/success/:orderId', orderController.handleEsewaSuccessCallback);
router.get('/payments/esewa/callback/failure/:orderId', orderController.handleEsewaFailureCallback);
router.get('/payments/esewa/callback/success', orderController.handleEsewaSuccessCallback);
router.get('/payments/esewa/callback/failure', orderController.handleEsewaFailureCallback);
router.get('/payments/khalti/callback', orderController.handleKhaltiCallback);
router.post('/payments/khalti/callback', orderController.handleKhaltiCallback);

router.use(protect);

router.post(
  '/',
  restrictTo('buyer'),
  [
    body('items').isArray({ min: 1 }).withMessage('Items are required'),
    body('items.*.productId').notEmpty().withMessage('Product id is required'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('paymentMethod')
      .optional()
      .isIn(['stripe', 'cod', 'esewa', 'khalti', 'mobile_banking'])
      .withMessage('Invalid payment method'),
    validateRequest,
  ],
  orderController.createOrder,
);

router.post(
  '/checkout/optimize',
  restrictTo('buyer'),
  [
    body('items').isArray({ min: 1 }).withMessage('Items are required for checkout optimization'),
    body('items.*.productId').notEmpty().withMessage('Product id is required'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('paymentMethod')
      .optional()
      .isIn(['stripe', 'cod', 'esewa', 'khalti', 'mobile_banking'])
      .withMessage('Invalid payment method'),
    validateRequest,
  ],
  orderController.getCheckoutOptimization,
);

router.post(
  '/payments/confirm',
  restrictTo('buyer'),
  [
    body('sessionId').isString().notEmpty().withMessage('Stripe sessionId is required'),
    validateRequest,
  ],
  orderController.markPaymentBySession,
);
router.get('/my', restrictTo('buyer'), orderController.getMyOrders);
router.get('/farmer', restrictTo('farmer'), orderController.getFarmerOrders);
router.get('/analytics/farmer', restrictTo('farmer'), orderController.getFarmerAnalytics);
router.get('/admin/all', restrictTo('admin'), orderController.listAllOrders);
router.get('/admin/returns', restrictTo('admin'), orderController.listAdminReturnsQueue);
router.post(
  '/:id/returns/request',
  restrictTo('buyer'),
  [body('reason').trim().notEmpty().withMessage('Return reason is required'), validateRequest],
  orderController.requestOrderReturn,
);
router.patch(
  '/:id/returns/process',
  restrictTo('admin'),
  [
    body('action')
      .isIn(['approve', 'reject', 'schedule-pickup', 'mark-received', 'issue-refund', 'close'])
      .withMessage('Invalid return automation action'),
    validateRequest,
  ],
  orderController.processReturnAutomation,
);
router.get('/:id', orderController.getOrderById);
router.get('/:id/invoice', orderController.generateInvoice);
router.patch('/:id/farmer-decision', restrictTo('farmer'), orderController.setFarmerDecision);
router.patch('/:id/status', restrictTo('admin', 'farmer'), orderController.updateOrderStatus);
router.patch('/:id/tracking', restrictTo('admin'), orderController.updateTracking);

module.exports = router;
