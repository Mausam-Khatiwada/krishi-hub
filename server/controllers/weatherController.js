const axios = require('axios');
const catchAsync = require('../utils/catchAsync');

const getWeatherByLocation = catchAsync(async (req, res) => {
  const { lat, lng, district } = req.query;

  if (!process.env.WEATHER_API_KEY) {
    return res.status(200).json({
      status: 'success',
      weather: {
        fallback: true,
        note: 'Set WEATHER_API_KEY to fetch live weather data',
      },
    });
  }

  const q = district || `${lat},${lng}`;

  const { data } = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
    params: {
      q,
      lat,
      lon: lng,
      appid: process.env.WEATHER_API_KEY,
      units: 'metric',
    },
  });

  res.status(200).json({
    status: 'success',
    weather: {
      location: data.name,
      temperature: data.main.temp,
      humidity: data.main.humidity,
      windSpeed: data.wind.speed,
      condition: data.weather?.[0]?.description,
    },
  });
});

module.exports = {
  getWeatherByLocation,
};
