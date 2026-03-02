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

const PRODUCT_ALERT_POPULATE_OPTIONS = {
  path: 'productAlerts.product',
  select: 'name images pricePerUnit quantityAvailable status organic location category farmer',
  populate: [
    { path: 'category', select: 'name' },
    { path: 'farmer', select: 'name isFarmerVerified location' },
  ],
};

const ORDER_COMPLETED_STATES = ['paid', 'shipped', 'delivered'];
const MILLIS_PER_DAY = 1000 * 60 * 60 * 24;

const parseBooleanFlag = (value, fallback) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  return fallback;
};

const normalizeTargetPrice = (value) => {
  if (value === '' || value === null || typeof value === 'undefined') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return NaN;
  return Number(parsed.toFixed(2));
};

const formatProductAlerts = (user) =>
  (user?.productAlerts || [])
    .filter((alert) => alert.product)
    .map((alert) => ({
      product: alert.product,
      targetPrice: typeof alert.targetPrice === 'number' ? alert.targetPrice : null,
      notifyOnPriceDrop: alert.notifyOnPriceDrop !== false,
      notifyOnRestock: alert.notifyOnRestock !== false,
      trackedAt: alert.createdAt,
      lastUpdatedAt: alert.updatedAt,
      status: {
        isInStock: Number(alert.product.quantityAvailable || 0) > 0,
        priceReached:
          typeof alert.targetPrice === 'number' ? Number(alert.product.pricePerUnit) <= alert.targetPrice : false,
      },
    }));

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

const getMyProductAlerts = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).populate(PRODUCT_ALERT_POPULATE_OPTIONS);
  const alerts = formatProductAlerts(user);

  res.status(200).json({
    status: 'success',
    count: alerts.length,
    alerts,
  });
});

const upsertProductAlert = catchAsync(async (req, res, next) => {
  const { productId } = req.params;
  const targetPrice = normalizeTargetPrice(req.body.targetPrice);

  if (Number.isNaN(targetPrice)) {
    return next(new AppError('Target price must be a valid non-negative number', 400));
  }

  const notifyOnPriceDrop = parseBooleanFlag(req.body.notifyOnPriceDrop, undefined);
  const notifyOnRestock = parseBooleanFlag(req.body.notifyOnRestock, undefined);
  const active = parseBooleanFlag(req.body.active, true);

  const user = await User.findById(req.user._id);
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  if (!Array.isArray(user.productAlerts)) {
    user.productAlerts = [];
  }

  const existingIndex = user.productAlerts.findIndex((item) => String(item.product) === String(productId));

  if (!active) {
    if (existingIndex >= 0) {
      user.productAlerts.splice(existingIndex, 1);
      await user.save();
    }

    const hydrated = await User.findById(req.user._id).populate(PRODUCT_ALERT_POPULATE_OPTIONS);

    return res.status(200).json({
      status: 'success',
      isTracking: false,
      alerts: formatProductAlerts(hydrated),
    });
  }

  const product = await Product.findById(productId);
  if (!product || product.status !== 'approved') {
    return next(new AppError('Product not found or unavailable for alerts', 404));
  }

  if (existingIndex >= 0) {
    if (typeof targetPrice === 'number' || targetPrice === null) {
      user.productAlerts[existingIndex].targetPrice = targetPrice;
    }

    if (typeof notifyOnPriceDrop === 'boolean') {
      user.productAlerts[existingIndex].notifyOnPriceDrop = notifyOnPriceDrop;
    }

    if (typeof notifyOnRestock === 'boolean') {
      user.productAlerts[existingIndex].notifyOnRestock = notifyOnRestock;
    }

    user.productAlerts[existingIndex].updatedAt = new Date();
  } else {
    user.productAlerts.push({
      product: product._id,
      targetPrice,
      notifyOnPriceDrop: typeof notifyOnPriceDrop === 'boolean' ? notifyOnPriceDrop : true,
      notifyOnRestock: typeof notifyOnRestock === 'boolean' ? notifyOnRestock : true,
      lastNotifiedPrice: product.pricePerUnit,
      lastNotifiedStock: product.quantityAvailable,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  await user.save();

  const hydrated = await User.findById(req.user._id).populate(PRODUCT_ALERT_POPULATE_OPTIONS);

  res.status(200).json({
    status: 'success',
    isTracking: true,
    alerts: formatProductAlerts(hydrated),
  });
});

const getBuyerBuyAgainInsights = catchAsync(async (req, res) => {
  const orders = await Order.find({
    buyer: req.user._id,
    status: { $in: ORDER_COMPLETED_STATES },
  })
    .sort({ createdAt: -1 })
    .select('items createdAt')
    .lean();

  const metricsByProduct = new Map();

  orders.forEach((order) => {
    (order.items || []).forEach((item) => {
      const productId = String(item.product);
      if (!metricsByProduct.has(productId)) {
        metricsByProduct.set(productId, {
          productId,
          productName: item.productName,
          orderHits: 0,
          totalUnits: 0,
          totalSpend: 0,
          avgUnitPriceAcc: 0,
          purchaseDates: [],
        });
      }

      const bucket = metricsByProduct.get(productId);
      bucket.orderHits += 1;
      bucket.totalUnits += Number(item.quantity || 0);
      bucket.totalSpend += Number(item.subtotal || 0);
      bucket.avgUnitPriceAcc += Number(item.unitPrice || 0);
      bucket.purchaseDates.push(order.createdAt);
    });
  });

  const productIds = [...metricsByProduct.keys()];
  const availableProducts = await Product.find({
    _id: { $in: productIds },
    status: 'approved',
  })
    .select('name images pricePerUnit quantityAvailable organic category farmer')
    .populate('category', 'name')
    .populate('farmer', 'name isFarmerVerified')
    .lean();

  const productMap = new Map(availableProducts.map((product) => [String(product._id), product]));
  const now = Date.now();

  const buyAgain = productIds
    .map((productId) => {
      const metric = metricsByProduct.get(productId);
      const product = productMap.get(productId);
      if (!metric || !product) return null;

      const sortedDates = [...metric.purchaseDates]
        .map((value) => new Date(value))
        .sort((a, b) => a.getTime() - b.getTime());
      const lastPurchasedAt = sortedDates[sortedDates.length - 1] || null;
      const gaps = [];

      for (let index = 1; index < sortedDates.length; index += 1) {
        gaps.push((sortedDates[index].getTime() - sortedDates[index - 1].getTime()) / MILLIS_PER_DAY);
      }

      const averageReorderDays = gaps.length ? Number((gaps.reduce((sum, value) => sum + value, 0) / gaps.length).toFixed(1)) : null;
      const nextLikelyReorderAt =
        averageReorderDays && lastPurchasedAt
          ? new Date(lastPurchasedAt.getTime() + averageReorderDays * MILLIS_PER_DAY)
          : null;

      let urgency = 'low';
      let daysUntilLikelyReorder = null;

      if (nextLikelyReorderAt) {
        daysUntilLikelyReorder = Math.ceil((nextLikelyReorderAt.getTime() - now) / MILLIS_PER_DAY);
        if (daysUntilLikelyReorder <= 0) urgency = 'high';
        else if (daysUntilLikelyReorder <= 4) urgency = 'medium';
      }

      return {
        product,
        productName: metric.productName || product.name,
        metrics: {
          orderHits: metric.orderHits,
          totalUnits: metric.totalUnits,
          totalSpend: Number(metric.totalSpend.toFixed(2)),
          averagePaidPrice: Number((metric.avgUnitPriceAcc / Math.max(metric.orderHits, 1)).toFixed(2)),
          averageReorderDays,
          lastPurchasedAt,
          nextLikelyReorderAt,
          daysUntilLikelyReorder,
          urgency,
          suggestedQuantity: Math.max(1, Math.round(metric.totalUnits / Math.max(metric.orderHits, 1))),
        },
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.metrics.orderHits - a.metrics.orderHits || b.metrics.totalSpend - a.metrics.totalSpend)
    .slice(0, 10);

  res.status(200).json({
    status: 'success',
    insights: {
      totalEligibleOrders: orders.length,
      buyAgain,
      generatedAt: new Date(),
    },
  });
});

const getFarmerDemandInsights = catchAsync(async (req, res) => {
  const [farmerProducts, recentOrders, marketPriceAgg] = await Promise.all([
    Product.find({ farmer: req.user._id })
      .select('name category pricePerUnit quantityAvailable organic status images')
      .populate('category', 'name')
      .lean(),
    Order.find({
      status: { $in: ORDER_COMPLETED_STATES },
      createdAt: { $gte: new Date(Date.now() - 90 * MILLIS_PER_DAY) },
      'items.farmer': req.user._id,
    })
      .select('items createdAt buyer')
      .lean(),
    Product.aggregate([
      { $match: { status: 'approved' } },
      {
        $group: {
          _id: '$category',
          avgPricePerUnit: { $avg: '$pricePerUnit' },
        },
      },
    ]),
  ]);

  const productStats = new Map();
  const window30 = Date.now() - 30 * MILLIS_PER_DAY;
  const window7 = Date.now() - 7 * MILLIS_PER_DAY;

  recentOrders.forEach((order) => {
    (order.items || []).forEach((item) => {
      if (String(item.farmer) !== String(req.user._id)) return;

      const productId = String(item.product);
      if (!productStats.has(productId)) {
        productStats.set(productId, {
          sold7d: 0,
          sold30d: 0,
          sold90d: 0,
          revenue90d: 0,
          lastSoldAt: null,
        });
      }

      const bucket = productStats.get(productId);
      const orderTime = new Date(order.createdAt).getTime();
      const qty = Number(item.quantity || 0);
      const subtotal = Number(item.subtotal || 0);

      bucket.sold90d += qty;
      bucket.revenue90d += subtotal;
      if (orderTime >= window30) bucket.sold30d += qty;
      if (orderTime >= window7) bucket.sold7d += qty;
      if (!bucket.lastSoldAt || new Date(order.createdAt) > new Date(bucket.lastSoldAt)) {
        bucket.lastSoldAt = order.createdAt;
      }
    });
  });

  const marketPriceMap = new Map(
    marketPriceAgg
      .filter((item) => item?._id)
      .map((item) => [String(item._id), Number(item.avgPricePerUnit || 0)]),
  );

  const rank = { critical: 3, watch: 2, stable: 1 };

  const productInsights = farmerProducts
    .map((product) => {
      const stats = productStats.get(String(product._id)) || {
        sold7d: 0,
        sold30d: 0,
        sold90d: 0,
        revenue90d: 0,
        lastSoldAt: null,
      };

      const currentQty = Number(product.quantityAvailable || 0);
      const dailyVelocity30d = Number((stats.sold30d / 30).toFixed(2));
      const daysToStockout =
        dailyVelocity30d > 0 ? Number((currentQty / dailyVelocity30d).toFixed(1)) : null;
      const reorderPoint = Math.max(5, Math.ceil(dailyVelocity30d * 14));
      const recommendedRestock = Math.max(0, Math.ceil(dailyVelocity30d * 30 - currentQty));

      let stockRisk = 'stable';
      if (currentQty <= 0) stockRisk = 'critical';
      else if (daysToStockout !== null && daysToStockout <= 7) stockRisk = 'critical';
      else if (daysToStockout !== null && daysToStockout <= 21) stockRisk = 'watch';

      let demandSignal = 'steady';
      const weeklyRunRateFromMonthly = stats.sold30d / 4;
      if (stats.sold7d >= weeklyRunRateFromMonthly * 1.25 && stats.sold7d > 0) demandSignal = 'surging';
      else if (stats.sold7d <= weeklyRunRateFromMonthly * 0.7 && stats.sold30d > 0) demandSignal = 'cooling';

      const marketAveragePrice = marketPriceMap.get(String(product.category?._id || product.category)) || null;
      let suggestedPrice = Number(product.pricePerUnit || 0);

      if (marketAveragePrice) {
        suggestedPrice = (suggestedPrice + marketAveragePrice) / 2;
      }

      if (demandSignal === 'surging') suggestedPrice *= 1.03;
      if (stockRisk === 'critical') suggestedPrice *= 1.04;
      if (stockRisk === 'stable' && currentQty > reorderPoint * 2 && stats.sold30d > 0) suggestedPrice *= 0.97;
      if (product.organic) suggestedPrice *= 1.02;

      suggestedPrice = Number(Math.max(1, suggestedPrice).toFixed(2));
      const priceGap = Number((suggestedPrice - Number(product.pricePerUnit || 0)).toFixed(2));

      return {
        product,
        metrics: {
          sold7d: stats.sold7d,
          sold30d: stats.sold30d,
          sold90d: stats.sold90d,
          revenue90d: Number(stats.revenue90d.toFixed(2)),
          lastSoldAt: stats.lastSoldAt,
          dailyVelocity30d,
          daysToStockout,
          reorderPoint,
          recommendedRestock,
          stockRisk,
          demandSignal,
          marketAveragePrice: marketAveragePrice ? Number(marketAveragePrice.toFixed(2)) : null,
          suggestedPrice,
          suggestedPriceDelta: priceGap,
        },
      };
    })
    .sort(
      (a, b) =>
        rank[b.metrics.stockRisk] - rank[a.metrics.stockRisk] ||
        b.metrics.revenue90d - a.metrics.revenue90d,
    );

  res.status(200).json({
    status: 'success',
    insights: {
      generatedAt: new Date(),
      summary: {
        productsTracked: productInsights.length,
        criticalStockCount: productInsights.filter((item) => item.metrics.stockRisk === 'critical').length,
        watchStockCount: productInsights.filter((item) => item.metrics.stockRisk === 'watch').length,
        recommendedRestockTotal: productInsights.reduce(
          (sum, item) => sum + Number(item.metrics.recommendedRestock || 0),
          0,
        ),
      },
      productInsights,
    },
  });
});

const getFarmerCustomerInsights = catchAsync(async (req, res) => {
  const farmerId = req.user._id;
  const customerAgg = await Order.aggregate([
    {
      $match: {
        status: { $in: ORDER_COMPLETED_STATES },
        'items.farmer': farmerId,
      },
    },
    { $unwind: '$items' },
    { $match: { 'items.farmer': farmerId } },
    {
      $group: {
        _id: {
          buyer: '$buyer',
          orderId: '$_id',
        },
        spendPerOrder: { $sum: '$items.subtotal' },
        unitsPerOrder: { $sum: '$items.quantity' },
        lastOrderAt: { $max: '$createdAt' },
      },
    },
    {
      $group: {
        _id: '$_id.buyer',
        ordersCount: { $sum: 1 },
        totalSpend: { $sum: '$spendPerOrder' },
        totalUnits: { $sum: '$unitsPerOrder' },
        averageOrderValue: { $avg: '$spendPerOrder' },
        lastOrderAt: { $max: '$lastOrderAt' },
      },
    },
    { $sort: { totalSpend: -1 } },
    { $limit: 20 },
  ]);

  const buyers = await User.find({
    _id: { $in: customerAgg.map((item) => item._id) },
  })
    .select('name email avatar location')
    .lean();

  const buyerMap = new Map(buyers.map((buyer) => [String(buyer._id), buyer]));

  const customers = customerAgg.map((item) => {
    const buyer = buyerMap.get(String(item._id));
    const daysSinceLastOrder = Math.max(
      0,
      Math.floor((Date.now() - new Date(item.lastOrderAt).getTime()) / MILLIS_PER_DAY),
    );

    let segment = 'emerging';
    if (item.ordersCount >= 6 || item.totalSpend >= 30000) segment = 'vip';
    else if (item.ordersCount >= 3 || item.totalSpend >= 10000) segment = 'loyal';

    let churnRisk = 'low';
    if (daysSinceLastOrder > 45) churnRisk = 'high';
    else if (daysSinceLastOrder > 21) churnRisk = 'medium';

    return {
      buyer: buyer || { _id: item._id, name: 'Unknown buyer' },
      metrics: {
        ordersCount: item.ordersCount,
        totalSpend: Number(item.totalSpend.toFixed(2)),
        totalUnits: item.totalUnits,
        averageOrderValue: Number(item.averageOrderValue.toFixed(2)),
        lastOrderAt: item.lastOrderAt,
        daysSinceLastOrder,
        segment,
        churnRisk,
      },
    };
  });

  res.status(200).json({
    status: 'success',
    insights: {
      generatedAt: new Date(),
      summary: {
        repeatCustomers: customers.filter((item) => item.metrics.ordersCount > 1).length,
        vipCustomers: customers.filter((item) => item.metrics.segment === 'vip').length,
        highChurnRisk: customers.filter((item) => item.metrics.churnRisk === 'high').length,
      },
      customers,
    },
  });
});

module.exports = {
  toggleWishlist,
  getMyWishlist,
  clearWishlist,
  subscribeFarmer,
  getPurchaseHistory,
  getMyProductAlerts,
  upsertProductAlert,
  getBuyerBuyAgainInsights,
  getFarmerDemandInsights,
  getFarmerCustomerInsights,
};
