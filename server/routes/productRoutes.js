const express = require('express');
const { body } = require('express-validator');
const productController = require('../controllers/productController');
const { protect } = require('../middleware/authMiddleware');
const { restrictTo } = require('../middleware/roleMiddleware');
const validateRequest = require('../middleware/validateMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

router.get('/', productController.listProducts);
router.get('/farmer/:farmerId', productController.listFarmerProducts);
router.get('/:id', productController.getProductById);

router.use(protect);

router.get('/farmer/list/me', restrictTo('farmer'), productController.listFarmerProducts);
router.get('/recommendations/for/me', restrictTo('buyer', 'farmer'), productController.getRecommendations);
router.post('/price-suggestion', restrictTo('farmer'), productController.getPriceSuggestion);

router.post(
  '/',
  restrictTo('farmer'),
  upload.fields([
    { name: 'images', maxCount: 8 },
    { name: 'videos', maxCount: 2 },
  ]),
  [
    body('name').trim().notEmpty().withMessage('Product name is required'),
    body('category').notEmpty().withMessage('Category is required'),
    body('description').notEmpty().withMessage('Description is required'),
    body('pricePerUnit').isFloat({ min: 0 }).withMessage('Price must be non-negative'),
    body('quantityAvailable').isInt({ min: 0 }).withMessage('Quantity must be non-negative'),
    validateRequest,
  ],
  productController.createProduct,
);

router.patch(
  '/:id',
  upload.fields([
    { name: 'images', maxCount: 8 },
    { name: 'videos', maxCount: 2 },
  ]),
  productController.updateProduct,
);
router.delete('/:id', productController.deleteProduct);
router.patch('/:id/moderate', restrictTo('admin'), productController.moderateProduct);

module.exports = router;
