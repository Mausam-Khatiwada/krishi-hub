const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateMiddleware');

const router = express.Router();

const registerValidators = [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['farmer', 'buyer']).withMessage('Role must be farmer or buyer'),
];

router.post('/register/request-otp', [...registerValidators, validateRequest], authController.requestRegisterOtp);

router.post(
  '/register/verify',
  [
    body('registerChallengeToken').notEmpty().withMessage('Registration challenge token is required'),
    body('otpCode')
      .notEmpty()
      .isNumeric()
      .withMessage('OTP code must be numeric')
      .bail()
      .isLength({ min: 4, max: 8 })
      .withMessage('OTP code must be 4-8 digits'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    validateRequest,
  ],
  authController.verifyRegisterOtp,
);

router.post(
  '/register/resend-otp',
  [
    body('registerChallengeToken').notEmpty().withMessage('Registration challenge token is required'),
    validateRequest,
  ],
  authController.resendRegisterOtp,
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
    body('twoFactorCode')
      .optional({ values: 'falsy' })
      .isNumeric()
      .withMessage('Two-factor code must be numeric')
      .bail()
      .isLength({ min: 6, max: 6 })
      .withMessage('Two-factor code must be 6 digits'),
    body('twoFactorAuthToken')
      .optional()
      .isString()
      .withMessage('Two-factor auth token must be a string'),
    validateRequest,
  ],
  authController.login,
);

router.post(
  '/google',
  [
    body('credential').notEmpty().withMessage('Google credential is required'),
    body('role').optional().isIn(['farmer', 'buyer']).withMessage('Role must be farmer or buyer'),
    body('twoFactorCode')
      .optional({ values: 'falsy' })
      .isNumeric()
      .withMessage('Two-factor code must be numeric')
      .bail()
      .isLength({ min: 6, max: 6 })
      .withMessage('Two-factor code must be 6 digits'),
    body('twoFactorAuthToken')
      .optional()
      .isString()
      .withMessage('Two-factor auth token must be a string'),
    validateRequest,
  ],
  authController.loginWithGoogle,
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
router.post('/2fa/setup', protect, authController.setupTwoFactor);
router.post(
  '/2fa/enable',
  protect,
  [
    body('token').isLength({ min: 6, max: 6 }).withMessage('Authentication code must be 6 digits'),
    validateRequest,
  ],
  authController.enableTwoFactor,
);
router.post(
  '/2fa/disable',
  protect,
  [
    body('token').isLength({ min: 6, max: 6 }).withMessage('Authentication code must be 6 digits'),
    validateRequest,
  ],
  authController.disableTwoFactor,
);
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
