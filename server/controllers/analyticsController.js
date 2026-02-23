const Product = require('../models/Product');
const Order = require('../models/Order');
const catchAsync = require('../utils/catchAsync');

const getCropPriceTrends = catchAsync(async (_req, res) => {
  const trends = await Product.aggregate([
    {
      $group: {
        _id: '$category',
        averagePrice: { $avg: '$pricePerUnit' },
        minPrice: { $min: '$pricePerUnit' },
        maxPrice: { $max: '$pricePerUnit' },
        count: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: 'categories',
        localField: '_id',
        foreignField: '_id',
        as: 'category',
      },
    },
    {
      $project: {
        categoryName: { $ifNull: [{ $arrayElemAt: ['$category.name', 0] }, 'Uncategorized'] },
        averagePrice: { $round: ['$averagePrice', 2] },
        minPrice: 1,
        maxPrice: 1,
        count: 1,
      },
    },
  ]);

  const orderTrends = await Order.aggregate([
    {
      $match: {
        paymentStatus: 'paid',
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
        revenue: { $sum: '$totalAmount' },
      },
    },
    { $sort: { _id: 1 } },
    { $limit: 12 },
  ]);

  res.status(200).json({
    status: 'success',
    trends,
    orderTrends,
  });
});

module.exports = {
  getCropPriceTrends,
};
