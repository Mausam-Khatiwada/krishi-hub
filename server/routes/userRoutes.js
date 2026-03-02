const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { restrictTo } = require('../middleware/roleMiddleware');
const userController = require('../controllers/userController');

const router = express.Router();

router.use(protect);

router.get('/wishlist', restrictTo('buyer'), userController.getMyWishlist);
router.delete('/wishlist', restrictTo('buyer'), userController.clearWishlist);
router.patch('/wishlist/:productId', restrictTo('buyer'), userController.toggleWishlist);
router.patch('/subscribe/:farmerId', restrictTo('buyer'), userController.subscribeFarmer);
router.get('/purchase-history', restrictTo('buyer'), userController.getPurchaseHistory);
router.get('/alerts', restrictTo('buyer'), userController.getMyProductAlerts);
router.patch('/alerts/:productId', restrictTo('buyer'), userController.upsertProductAlert);
router.get('/insights/buyer-buy-again', restrictTo('buyer'), userController.getBuyerBuyAgainInsights);
router.get('/insights/farmer-demand', restrictTo('farmer'), userController.getFarmerDemandInsights);
router.get('/insights/farmer-customers', restrictTo('farmer'), userController.getFarmerCustomerInsights);

module.exports = router;
