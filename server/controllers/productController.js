const fs = require('fs');
const path = require('path');
const Product = require('../models/Product');
const Review = require('../models/Review');
const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const paginate = require('../utils/paginate');
const { recommendProducts } = require('../utils/recommendation');
const { suggestPrice } = require('../utils/priceSuggestion');

const buildFileUrl = (req, file) => {
  const relative = file.path.replace(/\\/g, '/');
  return {
    url: `${req.protocol}://${req.get('host')}/${relative}`,
    publicId: file.filename,
    mimeType: file.mimetype,
  };
};

const createProduct = catchAsync(async (req, res) => {
  const images = (req.files?.images || []).map((file) => buildFileUrl(req, file));
  const videos = (req.files?.videos || []).map((file) => buildFileUrl(req, file));

  const product = await Product.create({
    ...req.body,
    farmer: req.user._id,
    organic: req.body.organic === true || req.body.organic === 'true',
    location: {
      district: req.body.district,
      province: req.body.province,
      country: req.body.country || 'Nepal',
      lat: req.body.lat,
      lng: req.body.lng,
    },
    tags: req.body.tags ? req.body.tags.split(',').map((tag) => tag.trim()) : [],
    images,
    videos,
  });

  res.status(201).json({
    status: 'success',
    message: 'Product submitted for admin approval',
    product,
  });
});

const listProducts = catchAsync(async (req, res) => {
  const {
    category,
    minPrice,
    maxPrice,
    location,
    organic,
    search,
    sort = 'newest',
    page = 1,
    limit = 12,
  } = req.query;

  const filter = {
    status: 'approved',
  };

  if (category) {
    filter.category = category;
  }

  if (organic === 'true') {
    filter.organic = true;
  }

  if (organic === 'false') {
    filter.organic = false;
  }

  if (minPrice || maxPrice) {
    filter.pricePerUnit = {};
    if (minPrice) filter.pricePerUnit.$gte = Number(minPrice);
    if (maxPrice) filter.pricePerUnit.$lte = Number(maxPrice);
  }

  if (location) {
    filter.$or = [
      { 'location.district': new RegExp(location, 'i') },
      { 'location.province': new RegExp(location, 'i') },
    ];
  }

  if (search) {
    filter.$text = { $search: search };
  }

  const sortMap = {
    newest: { createdAt: -1 },
    price_asc: { pricePerUnit: 1 },
    price_desc: { pricePerUnit: -1 },
    popularity: { popularity: -1 },
  };

  let query = Product.find(filter)
    .populate('farmer', 'name isFarmerVerified badges location')
    .populate('category', 'name')
    .sort(sortMap[sort] || sortMap.newest);

  const total = await Product.countDocuments(filter);

  const { safePage, safeLimit, query: paginatedQuery } = paginate(query, { page, limit });
  const products = await paginatedQuery;

  res.status(200).json({
    status: 'success',
    page: safePage,
    limit: safeLimit,
    total,
    products,
  });
});

const getProductById = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id)
    .populate('farmer', 'name isFarmerVerified badges location')
    .populate('category', 'name');

  if (!product) {
    return next(new AppError('Product not found', 404));
  }

  const reviews = await Review.find({ product: product._id }).populate('buyer', 'name');

  res.status(200).json({
    status: 'success',
    product,
    reviews,
  });
});

const updateProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new AppError('Product not found', 404));
  }

  const isOwner = String(product.farmer) === String(req.user._id);
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isAdmin) {
    return next(new AppError('You can only edit your own product', 403));
  }

  const moderationFields = ['name', 'category', 'description', 'organic', 'tags'];
  const hasModerationFieldChange = moderationFields.some((field) => field in req.body);
  const hasMediaChange = Boolean(req.files?.images?.length || req.files?.videos?.length);

  if (!isAdmin && (hasModerationFieldChange || hasMediaChange)) {
    req.body.status = 'pending';
  }

  if (req.files?.images?.length) {
    req.body.images = req.files.images.map((file) => buildFileUrl(req, file));
  }

  if (req.files?.videos?.length) {
    req.body.videos = req.files.videos.map((file) => buildFileUrl(req, file));
  }

  const updated = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (req.io) {
    req.io.emit('inventory:update', {
      productId: updated._id,
      quantityAvailable: updated.quantityAvailable,
    });
  }

  res.status(200).json({
    status: 'success',
    product: updated,
  });
});

const deleteProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new AppError('Product not found', 404));
  }

  const isOwner = String(product.farmer) === String(req.user._id);
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isAdmin) {
    return next(new AppError('Not authorized to delete this product', 403));
  }

  [...(product.images || []), ...(product.videos || [])].forEach((file) => {
    if (file.publicId && fs.existsSync(path.join('uploads', file.publicId))) {
      fs.unlinkSync(path.join('uploads', file.publicId));
    }
  });

  await product.deleteOne();

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

const listFarmerProducts = catchAsync(async (req, res) => {
  const farmerId = req.params.farmerId || req.user._id;
  const products = await Product.find({ farmer: farmerId })
    .sort({ createdAt: -1 })
    .populate('category', 'name');

  res.status(200).json({
    status: 'success',
    count: products.length,
    products,
  });
});

const moderateProduct = catchAsync(async (req, res, next) => {
  const { status } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return next(new AppError('Status must be approved or rejected', 400));
  }

  const product = await Product.findByIdAndUpdate(
    req.params.id,
    {
      status,
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!product) {
    return next(new AppError('Product not found', 404));
  }

  res.status(200).json({
    status: 'success',
    product,
  });
});

const getRecommendations = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).populate('wishlist', 'category').lean();

  const products = await Product.find({ status: 'approved' })
    .populate('category', 'name')
    .populate('farmer', 'name isFarmerVerified')
    .limit(100)
    .lean();

  const recommended = recommendProducts({
    products,
    wishlist: user?.wishlist || [],
    subscriptions: user?.subscribedFarmers || [],
  }).slice(0, 20);

  res.status(200).json({
    status: 'success',
    recommendations: recommended,
  });
});

const getPriceSuggestion = catchAsync(async (req, res) => {
  const { basePrice, organic, weatherFactor, trendFactor, quantity } = req.body;

  const suggestedPrice = suggestPrice({
    basePrice,
    isOrganic: organic === true || organic === 'true',
    weatherFactor: Number(weatherFactor || 1),
    trendFactor: Number(trendFactor || 1),
    quantity: Number(quantity || 0),
  });

  res.status(200).json({
    status: 'success',
    suggestedPrice,
  });
});

module.exports = {
  createProduct,
  listProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  listFarmerProducts,
  moderateProduct,
  getRecommendations,
  getPriceSuggestion,
};
