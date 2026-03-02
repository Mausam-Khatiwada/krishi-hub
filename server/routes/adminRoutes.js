const express = require('express');
const adminController = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');
const { restrictTo } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(protect, restrictTo('admin'));

router.get('/dashboard', adminController.getDashboardStats);
router.get('/intelligence/overview', adminController.getIntelligenceOverview);
router.get('/intelligence/dynamic-pricing', adminController.getDynamicPricingInsights);
router.post('/intelligence/dynamic-pricing/apply', adminController.applyDynamicPricingUpdates);
router.get('/intelligence/inventory', adminController.getInventoryAutomationInsights);
router.post('/intelligence/inventory/automate', adminController.runInventoryAutomation);
router.get('/intelligence/marketing', adminController.getMarketingAutomationInsights);
router.post('/intelligence/marketing/launch', adminController.launchAutomatedCampaign);
router.get('/users', adminController.listUsers);
router.get('/audit-logs', adminController.listAuditLogs);
router.patch('/users/bulk', adminController.bulkUserAction);
router.patch('/users/:id/wallet', adminController.adjustUserWallet);
router.patch('/users/:id/account-status', adminController.setUserAccountStatus);
router.patch('/users/:id/block', adminController.blockOrUnblockUser);
router.patch('/farmers/:id/verify', adminController.verifyFarmer);
router.get('/products', adminController.listProducts);
router.get('/orders', adminController.listOrders);
router.delete('/products/:id', adminController.removeProductListing);
router.delete('/forum/:id', adminController.removeForumPost);
router.post('/announcements', adminController.announcement);
router.get('/announcements/history', adminController.announcementHistory);
router.get('/export', adminController.exportDataAsCsv);
router.get('/reports', adminController.reportSnapshot);

module.exports = router;
