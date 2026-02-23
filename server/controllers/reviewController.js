const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

const updateProductRating = async (productId) => {
  const stats = await Review.aggregate([
    { $match: { product: productId } },
    {
      $group: {
        _id: '$product',
        avgRating: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ]);

  const payload = stats[0]
    ? {
        ratingAverage: Number(stats[0].avgRating.toFixed(2)),
        ratingCount: stats[0].count,
      }
    : {
        ratingAverage: 0,
        ratingCount: 0,
      };

  await Product.findByIdAndUpdate(productId, payload);
};

const createReview = catchAsync(async (req, res, next) => {
  const { productId, orderId, rating, comment } = req.body;

  const order = await Order.findOne({
    _id: orderId,
    buyer: req.user._id,
    status: { $in: ['delivered', 'paid'] },
    'items.product': productId,
  });

  if (!order) {
    return next(new AppError('You can review only purchased and completed products', 400));
  }

  const review = await Review.create({
    buyer: req.user._id,
    product: productId,
    order: orderId,
    rating,
    comment,
  });

  await updateProductRating(productId);

  res.status(201).json({
    status: 'success',
    review,
  });
});

const listProductReviews = catchAsync(async (req, res) => {
  const reviews = await Review.find({ product: req.params.productId })
    .populate('buyer', 'name')
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: 'success',
    count: reviews.length,
    reviews,
  });
});

module.exports = {
  createReview,
  listProductReviews,
};
