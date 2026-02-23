const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateMiddleware');

const router = express.Router();

router.post(
  '/register',
  [
    body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn(['farmer', 'buyer']).withMessage('Role must be farmer or buyer'),
    validateRequest,
  ],
  authController.register,
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
    validateRequest,
  ],
  authController.login,
);

router.post('/logout', authController.logout);
router.get('/me', protect, authController.getMe);
router.get('/account-overview', protect, authController.getAccountOverview);
router.patch('/me', protect, authController.updateMe);
router.patch(
  '/change-password',
  protect,
  [
    body('currentPassword').isLength({ min: 6 }).withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
    body('confirmPassword').isLength({ min: 6 }).withMessage('Confirm password is required'),
    validateRequest,
  ],
  authController.changePassword,
);
router.patch(
  '/change-email',
  protect,
  [
    body('newEmail').isEmail().withMessage('Valid new email is required'),
    body('password').isLength({ min: 6 }).withMessage('Current password is required'),
    validateRequest,
  ],
  authController.changeEmail,
);
router.patch('/preferences', protect, authController.updatePreferences);
router.patch('/security', protect, authController.updateSecurity);
router.patch('/addresses', protect, authController.updateAddresses);
router.patch('/role-profile', protect, authController.updateRoleProfile);
router.delete(
  '/deactivate',
  protect,
  [
    body('password').isLength({ min: 6 }).withMessage('Password is required'),
    validateRequest,
  ],
  authController.deactivateAccount,
);

module.exports = router;
