const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

const WISHLIST_POPULATE_OPTIONS = {
  path: 'wishlist',
  populate: [
    { path: 'category', select: 'name' },
    { path: 'farmer', select: 'name isFarmerVerified location' },
  ],
};

const SUBSCRIBED_FARMERS_POPULATE_OPTIONS = {
  path: 'subscribedFarmers',
  select: 'name location isFarmerVerified avatar farmerProfile',
};

const toggleWishlist = catchAsync(async (req, res, next) => {
  const { productId } = req.params;
  const productExists = await Product.findById(productId);

  if (!productExists) {
    return next(new AppError('Product not found', 404));
  }

  const user = await User.findById(req.user._id);
  const exists = user.wishlist.some((id) => String(id) === String(productId));

  if (exists) {
    user.wishlist = user.wishlist.filter((id) => String(id) !== String(productId));
  } else {
    user.wishlist.push(productId);
  }

  await user.save();

  const hydrated = await User.findById(req.user._id).populate(WISHLIST_POPULATE_OPTIONS);

  res.status(200).json({
    status: 'success',
    isWishlisted: !exists,
    wishlist: hydrated.wishlist || [],
  });
});

const getMyWishlist = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).populate(WISHLIST_POPULATE_OPTIONS);
  const onlyInStock = req.query.inStock === 'true';

  const wishlist = (user.wishlist || []).filter((product) => {
    if (!product) return false;
    if (!onlyInStock) return true;
    return Number(product.quantityAvailable || 0) > 0 && product.status === 'approved';
  });

  res.status(200).json({
    status: 'success',
    count: wishlist.length,
    wishlist,
  });
});

const clearWishlist = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id);
  user.wishlist = [];
  await user.save();

  res.status(200).json({
    status: 'success',
    wishlist: [],
  });
});

const subscribeFarmer = catchAsync(async (req, res, next) => {
  const { farmerId } = req.params;
  const farmer = await User.findById(farmerId);

  if (!farmer || farmer.role !== 'farmer') {
    return next(new AppError('Farmer not found', 404));
  }

  const user = await User.findById(req.user._id);
  const exists = user.subscribedFarmers.some((id) => String(id) === String(farmerId));

  if (exists) {
    user.subscribedFarmers = user.subscribedFarmers.filter((id) => String(id) !== String(farmerId));
  } else {
    user.subscribedFarmers.push(farmerId);
  }

  await user.save();

  const hydrated = await User.findById(req.user._id).populate(SUBSCRIBED_FARMERS_POPULATE_OPTIONS);

  res.status(200).json({
    status: 'success',
    subscribedFarmers: hydrated.subscribedFarmers || [],
  });
});

const getPurchaseHistory = catchAsync(async (req, res) => {
  const orders = await Order.find({ buyer: req.user._id })
    .sort({ createdAt: -1 })
    .populate('items.product', 'name images')
    .populate('items.farmer', 'name');

  res.status(200).json({
    status: 'success',
    count: orders.length,
    orders,
  });
});

module.exports = {
  toggleWishlist,
  getMyWishlist,
  clearWishlist,
  subscribeFarmer,
  getPurchaseHistory,
};
