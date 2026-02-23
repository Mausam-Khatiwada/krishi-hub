const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Category = require('../models/Category');
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
    require('../models/Coupon').countDocuments({ isActive: true }),
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

module.exports = {
  getDashboardStats,
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

