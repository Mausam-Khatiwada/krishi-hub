const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Category = require('../models/Category');
const Coupon = require('../models/Coupon');
const Notification = require('../models/Notification');
const ForumPost = require('../models/ForumPost');
const AuditLog = require('../models/AuditLog');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { createNotification } = require('../utils/notify');

const escapeCsvCell = (value) => {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const rowsToCsv = (headers, rows) => {
  const headerLine = headers.join(',');
  const body = rows
    .map((row) => headers.map((header) => escapeCsvCell(row[header])).join(','))
    .join('\n');

  return `${headerLine}\n${body}`;
};

const getIpAddress = (req) =>
  req.headers['x-forwarded-for']?.split(',')?.[0]?.trim() ||
  req.ip ||
  req.socket?.remoteAddress ||
  '';

const recordAudit = (req, payload) => {
  AuditLog.create({
    actor: req.user._id,
    actorName: req.user.name,
    action: payload.action,
    targetType: payload.targetType || 'system',
    targetId: payload.targetId ? String(payload.targetId) : '',
    targetLabel: payload.targetLabel || '',
    details: payload.details || {},
    ipAddress: getIpAddress(req),
    userAgent: req.get('user-agent') || '',
  }).catch((error) => {
    console.error('Failed to create audit log entry:', error.message);
  });
};

const DAYS = {
  WEEK: 7,
  MONTH: 30,
  QUARTER: 90,
};

const toRecentDate = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

const roundTo = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeKey = (value) => String(value || '');

const aggregatePaidOrderItems = async (sinceDate) => {
  const pipeline = [
    { $match: { paymentStatus: 'paid' } },
    ...(sinceDate ? [{ $match: { createdAt: { $gte: sinceDate } } }] : []),
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        unitsSold: { $sum: '$items.quantity' },
        revenue: { $sum: '$items.subtotal' },
        orderCount: { $sum: 1 },
        avgUnitPrice: { $avg: '$items.unitPrice' },
      },
    },
  ];

  return Order.aggregate(pipeline);
};

const buildPricingRecommendations = async ({ limit = 40 } = {}) => {
  const maxLimit = Math.min(Math.max(Number(limit) || 40, 1), 120);
  const products = await Product.find({ status: 'approved' })
    .select('name category farmer pricePerUnit quantityAvailable ratingAverage ratingCount popularity')
    .sort({ popularity: -1, createdAt: -1 })
    .limit(400);

  if (!products.length) return [];

  const [categoryAverages, metrics30Rows, metrics7Rows] = await Promise.all([
    Product.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: '$category', avgPrice: { $avg: '$pricePerUnit' } } },
    ]),
    aggregatePaidOrderItems(toRecentDate(DAYS.MONTH)),
    aggregatePaidOrderItems(toRecentDate(DAYS.WEEK)),
  ]);

  const categoryPriceMap = new Map(categoryAverages.map((row) => [normalizeKey(row._id), Number(row.avgPrice || 0)]));
  const metrics30Map = new Map(metrics30Rows.map((row) => [normalizeKey(row._id), row]));
  const metrics7Map = new Map(metrics7Rows.map((row) => [normalizeKey(row._id), row]));

  const recommendations = products.map((product) => {
    const productId = normalizeKey(product._id);
    const categoryId = normalizeKey(product.category);
    const currentPrice = Number(product.pricePerUnit || 0);
    const quantity = Number(product.quantityAvailable || 0);
    const categoryAvgPrice = Number(categoryPriceMap.get(categoryId) || currentPrice || 0);
    const metrics30 = metrics30Map.get(productId) || {};
    const metrics7 = metrics7Map.get(productId) || {};
    const units30 = Number(metrics30.unitsSold || 0);
    const units7 = Number(metrics7.unitsSold || 0);

    const demandIndex = clamp(units30 / 25, 0, 2.2);
    const stockPressure = quantity <= 10 ? 0.12 : quantity <= 25 ? 0.08 : quantity <= 60 ? 0.03 : quantity >= 240 ? -0.07 : -0.01;
    const ratingScore = Number(product.ratingAverage || 0);
    const ratingBoost = ratingScore >= 4.6 ? 0.05 : ratingScore >= 4.2 ? 0.03 : ratingScore <= 3 ? -0.05 : 0;
    const trendBoost = units30 > 0 ? (units7 >= units30 * 0.35 ? 0.03 : -0.02) : 0;
    const categoryAlignment = currentPrice > 0 ? ((categoryAvgPrice - currentPrice) / currentPrice) * 0.32 : 0;
    const popularityBoost = clamp((Number(product.popularity || 0) / 1000) * 0.08, -0.02, 0.08);

    const changeRatioRaw =
      categoryAlignment + demandIndex * 0.05 + stockPressure + ratingBoost + trendBoost + popularityBoost;
    const recommendedChangeRatio = clamp(changeRatioRaw, -0.2, 0.25);
    const recommendedPrice = roundTo(Math.max(currentPrice * (1 + recommendedChangeRatio), 1));
    const confidenceRaw =
      0.45 +
      clamp(units30 / 120, 0, 0.25) +
      (product.ratingCount > 5 ? 0.08 : 0) +
      (Math.abs(recommendedChangeRatio) >= 0.03 ? 0.06 : 0) +
      (categoryAvgPrice > 0 ? 0.05 : 0);

    const confidence = clamp(confidenceRaw, 0.35, 0.95);

    return {
      productId,
      name: product.name,
      farmer: product.farmer,
      category: product.category,
      currentPrice: roundTo(currentPrice),
      recommendedPrice,
      deltaPercent: roundTo(recommendedChangeRatio * 100),
      confidence: roundTo(confidence * 100, 1),
      signals: {
        unitsSold30: units30,
        unitsSold7: units7,
        stock: quantity,
        categoryAvgPrice: roundTo(categoryAvgPrice),
        ratingAverage: roundTo(ratingScore),
        popularity: Number(product.popularity || 0),
      },
    };
  });

  return recommendations
    .filter((item) => item.currentPrice > 0 && Math.abs(item.deltaPercent) >= 1)
    .sort((a, b) => b.confidence - a.confidence || Math.abs(b.deltaPercent) - Math.abs(a.deltaPercent))
    .slice(0, maxLimit);
};

const buildInventoryInsights = async () => {
  const products = await Product.find({ status: 'approved' })
    .select('name farmer quantityAvailable category location pricePerUnit tags')
    .limit(500)
    .populate('farmer', 'name email')
    .populate('category', 'name');

  const metrics30Rows = await aggregatePaidOrderItems(toRecentDate(DAYS.MONTH));
  const metrics30Map = new Map(metrics30Rows.map((row) => [normalizeKey(row._id), row]));

  const inventoryRows = products.map((product) => {
    const key = normalizeKey(product._id);
    const metrics = metrics30Map.get(key) || {};
    const units30 = Number(metrics.unitsSold || 0);
    const velocityPerDay = units30 / DAYS.MONTH;
    const stock = Number(product.quantityAvailable || 0);
    const daysToStockout = velocityPerDay > 0 ? roundTo(stock / velocityPerDay, 1) : null;
    const riskLevel =
      stock <= 8 || (daysToStockout !== null && daysToStockout <= 5)
        ? 'critical'
        : stock <= 20 || (daysToStockout !== null && daysToStockout <= 12)
          ? 'high'
          : stock <= 45 || (daysToStockout !== null && daysToStockout <= 21)
            ? 'medium'
            : 'stable';

    const reorderTargetDays = 30;
    const recommendedReorderQty = Math.max(Math.ceil(velocityPerDay * reorderTargetDays - stock), 0);

    return {
      productId: String(product._id),
      name: product.name,
      farmer: product.farmer,
      categoryName: product.category?.name || 'Uncategorized',
      district: product.location?.district || 'Unknown',
      stock,
      unitsSold30: units30,
      velocityPerDay: roundTo(velocityPerDay, 2),
      daysToStockout,
      riskLevel,
      recommendedReorderQty,
      tags: product.tags || [],
    };
  });

  const statusRows = await Order.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  const statusMap = Object.fromEntries(statusRows.map((item) => [item._id || 'unknown', Number(item.count || 0)]));
  const shippedOlderThan7Days = await Order.countDocuments({
    status: 'shipped',
    createdAt: { $lte: toRecentDate(DAYS.WEEK) },
  });

  const criticalCount = inventoryRows.filter((row) => row.riskLevel === 'critical').length;
  const highCount = inventoryRows.filter((row) => row.riskLevel === 'high').length;
  const riskScore = clamp(
    roundTo(
      (criticalCount / Math.max(inventoryRows.length, 1)) * 70 +
        (highCount / Math.max(inventoryRows.length, 1)) * 20 +
        shippedOlderThan7Days * 1.8,
      1,
    ),
    0,
    100,
  );

  return {
    criticalItems: inventoryRows
      .filter((row) => row.riskLevel === 'critical' || row.riskLevel === 'high')
      .sort((a, b) => {
        const riskOrder = { critical: 0, high: 1, medium: 2, stable: 3 };
        return (riskOrder[a.riskLevel] || 10) - (riskOrder[b.riskLevel] || 10) || a.stock - b.stock;
      })
      .slice(0, 120),
    summary: {
      trackedProducts: inventoryRows.length,
      criticalCount,
      highCount,
      mediumCount: inventoryRows.filter((row) => row.riskLevel === 'medium').length,
      stableCount: inventoryRows.filter((row) => row.riskLevel === 'stable').length,
      fulfillmentRiskScore: riskScore,
      delayedShipmentCount: shippedOlderThan7Days,
      orderStatusCounts: statusMap,
    },
  };
};

const buildMarketingInsights = async () => {
  const paidBuyerRows = await Order.aggregate([
    { $match: { paymentStatus: 'paid' } },
    {
      $group: {
        _id: '$buyer',
        totalSpend: { $sum: '$totalAmount' },
        orderCount: { $sum: 1 },
        lastOrderAt: { $max: '$createdAt' },
      },
    },
  ]);

  const buyerMetricsMap = new Map(paidBuyerRows.map((row) => [normalizeKey(row._id), row]));
  const buyers = await User.find({ role: 'buyer', isActive: true, blocked: false }).select('_id createdAt');

  const now = Date.now();
  const dormantCutoff = toRecentDate(60).getTime();
  const highValueThreshold = Number(process.env.HIGH_VALUE_BUYER_NPR || 30000);

  const segments = {
    allBuyers: buyers.length,
    highValueBuyers: 0,
    dormantBuyers: 0,
    newBuyers30d: 0,
  };

  buyers.forEach((buyer) => {
    const metric = buyerMetricsMap.get(normalizeKey(buyer._id));
    const spend = Number(metric?.totalSpend || 0);
    const lastOrderAt = metric?.lastOrderAt ? new Date(metric.lastOrderAt).getTime() : 0;

    if (spend >= highValueThreshold) segments.highValueBuyers += 1;
    if (!lastOrderAt || lastOrderAt < dormantCutoff) segments.dormantBuyers += 1;
    if (now - new Date(buyer.createdAt).getTime() <= DAYS.MONTH * 24 * 60 * 60 * 1000) segments.newBuyers30d += 1;
  });

  const [activeFarmers, pendingFarmers, couponRows, announcementRows] = await Promise.all([
    User.countDocuments({ role: 'farmer', isActive: true, blocked: false, isFarmerVerified: true }),
    User.countDocuments({ role: 'farmer', isFarmerVerified: false, isActive: true }),
    Coupon.find().select('code isActive usedBy expiresAt createdAt').sort({ createdAt: -1 }).limit(40),
    Notification.aggregate([
      { $match: { type: 'announcement', createdAt: { $gte: toRecentDate(DAYS.QUARTER) } } },
      {
        $group: {
          _id: '$title',
          sent: { $sum: 1 },
          read: { $sum: { $cond: ['$isRead', 1, 0] } },
          latestAt: { $max: '$createdAt' },
        },
      },
      { $sort: { latestAt: -1 } },
      { $limit: 20 },
    ]),
  ]);

  const couponPerformance = couponRows.map((coupon) => ({
    code: coupon.code,
    isActive: coupon.isActive,
    usedCount: coupon.usedBy?.length || 0,
    expiresAt: coupon.expiresAt,
  }));

  const campaigns = announcementRows.map((row) => ({
    title: row._id,
    sent: row.sent,
    read: row.read,
    readRate: row.sent ? roundTo((row.read / row.sent) * 100, 1) : 0,
    latestAt: row.latestAt,
  }));

  const recommendedCampaigns = [
    {
      type: 'reactivation',
      title: 'Dormant Buyer Re-activation',
      targetSegment: 'dormant-buyers',
      reason: `${segments.dormantBuyers} dormant buyers detected in last 60 days`,
    },
    {
      type: 'upsell',
      title: 'High-Value Buyer VIP Offer',
      targetSegment: 'high-value-buyers',
      reason: `${segments.highValueBuyers} high-value buyers qualify for premium campaigns`,
    },
    {
      type: 'farmer-verification',
      title: 'Farmer Verification Completion Push',
      targetSegment: 'farmers-pending-verification',
      reason: `${pendingFarmers} farmers are pending verification follow-up`,
    },
  ];

  return {
    segments: {
      ...segments,
      activeFarmers,
      pendingFarmers,
    },
    couponPerformance,
    campaigns,
    recommendedCampaigns,
  };
};

const getDashboardStats = catchAsync(async (_req, res) => {
  const [
    totalUsers,
    totalFarmers,
    totalBuyers,
    totalProducts,
    totalOrders,
    revenueResult,
    pendingFarmers,
    pendingProducts,
    activeCoupons,
    forumPosts,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'farmer' }),
    User.countDocuments({ role: 'buyer' }),
    Product.countDocuments(),
    Order.countDocuments(),
    Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, revenue: { $sum: '$totalAmount' } } },
    ]),
    User.countDocuments({ role: 'farmer', isFarmerVerified: false }),
    Product.countDocuments({ status: 'pending' }),
    Coupon.countDocuments({ isActive: true }),
    ForumPost.countDocuments(),
  ]);

  const revenue = revenueResult[0]?.revenue || 0;

  const salesByMonth = await Order.aggregate([
    { $match: { paymentStatus: 'paid' } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
        revenue: { $sum: '$totalAmount' },
      },
    },
    { $sort: { _id: 1 } },
    { $limit: 12 },
  ]);

  const ordersByStatus = await Order.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);

  res.status(200).json({
    status: 'success',
    stats: {
      totalUsers,
      totalFarmers,
      totalBuyers,
      totalProducts,
      totalOrders,
      revenue,
      pendingFarmers,
      pendingProducts,
      activeCoupons,
      forumPosts,
      salesByMonth,
      ordersByStatus,
    },
  });
});

const listUsers = catchAsync(async (req, res) => {
  const { role, blocked, search } = req.query;

  const filter = {};
  if (role && ['farmer', 'buyer', 'admin'].includes(role)) {
    filter.role = role;
  }
  if (blocked === 'true') filter.blocked = true;
  if (blocked === 'false') filter.blocked = false;
  if (search) {
    filter.$or = [{ name: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }];
  }

  const users = await User.find(filter).select('-password').sort({ createdAt: -1 }).limit(500);

  res.status(200).json({
    status: 'success',
    count: users.length,
    users,
  });
});

const listAuditLogs = catchAsync(async (req, res) => {
  const {
    action = '',
    targetType = '',
    actorId = '',
    search = '',
    page = 1,
    limit = 40,
  } = req.query;

  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 40, 1), 120);
  const skip = (safePage - 1) * safeLimit;

  const filter = {};
  if (action) filter.action = action;
  if (targetType) filter.targetType = targetType;
  if (actorId) filter.actor = actorId;

  if (search.trim()) {
    const pattern = new RegExp(search.trim(), 'i');
    filter.$or = [{ actorName: pattern }, { targetLabel: pattern }, { action: pattern }];
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit),
    AuditLog.countDocuments(filter),
  ]);

  res.status(200).json({
    status: 'success',
    page: safePage,
    limit: safeLimit,
    total,
    hasMore: skip + logs.length < total,
    logs,
  });
});

const bulkUserAction = catchAsync(async (req, res, next) => {
  const { userIds = [], action } = req.body;
  const allowedActions = ['block', 'unblock', 'activate', 'deactivate', 'verify-farmers'];

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return next(new AppError('userIds must be a non-empty array', 400));
  }

  if (!allowedActions.includes(action)) {
    return next(new AppError(`action must be one of: ${allowedActions.join(', ')}`, 400));
  }

  const uniqueIds = [...new Set(userIds.map((id) => String(id)).filter(Boolean))].slice(0, 400);
  const validIds = uniqueIds.filter((id) => mongoose.isValidObjectId(id));
  const invalidIds = uniqueIds.filter((id) => !mongoose.isValidObjectId(id));
  const users = await User.find({ _id: { $in: validIds } });
  const foundSet = new Set(users.map((user) => String(user._id)));
  const skipped = [];
  const updated = [];

  invalidIds.forEach((id) => {
    skipped.push({ userId: id, reason: 'Invalid user id format' });
  });

  validIds.forEach((id) => {
    if (!foundSet.has(id)) {
      skipped.push({ userId: id, reason: 'User not found' });
    }
  });

  for (const user of users) {
    const userId = String(user._id);

    if (String(req.user._id) === userId && ['block', 'deactivate'].includes(action)) {
      skipped.push({ userId, reason: 'Cannot apply this action to your own account' });
      continue;
    }

    if (user.role === 'admin' && ['block', 'deactivate'].includes(action)) {
      const otherActiveAdmins = await User.countDocuments({
        _id: { $ne: user._id },
        role: 'admin',
        isActive: true,
        blocked: false,
      });

      if (otherActiveAdmins === 0) {
        skipped.push({ userId, reason: 'Cannot disable the last active admin account' });
        continue;
      }
    }

    let changed = false;

    if (action === 'block' && !user.blocked) {
      user.blocked = true;
      changed = true;
    }

    if (action === 'unblock' && user.blocked) {
      user.blocked = false;
      changed = true;
    }

    if (action === 'activate' && !user.isActive) {
      user.isActive = true;
      user.accountActivity = user.accountActivity || {};
      user.accountActivity.deactivatedAt = null;
      changed = true;
    }

    if (action === 'deactivate' && user.isActive) {
      user.isActive = false;
      user.accountActivity = user.accountActivity || {};
      user.accountActivity.deactivatedAt = new Date();
      changed = true;
    }

    if (action === 'verify-farmers') {
      if (user.role !== 'farmer') {
        skipped.push({ userId, reason: 'Only farmer accounts can be verified' });
        continue;
      }
      if (!user.isFarmerVerified) {
        user.isFarmerVerified = true;
        changed = true;
      }
    }

    if (!changed) {
      skipped.push({ userId, reason: 'No changes required' });
      continue;
    }

    await user.save();
    updated.push(user._id);

    await createNotification({
      user: user._id,
      type: 'system',
      title: 'Account updated by admin',
      message: `A bulk administrative action has updated your account (${action}).`,
      metadata: { action },
      io: req.io,
    });
  }

  recordAudit(req, {
    action: 'users.bulk_action',
    targetType: 'user',
    targetLabel: `${action} (${updated.length} updated)`,
    details: {
      action,
      requested: uniqueIds.length,
      updatedCount: updated.length,
      skippedCount: skipped.length,
      updatedUserIds: updated.map((id) => String(id)).slice(0, 100),
    },
  });

  res.status(200).json({
    status: 'success',
    action,
    requested: uniqueIds.length,
    updatedCount: updated.length,
    skipped,
  });
});

const listProducts = catchAsync(async (req, res) => {
  const { status = 'all', search = '', category, farmer, page = 1, limit = 20 } = req.query;

  const filter = {};
  if (status !== 'all') filter.status = status;
  if (category) filter.category = category;
  if (farmer) filter.farmer = farmer;
  if (search) {
    filter.$or = [{ name: new RegExp(search, 'i') }, { description: new RegExp(search, 'i') }];
  }

  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.max(Number(limit) || 20, 1);
  const skip = (safePage - 1) * safeLimit;

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate('farmer', 'name email isFarmerVerified')
      .populate('category', 'name'),
    Product.countDocuments(filter),
  ]);

  res.status(200).json({
    status: 'success',
    page: safePage,
    limit: safeLimit,
    total,
    products,
  });
});

const listOrders = catchAsync(async (req, res) => {
  const { status, paymentStatus, page = 1, limit = 20 } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (paymentStatus) filter.paymentStatus = paymentStatus;

  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.max(Number(limit) || 20, 1);
  const skip = (safePage - 1) * safeLimit;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate('buyer', 'name email')
      .populate('items.farmer', 'name'),
    Order.countDocuments(filter),
  ]);

  res.status(200).json({
    status: 'success',
    page: safePage,
    limit: safeLimit,
    total,
    orders,
  });
});

const blockOrUnblockUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  if (String(req.user._id) === String(user._id)) {
    return next(new AppError('You cannot block or unblock your own account', 400));
  }

  const nextBlockedState = !user.blocked;

  if (user.role === 'admin' && nextBlockedState) {
    const otherActiveAdmins = await User.countDocuments({
      _id: { $ne: user._id },
      role: 'admin',
      isActive: true,
      blocked: false,
    });

    if (otherActiveAdmins === 0) {
      return next(new AppError('Cannot block the last active admin account', 400));
    }
  }

  user.blocked = nextBlockedState;
  await user.save();

  recordAudit(req, {
    action: nextBlockedState ? 'user.block' : 'user.unblock',
    targetType: 'user',
    targetId: user._id,
    targetLabel: `${user.name} (${user.email})`,
    details: { blocked: nextBlockedState },
  });

  res.status(200).json({
    status: 'success',
    user,
  });
});

const setUserAccountStatus = catchAsync(async (req, res, next) => {
  const { isActive } = req.body;

  if (typeof isActive !== 'boolean') {
    return next(new AppError('isActive must be true or false', 400));
  }

  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  if (String(req.user._id) === String(user._id) && isActive === false) {
    return next(new AppError('Use your profile settings to deactivate your own account', 400));
  }

  if (user.role === 'admin' && isActive === false) {
    const otherActiveAdmins = await User.countDocuments({
      _id: { $ne: user._id },
      role: 'admin',
      isActive: true,
      blocked: false,
    });

    if (otherActiveAdmins === 0) {
      return next(new AppError('Cannot deactivate the last active admin account', 400));
    }
  }

  user.isActive = isActive;
  user.accountActivity = user.accountActivity || {};
  user.accountActivity.deactivatedAt = isActive ? null : new Date();
  await user.save();

  await createNotification({
    user: user._id,
    type: 'system',
    title: 'Account status updated',
    message: isActive
      ? 'Your account has been reactivated by an admin.'
      : 'Your account has been deactivated by an admin.',
    metadata: { isActive },
    io: req.io,
  });

  recordAudit(req, {
    action: isActive ? 'user.activate' : 'user.deactivate',
    targetType: 'user',
    targetId: user._id,
    targetLabel: `${user.name} (${user.email})`,
    details: { isActive },
  });

  res.status(200).json({
    status: 'success',
    user,
  });
});

const adjustUserWallet = catchAsync(async (req, res, next) => {
  const { amount = 0, mode = 'increment' } = req.body;
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  const delta = Number(amount || 0);

  if (!Number.isFinite(delta)) {
    return next(new AppError('Amount must be a number', 400));
  }

  if (mode === 'set') {
    user.walletBalance = Math.max(delta, 0);
  } else {
    user.walletBalance = Math.max((user.walletBalance || 0) + delta, 0);
  }

  await user.save();

  await createNotification({
    user: user._id,
    type: 'system',
    title: 'Wallet updated',
    message: `Your wallet balance is now NPR ${user.walletBalance.toFixed(2)}`,
    metadata: { walletBalance: user.walletBalance },
    io: req.io,
  });

  recordAudit(req, {
    action: 'user.wallet_adjust',
    targetType: 'user',
    targetId: user._id,
    targetLabel: `${user.name} (${user.email})`,
    details: { mode, amount: delta, newWalletBalance: user.walletBalance },
  });

  res.status(200).json({
    status: 'success',
    user,
  });
});

const verifyFarmer = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user || user.role !== 'farmer') {
    return next(new AppError('Farmer not found', 404));
  }

  user.isFarmerVerified = req.body.isFarmerVerified !== false;
  await user.save();

  await createNotification({
    user: user._id,
    type: 'system',
    title: 'Farmer verification status updated',
    message: user.isFarmerVerified
      ? 'Congratulations, your farmer account is now verified.'
      : 'Your farmer verification status has been set to pending review.',
    metadata: { isFarmerVerified: user.isFarmerVerified },
    io: req.io,
  });

  recordAudit(req, {
    action: user.isFarmerVerified ? 'farmer.verify' : 'farmer.unverify',
    targetType: 'user',
    targetId: user._id,
    targetLabel: `${user.name} (${user.email})`,
    details: { isFarmerVerified: user.isFarmerVerified },
  });

  res.status(200).json({
    status: 'success',
    user,
  });
});

const removeProductListing = catchAsync(async (req, res, next) => {
  const product = await Product.findByIdAndDelete(req.params.id);

  if (!product) {
    return next(new AppError('Product not found', 404));
  }

  recordAudit(req, {
    action: 'product.remove',
    targetType: 'product',
    targetId: product._id,
    targetLabel: product.name,
    details: {
      farmer: String(product.farmer || ''),
      status: product.status,
      pricePerUnit: product.pricePerUnit,
    },
  });

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

const removeForumPost = catchAsync(async (req, res, next) => {
  const post = await ForumPost.findByIdAndDelete(req.params.id);

  if (!post) {
    return next(new AppError('Forum post not found', 404));
  }

  recordAudit(req, {
    action: 'forum.remove_post',
    targetType: 'forum_post',
    targetId: post._id,
    targetLabel: post.title,
    details: { author: String(post.user || '') },
  });

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

const announcement = catchAsync(async (req, res, next) => {
  const { title, message, role = 'all' } = req.body;

  if (!title || !message) {
    return next(new AppError('Title and message are required', 400));
  }

  const filter = role === 'all' ? {} : { role };
  const users = await User.find(filter).select('_id');

  await Promise.all(
    users.map((user) =>
      createNotification({
        user: user._id,
        type: 'announcement',
        title,
        message,
        io: req.io,
      }),
    ),
  );

  recordAudit(req, {
    action: 'announcement.send',
    targetType: 'notification',
    targetLabel: title,
    details: {
      role,
      recipients: users.length,
      messagePreview: message.slice(0, 160),
    },
  });

  res.status(200).json({
    status: 'success',
    sent: users.length,
  });
});

const announcementHistory = catchAsync(async (_req, res) => {
  const history = await Notification.aggregate([
    { $match: { type: 'announcement' } },
    {
      $group: {
        _id: { title: '$title', message: '$message' },
        createdAt: { $max: '$createdAt' },
        recipients: { $sum: 1 },
      },
    },
    { $sort: { createdAt: -1 } },
    { $limit: 30 },
  ]);

  const formatted = history.map((row) => ({
    title: row._id.title,
    message: row._id.message,
    recipients: row.recipients,
    createdAt: row.createdAt,
  }));

  res.status(200).json({
    status: 'success',
    history: formatted,
  });
});

const exportDataAsCsv = catchAsync(async (req, res, next) => {
  const { type = 'users' } = req.query;

  if (type === 'users') {
    const users = await User.find().select('name email role blocked isFarmerVerified walletBalance createdAt');
    const headers = ['name', 'email', 'role', 'blocked', 'isFarmerVerified', 'walletBalance', 'createdAt'];
    const csv = rowsToCsv(headers, users.map((item) => item.toObject()));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=krishihub-users.csv');
    return res.status(200).send(csv);
  }

  if (type === 'products') {
    const products = await Product.find().populate('category', 'name').populate('farmer', 'name email');
    const headers = [
      'name',
      'category',
      'farmer',
      'pricePerUnit',
      'quantityAvailable',
      'status',
      'organic',
      'createdAt',
    ];
    const rows = products.map((item) => ({
      name: item.name,
      category: item.category?.name || '',
      farmer: item.farmer?.email || item.farmer?.name || '',
      pricePerUnit: item.pricePerUnit,
      quantityAvailable: item.quantityAvailable,
      status: item.status,
      organic: item.organic,
      createdAt: item.createdAt,
    }));
    const csv = rowsToCsv(headers, rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=krishihub-products.csv');
    return res.status(200).send(csv);
  }

  if (type === 'orders') {
    const orders = await Order.find().populate('buyer', 'email');
    const headers = ['orderId', 'buyerEmail', 'status', 'paymentStatus', 'itemsCount', 'totalAmount', 'createdAt'];
    const rows = orders.map((item) => ({
      orderId: item._id,
      buyerEmail: item.buyer?.email || '',
      status: item.status,
      paymentStatus: item.paymentStatus,
      itemsCount: item.items?.length || 0,
      totalAmount: item.totalAmount,
      createdAt: item.createdAt,
    }));
    const csv = rowsToCsv(headers, rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=krishihub-orders.csv');
    return res.status(200).send(csv);
  }

  return next(new AppError('Unsupported export type. Use users, products, or orders', 400));
});

const reportSnapshot = catchAsync(async (_req, res) => {
  const latestOrders = await Order.find().sort({ createdAt: -1 }).limit(10).populate('buyer', 'name');
  const latestProducts = await Product.find().sort({ createdAt: -1 }).limit(10).populate('farmer', 'name');
  const unreadNotifications = await Notification.countDocuments({ isRead: false });
  const categories = await Category.find();

  const pendingProducts = await Product.find({ status: 'pending' })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate('farmer', 'name email');

  const blockedUsers = await User.countDocuments({ blocked: true });

  res.status(200).json({
    status: 'success',
    report: {
      latestOrders,
      latestProducts,
      pendingProducts,
      unreadNotifications,
      blockedUsers,
      categories,
    },
  });
});

const getIntelligenceOverview = catchAsync(async (_req, res) => {
  const [pricingRecommendations, inventoryInsights, marketingInsights, paidOrders30Days, recentReviews] =
    await Promise.all([
      buildPricingRecommendations({ limit: 50 }),
      buildInventoryInsights(),
      buildMarketingInsights(),
      Order.aggregate([
        {
          $match: {
            paymentStatus: 'paid',
            createdAt: { $gte: toRecentDate(DAYS.MONTH) },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            revenue: { $sum: '$totalAmount' },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Review.aggregate([
        { $match: { createdAt: { $gte: toRecentDate(DAYS.MONTH) } } },
        { $group: { _id: null, avgRating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } },
      ]),
    ]);

  const totalRevenue30 = paidOrders30Days.reduce((sum, row) => sum + Number(row.revenue || 0), 0);
  const totalOrders30 = paidOrders30Days.reduce((sum, row) => sum + Number(row.orders || 0), 0);
  const avgOrderValue30 = totalOrders30 ? totalRevenue30 / totalOrders30 : 0;

  const recent7DaysRows = paidOrders30Days.slice(-7);
  const revenueVelocity = recent7DaysRows.reduce((sum, row) => sum + Number(row.revenue || 0), 0) /
    Math.max(recent7DaysRows.length, 1);
  const projectedRevenueNext7Days = roundTo(revenueVelocity * 7);

  const signals = {
    pricingOpportunities: pricingRecommendations.length,
    criticalInventoryItems: inventoryInsights.summary.criticalCount,
    highInventoryRiskItems: inventoryInsights.summary.highCount,
    dormantBuyerCount: marketingInsights.segments.dormantBuyers,
    highValueBuyerCount: marketingInsights.segments.highValueBuyers,
  };

  const reviewSummary = recentReviews[0] || { avgRating: 0, reviewCount: 0 };

  res.status(200).json({
    status: 'success',
    intelligence: {
      kpis: {
        totalRevenue30: roundTo(totalRevenue30),
        totalOrders30,
        avgOrderValue30: roundTo(avgOrderValue30),
        projectedRevenueNext7Days,
        fulfillmentRiskScore: inventoryInsights.summary.fulfillmentRiskScore,
        avgReviewRating30: roundTo(reviewSummary.avgRating || 0),
        reviewCount30: Number(reviewSummary.reviewCount || 0),
      },
      revenueTimeline: paidOrders30Days,
      signals,
      topPricingOpportunities: pricingRecommendations.slice(0, 10),
      inventoryRiskPreview: inventoryInsights.criticalItems.slice(0, 10),
      marketingPreview: marketingInsights.recommendedCampaigns.slice(0, 3),
    },
  });
});

const getDynamicPricingInsights = catchAsync(async (req, res) => {
  const { limit = 40 } = req.query;
  const recommendations = await buildPricingRecommendations({ limit: Number(limit) || 40 });

  const summary = {
    recommendationCount: recommendations.length,
    averageSuggestedDeltaPercent: roundTo(
      recommendations.reduce((sum, row) => sum + Number(row.deltaPercent || 0), 0) /
        Math.max(recommendations.length, 1),
    ),
    highConfidenceCount: recommendations.filter((row) => row.confidence >= 75).length,
    averageConfidence: roundTo(
      recommendations.reduce((sum, row) => sum + Number(row.confidence || 0), 0) /
        Math.max(recommendations.length, 1),
      1,
    ),
  };

  res.status(200).json({
    status: 'success',
    summary,
    recommendations,
  });
});

const applyDynamicPricingUpdates = catchAsync(async (req, res, next) => {
  const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];

  if (!updates.length) {
    return next(new AppError('updates must be a non-empty array', 400));
  }

  if (updates.length > 120) {
    return next(new AppError('Maximum 120 products can be updated in one request', 400));
  }

  const normalized = updates
    .map((item) => ({
      productId: String(item.productId || '').trim(),
      pricePerUnit: Number(item.pricePerUnit),
    }))
    .filter((item) => item.productId && Number.isFinite(item.pricePerUnit) && item.pricePerUnit > 0);

  if (!normalized.length) {
    return next(new AppError('No valid pricing updates received', 400));
  }

  const productIds = [...new Set(normalized.map((item) => item.productId))].filter((id) => mongoose.isValidObjectId(id));
  const products = await Product.find({ _id: { $in: productIds } }).select('name pricePerUnit farmer');
  const productMap = new Map(products.map((product) => [String(product._id), product]));
  const updated = [];
  const skipped = [];

  for (const update of normalized) {
    const product = productMap.get(update.productId);
    if (!product) {
      skipped.push({ productId: update.productId, reason: 'Product not found' });
      continue;
    }

    const currentPrice = Number(product.pricePerUnit || 0);
    const nextPrice = Number(update.pricePerUnit);

    if (currentPrice <= 0) {
      skipped.push({ productId: update.productId, reason: 'Current price is invalid' });
      continue;
    }

    const changePercent = ((nextPrice - currentPrice) / currentPrice) * 100;
    if (Math.abs(changePercent) > 35) {
      skipped.push({ productId: update.productId, reason: 'Price change exceeds 35% guardrail' });
      continue;
    }

    if (roundTo(currentPrice) === roundTo(nextPrice)) {
      skipped.push({ productId: update.productId, reason: 'No effective price change' });
      continue;
    }

    product.pricePerUnit = roundTo(nextPrice);
    await product.save();

    updated.push({
      productId: String(product._id),
      name: product.name,
      previousPrice: roundTo(currentPrice),
      newPrice: roundTo(product.pricePerUnit),
      changePercent: roundTo(changePercent, 2),
    });

    await createNotification({
      user: product.farmer,
      type: 'system',
      title: 'Dynamic pricing update applied',
      message: `${product.name} price has been updated from NPR ${roundTo(currentPrice)} to NPR ${roundTo(product.pricePerUnit)} by admin intelligence automation.`,
      metadata: { productId: String(product._id), previousPrice: currentPrice, newPrice: product.pricePerUnit },
      io: req.io,
    });
  }

  recordAudit(req, {
    action: 'pricing.dynamic_apply',
    targetType: 'product',
    targetLabel: `Updated ${updated.length} prices`,
    details: {
      requested: normalized.length,
      updated: updated.length,
      skipped: skipped.length,
      updatedProducts: updated.slice(0, 40),
    },
  });

  res.status(200).json({
    status: 'success',
    updatedCount: updated.length,
    skippedCount: skipped.length,
    updated,
    skipped,
  });
});

const getInventoryAutomationInsights = catchAsync(async (_req, res) => {
  const insights = await buildInventoryInsights();

  res.status(200).json({
    status: 'success',
    ...insights,
  });
});

const runInventoryAutomation = catchAsync(async (req, res, next) => {
  const { mode = 'notify-and-tag', thresholdDays = 10 } = req.body || {};
  const allowedModes = ['notify', 'tag-critical', 'notify-and-tag'];

  if (!allowedModes.includes(mode)) {
    return next(new AppError(`mode must be one of: ${allowedModes.join(', ')}`, 400));
  }

  const safeThresholdDays = clamp(Number(thresholdDays) || 10, 3, 45);
  const insights = await buildInventoryInsights();
  const targets = insights.criticalItems.filter(
    (item) => item.stock <= 20 || (item.daysToStockout !== null && item.daysToStockout <= safeThresholdDays),
  );

  const updatedTags = [];
  const notified = [];

  const shouldTag = mode === 'tag-critical' || mode === 'notify-and-tag';
  const shouldNotify = mode === 'notify' || mode === 'notify-and-tag';

  for (const target of targets.slice(0, 200)) {
    if (shouldTag) {
      const product = await Product.findById(target.productId).select('tags');
      if (product) {
        const nextTags = [...new Set([...(product.tags || []), 'critical-stock', 'restock-alert'])];
        product.tags = nextTags;
        await product.save();
        updatedTags.push(target.productId);
      }
    }

    if (shouldNotify && target.farmer?._id) {
      await createNotification({
        user: target.farmer._id,
        type: 'system',
        title: 'Inventory automation alert',
        message: `${target.name} is at ${target.riskLevel} stock risk. Estimated stockout: ${target.daysToStockout ?? 'unknown'} day(s). Recommended restock: ${target.recommendedReorderQty} units.`,
        metadata: {
          productId: target.productId,
          riskLevel: target.riskLevel,
          daysToStockout: target.daysToStockout,
          recommendedReorderQty: target.recommendedReorderQty,
        },
        io: req.io,
      });
      notified.push(target.productId);
    }
  }

  recordAudit(req, {
    action: 'inventory.automation_run',
    targetType: 'product',
    targetLabel: `Inventory automation (${mode})`,
    details: {
      mode,
      thresholdDays: safeThresholdDays,
      targeted: targets.length,
      tagged: updatedTags.length,
      notified: notified.length,
    },
  });

  res.status(200).json({
    status: 'success',
    mode,
    thresholdDays: safeThresholdDays,
    targetedCount: targets.length,
    taggedCount: updatedTags.length,
    notifiedCount: notified.length,
    sampleTargets: targets.slice(0, 25),
  });
});

const getMarketingAutomationInsights = catchAsync(async (_req, res) => {
  const insights = await buildMarketingInsights();

  res.status(200).json({
    status: 'success',
    ...insights,
  });
});

const resolveCampaignAudience = async (segment) => {
  const normalized = String(segment || '').trim().toLowerCase();

  if (normalized === 'all-buyers') {
    return User.find({ role: 'buyer', isActive: true, blocked: false }).select('_id email name');
  }

  if (normalized === 'farmers-pending-verification') {
    return User.find({ role: 'farmer', isFarmerVerified: false, isActive: true, blocked: false }).select('_id email name');
  }

  if (normalized === 'active-farmers') {
    return User.find({ role: 'farmer', isFarmerVerified: true, isActive: true, blocked: false }).select('_id email name');
  }

  const buyers = await User.find({ role: 'buyer', isActive: true, blocked: false }).select(
    '_id email name createdAt',
  );

  const paidBuyerRows = await Order.aggregate([
    { $match: { paymentStatus: 'paid' } },
    {
      $group: {
        _id: '$buyer',
        totalSpend: { $sum: '$totalAmount' },
        lastOrderAt: { $max: '$createdAt' },
      },
    },
  ]);

  const highValueThreshold = Number(process.env.HIGH_VALUE_BUYER_NPR || 30000);
  const dormantCutoff = toRecentDate(60).getTime();
  const buyerMetricsMap = new Map(paidBuyerRows.map((row) => [normalizeKey(row._id), row]));

  const filteredBuyers = buyers.filter((buyer) => {
    const metric = buyerMetricsMap.get(normalizeKey(buyer._id));
    const spend = Number(metric?.totalSpend || 0);
    const lastOrderAt = metric?.lastOrderAt ? new Date(metric.lastOrderAt).getTime() : 0;

    if (normalized === 'high-value-buyers') {
      return spend >= highValueThreshold;
    }

    if (normalized === 'dormant-buyers') {
      return !lastOrderAt || lastOrderAt < dormantCutoff;
    }

    if (normalized === 'new-buyers') {
      return new Date(buyer.createdAt).getTime() >= toRecentDate(DAYS.MONTH).getTime();
    }

    return true;
  });

  return filteredBuyers;
};

const launchAutomatedCampaign = catchAsync(async (req, res, next) => {
  const {
    campaignType = 'custom',
    targetSegment = 'all-buyers',
    title,
    message,
    createCoupon: couponConfig = null,
  } = req.body || {};

  const safeTitle = String(title || '').trim();
  const safeMessage = String(message || '').trim();

  if (!safeTitle || !safeMessage) {
    return next(new AppError('title and message are required', 400));
  }

  const audience = await resolveCampaignAudience(targetSegment);
  const recipients = audience.slice(0, 3000);
  let couponPayload = null;

  if (couponConfig && couponConfig.enabled) {
    const codePrefix = String(couponConfig.codePrefix || 'AUTO').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'AUTO';
    const candidateCode = `${codePrefix}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const existingCode = await Coupon.findOne({ code: candidateCode });
    const finalCode = existingCode ? `${codePrefix}${Date.now().toString().slice(-4)}` : candidateCode;

    const expiresDays = clamp(Number(couponConfig.expiresDays || 7), 1, 45);
    const coupon = await Coupon.create({
      code: finalCode,
      discountType: couponConfig.discountType === 'fixed' ? 'fixed' : 'percent',
      value: Math.max(Number(couponConfig.value || 10), 1),
      minOrderAmount: Math.max(Number(couponConfig.minOrderAmount || 0), 0),
      usageLimit: clamp(Number(couponConfig.usageLimit || 200), 1, 10000),
      expiresAt: new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000),
      isActive: true,
    });

    couponPayload = {
      id: String(coupon._id),
      code: coupon.code,
      discountType: coupon.discountType,
      value: coupon.value,
      expiresAt: coupon.expiresAt,
    };
  }

  const messageWithCoupon = couponPayload
    ? `${safeMessage}\nUse coupon code ${couponPayload.code} before ${new Date(couponPayload.expiresAt).toLocaleDateString()}.`
    : safeMessage;

  await Promise.all(
    recipients.map((user) =>
      createNotification({
        user: user._id,
        type: 'announcement',
        title: safeTitle,
        message: messageWithCoupon,
        metadata: {
          campaignType,
          targetSegment,
          couponCode: couponPayload?.code || null,
        },
        io: req.io,
      }),
    ),
  );

  recordAudit(req, {
    action: 'marketing.campaign_launch',
    targetType: 'notification',
    targetLabel: safeTitle,
    details: {
      campaignType,
      targetSegment,
      recipients: recipients.length,
      couponCode: couponPayload?.code || null,
    },
  });

  res.status(200).json({
    status: 'success',
    campaign: {
      campaignType,
      targetSegment,
      title: safeTitle,
      recipients: recipients.length,
      coupon: couponPayload,
    },
  });
});

module.exports = {
  getDashboardStats,
  getIntelligenceOverview,
  getDynamicPricingInsights,
  applyDynamicPricingUpdates,
  getInventoryAutomationInsights,
  runInventoryAutomation,
  getMarketingAutomationInsights,
  launchAutomatedCampaign,
  listUsers,
  listAuditLogs,
  bulkUserAction,
  listProducts,
  listOrders,
  blockOrUnblockUser,
  setUserAccountStatus,
  adjustUserWallet,
  verifyFarmer,
  removeProductListing,
  removeForumPost,
  announcement,
  announcementHistory,
  exportDataAsCsv,
  reportSnapshot,
};

