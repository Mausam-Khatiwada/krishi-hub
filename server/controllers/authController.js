const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Notification = require('../models/Notification');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { signToken, cookieOptions } = require('../utils/generateToken');

const normalizeAddresses = (addresses = []) => {
  const trimmed = addresses
    .slice(0, 10)
    .map((item) => ({
      label: item.label?.trim(),
      fullName: item.fullName?.trim(),
      phone: item.phone?.trim(),
      district: item.district?.trim(),
      province: item.province?.trim(),
      country: item.country?.trim() || 'Nepal',
      addressLine: item.addressLine?.trim(),
      isDefault: Boolean(item.isDefault),
    }))
    .filter((item) => item.addressLine || item.district || item.province);

  const defaultIndex = trimmed.findIndex((item) => item.isDefault);
  const safeDefaultIndex = defaultIndex >= 0 ? defaultIndex : trimmed.length ? 0 : -1;

  return trimmed.map((item, index) => ({
    ...item,
    isDefault: safeDefaultIndex >= 0 ? index === safeDefaultIndex : false,
  }));
};

const safeUserPayload = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  blocked: user.blocked,
  avatar: user.avatar,
  phone: user.phone,
  bio: user.bio,
  location: user.location,
  isFarmerVerified: user.isFarmerVerified,
  walletBalance: user.walletBalance,
  badges: user.badges,
  preferences: user.preferences,
  security: user.security,
  addresses: user.addresses,
  farmerProfile: user.farmerProfile,
  buyerProfile: user.buyerProfile,
  adminProfile: user.adminProfile,
  lastLoginAt: user.lastLoginAt,
  accountActivity: user.accountActivity,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  res.cookie('token', token, cookieOptions());

  res.status(statusCode).json({
    status: 'success',
    token,
    user: safeUserPayload(user),
  });
};

const parseBoolean = (value, fallback = undefined) => {
  if (typeof value === 'boolean') return value;

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }

  return fallback;
};

const buildRoleStats = async (user) => {
  if (user.role === 'buyer') {
    const [totalOrders, deliveredOrders, spendAgg] = await Promise.all([
      Order.countDocuments({ buyer: user._id }),
      Order.countDocuments({ buyer: user._id, status: 'delivered' }),
      Order.aggregate([
        { $match: { buyer: user._id, paymentStatus: 'paid' } },
        { $group: { _id: null, totalSpend: { $sum: '$totalAmount' } } },
      ]),
    ]);

    return {
      totalOrders,
      deliveredOrders,
      wishlistCount: user.wishlist?.length || 0,
      subscribedFarmersCount: user.subscribedFarmers?.length || 0,
      totalSpend: spendAgg[0]?.totalSpend || 0,
    };
  }

  if (user.role === 'farmer') {
    const [ordersReceived, deliveredOrders, activeProducts, pendingProducts, farmerRevenueAgg] = await Promise.all([
      Order.countDocuments({ 'items.farmer': user._id }),
      Order.countDocuments({ 'items.farmer': user._id, status: 'delivered' }),
      Product.countDocuments({ farmer: user._id, status: 'approved' }),
      Product.countDocuments({ farmer: user._id, status: 'pending' }),
      Order.aggregate([
        { $match: { paymentStatus: 'paid', 'items.farmer': user._id } },
        { $unwind: '$items' },
        { $match: { 'items.farmer': user._id } },
        { $group: { _id: null, totalRevenue: { $sum: '$items.subtotal' } } },
      ]),
    ]);

    return {
      ordersReceived,
      deliveredOrders,
      activeProducts,
      pendingProducts,
      totalRevenue: farmerRevenueAgg[0]?.totalRevenue || 0,
    };
  }

  const [managedUsers, pendingFarmerApprovals, pendingProducts, openOrders, blockedUsers] =
    await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'farmer', isFarmerVerified: false }),
      Product.countDocuments({ status: 'pending' }),
      Order.countDocuments({ status: { $in: ['placed', 'accepted', 'paid', 'shipped'] } }),
      User.countDocuments({ blocked: true }),
    ]);

  return {
    managedUsers,
    pendingFarmerApprovals,
    pendingProducts,
    openOrders,
    blockedUsers,
  };
};

const register = catchAsync(async (req, res, next) => {
  const { name, email, password, role, location, preferences } = req.body;

  if (role === 'admin') {
    return next(new AppError('Admin account cannot be self-registered', 403));
  }

  const existing = await User.findOne({ email });

  if (existing) {
    return next(new AppError('Email already in use', 400));
  }

  const user = await User.create({
    name,
    email,
    password,
    role: role || 'buyer',
    location,
    preferences,
  });

  if (user.role === 'farmer') {
    user.badges = ['new-farmer'];
    user.farmerProfile = {
      farmName: `${user.name}'s Farm`,
    };
    await user.save();
  }

  if (user.role === 'buyer') {
    user.buyerProfile = {
      preferredPaymentMethod: 'stripe',
    };
    await user.save();
  }

  createSendToken(user, 201, res);
});

const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError('Email and password are required', 400));
  }

  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    return next(new AppError('Invalid credentials', 401));
  }

  if (!user.isActive) {
    return next(new AppError('This account is deactivated. Contact admin to reactivate.', 403));
  }

  if (user.blocked) {
    return next(new AppError('Account is blocked', 403));
  }

  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  createSendToken(user, 200, res);
});

const logout = catchAsync(async (_req, res) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax' });
  res.status(200).json({ status: 'success', message: 'Logged out' });
});

const getMe = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('wishlist', 'name pricePerUnit images organic')
    .populate('subscribedFarmers', 'name location isFarmerVerified');

  res.status(200).json({
    status: 'success',
    user,
  });
});

const getAccountOverview = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id)
    .populate('wishlist', '_id')
    .populate('subscribedFarmers', '_id');

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  const [unreadNotifications, roleStats] = await Promise.all([
    Notification.countDocuments({ user: req.user._id, isRead: false }),
    buildRoleStats(user),
  ]);

  res.status(200).json({
    status: 'success',
    overview: {
      user: safeUserPayload(user),
      unreadNotifications,
      addressesCount: user.addresses?.length || 0,
      accountAgeDays: Math.max(Math.round((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)), 0),
      roleStats,
    },
  });
});

const updateMe = catchAsync(async (req, res, next) => {
  const disallowed = [
    'password',
    'role',
    'blocked',
    'walletBalance',
    'isActive',
    'lastLoginAt',
    'accountActivity',
    'email',
  ];

  const payload = { ...req.body };

  disallowed.forEach((field) => {
    if (field in payload) {
      delete payload[field];
    }
  });

  if (Array.isArray(payload.addresses)) {
    payload.addresses = normalizeAddresses(payload.addresses);
  }

  if (req.user.role !== 'farmer' && payload.farmerProfile) {
    delete payload.farmerProfile;
  }

  if (req.user.role !== 'buyer' && payload.buyerProfile) {
    delete payload.buyerProfile;
  }

  if (req.user.role !== 'admin' && payload.adminProfile) {
    delete payload.adminProfile;
  }

  const user = await User.findByIdAndUpdate(req.user._id, payload, {
    new: true,
    runValidators: true,
  });

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  res.status(200).json({
    status: 'success',
    user,
  });
});

const changePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return next(new AppError('Current password, new password, and confirm password are required', 400));
  }

  if (newPassword !== confirmPassword) {
    return next(new AppError('New password and confirm password must match', 400));
  }

  const user = await User.findById(req.user._id).select('+password');

  if (!user || !(await user.comparePassword(currentPassword))) {
    return next(new AppError('Current password is incorrect', 401));
  }

  user.password = newPassword;
  await user.save();

  createSendToken(user, 200, res);
});

const changeEmail = catchAsync(async (req, res, next) => {
  const { newEmail, password } = req.body;

  if (!newEmail || !password) {
    return next(new AppError('New email and current password are required', 400));
  }

  const normalizedEmail = newEmail.toLowerCase().trim();
  const user = await User.findById(req.user._id).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    return next(new AppError('Password is incorrect', 401));
  }

  if (normalizedEmail === user.email) {
    return next(new AppError('New email must be different from current email', 400));
  }

  const exists = await User.findOne({ email: normalizedEmail });
  if (exists) {
    return next(new AppError('Email already in use', 400));
  }

  user.email = normalizedEmail;
  user.accountActivity = user.accountActivity || {};
  user.accountActivity.lastEmailChangedAt = new Date();
  await user.save();

  res.status(200).json({
    status: 'success',
    message: 'Email updated successfully',
    user: safeUserPayload(user),
  });
});

const updatePreferences = catchAsync(async (req, res, next) => {
  const { preferences } = req.body;

  if (!preferences || typeof preferences !== 'object') {
    return next(new AppError('Preferences object is required', 400));
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  user.preferences = {
    ...user.preferences?.toObject?.(),
    ...preferences,
    notifications: {
      ...user.preferences?.notifications?.toObject?.(),
      ...(preferences.notifications || {}),
    },
  };

  await user.save();

  res.status(200).json({
    status: 'success',
    user,
  });
});

const updateSecurity = catchAsync(async (req, res, next) => {
  const { security } = req.body;

  if (!security || typeof security !== 'object') {
    return next(new AppError('Security object is required', 400));
  }

  const twoFactorEnabled = parseBoolean(security.twoFactorEnabled);
  const loginAlerts = parseBoolean(security.loginAlerts);

  if (typeof twoFactorEnabled === 'undefined' && typeof loginAlerts === 'undefined') {
    return next(
      new AppError('At least one security setting is required (twoFactorEnabled or loginAlerts)', 400),
    );
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  user.security = {
    ...user.security?.toObject?.(),
    ...(typeof twoFactorEnabled === 'boolean' ? { twoFactorEnabled } : {}),
    ...(typeof loginAlerts === 'boolean' ? { loginAlerts } : {}),
  };

  await user.save();

  res.status(200).json({
    status: 'success',
    user,
  });
});

const updateAddresses = catchAsync(async (req, res, next) => {
  const { addresses } = req.body;

  if (!Array.isArray(addresses)) {
    return next(new AppError('Addresses must be an array', 400));
  }

  const normalized = normalizeAddresses(addresses);
  const user = await User.findById(req.user._id);

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  user.addresses = normalized;
  await user.save();

  res.status(200).json({
    status: 'success',
    user,
  });
});

const updateRoleProfile = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  if (user.role === 'farmer') {
    user.farmerProfile = {
      ...user.farmerProfile?.toObject?.(),
      ...req.body,
      primaryCrops: Array.isArray(req.body.primaryCrops)
        ? req.body.primaryCrops
        : req.body.primaryCrops
          ? String(req.body.primaryCrops)
              .split(',')
              .map((crop) => crop.trim())
              .filter(Boolean)
          : user.farmerProfile?.primaryCrops,
      certifications: Array.isArray(req.body.certifications)
        ? req.body.certifications
        : req.body.certifications
          ? String(req.body.certifications)
              .split(',')
              .map((certification) => certification.trim())
              .filter(Boolean)
          : user.farmerProfile?.certifications,
    };
  }

  if (user.role === 'buyer') {
    user.buyerProfile = {
      ...user.buyerProfile?.toObject?.(),
      ...req.body,
    };
  }

  if (user.role === 'admin') {
    user.adminProfile = {
      ...user.adminProfile?.toObject?.(),
      ...req.body,
    };
  }

  await user.save();

  res.status(200).json({
    status: 'success',
    user,
  });
});

const deactivateAccount = catchAsync(async (req, res, next) => {
  const { password } = req.body;

  if (!password) {
    return next(new AppError('Password is required to deactivate account', 400));
  }

  const user = await User.findById(req.user._id).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    return next(new AppError('Password is incorrect', 401));
  }

  if (user.role === 'admin') {
    const otherActiveAdmins = await User.countDocuments({
      _id: { $ne: user._id },
      role: 'admin',
      isActive: true,
    });

    if (otherActiveAdmins === 0) {
      return next(new AppError('Cannot deactivate the last active admin account', 400));
    }
  }

  user.isActive = false;
  user.accountActivity = user.accountActivity || {};
  user.accountActivity.deactivatedAt = new Date();
  await user.save({ validateBeforeSave: false });

  res.clearCookie('token', { httpOnly: true, sameSite: 'lax' });

  res.status(200).json({
    status: 'success',
    message: 'Account deactivated',
  });
});

module.exports = {
  register,
  login,
  logout,
  getMe,
  getAccountOverview,
  updateMe,
  changePassword,
  changeEmail,
  updatePreferences,
  updateSecurity,
  updateAddresses,
  updateRoleProfile,
  deactivateAccount,
};
