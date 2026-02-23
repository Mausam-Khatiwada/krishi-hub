const express = require('express');
const weatherController = require('../controllers/weatherController');

const router = express.Router();

router.get('/', weatherController.getWeatherByLocation);

module.exports = router;
