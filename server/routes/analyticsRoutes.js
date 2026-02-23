const express = require('express');
const analyticsController = require('../controllers/analyticsController');

const router = express.Router();

router.get('/crop-trends', analyticsController.getCropPriceTrends);

module.exports = router;
