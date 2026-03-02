const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Notification = require('../models/Notification');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const sendEmail = require('../utils/sendEmail');
const { signToken, cookieOptions } = require('../utils/generateToken');

const LOGIN_CHALLENGE_PURPOSE = 'login-challenge';
const REGISTER_CHALLENGE_PURPOSE = 'register-challenge';
const TWO_FACTOR_ISSUER = process.env.TWO_FACTOR_ISSUER || 'Krishihub';
const LOGIN_LOCK_MINUTES = Number(process.env.LOGIN_LOCK_MINUTES || 15);
const MAX_FAILED_LOGIN_ATTEMPTS = Number(process.env.MAX_FAILED_LOGIN_ATTEMPTS || 5);
const REGISTER_OTP_LENGTH = Number(process.env.REGISTER_OTP_LENGTH || 6);
const REGISTER_OTP_EXPIRES_MINUTES = Number(process.env.REGISTER_OTP_EXPIRES_MINUTES || 10);
const REGISTER_OTP_RESEND_SECONDS = Number(process.env.REGISTER_OTP_RESEND_SECONDS || 45);

const googleClient = process.env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
  : null;

const getClientIp = (req) => req.headers['x-forwarded-for']?.split(',')?.[0]?.trim() || req.ip || 'unknown';
const getUserAgent = (req) => req.get('user-agent') || 'unknown';

const isEmailDeliveryConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const hashOtpCode = (code) => crypto.createHash('sha256').update(String(code)).digest('hex');

const generateNumericOtp = (length = 6) =>
  Array.from({ length }, () => crypto.randomInt(0, 10)).join('');

const signLoginChallengeToken = ({ userId, provider = 'password', requiresTwoFactor }) =>
  jwt.sign(
    {
      id: userId,
      purpose: LOGIN_CHALLENGE_PURPOSE,
      provider,
      requiresTwoFactor: Boolean(requiresTwoFactor),
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.TWO_FACTOR_TOKEN_EXPIRES_IN || '10m',
    },
  );

const verifyLoginChallengeToken = (token) => {
  try {
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.purpose !== LOGIN_CHALLENGE_PURPOSE) return null;
    return decoded;
  } catch (_error) {
    return null;
  }
};

const verifyTotpCode = (secret, token) => {
  if (!secret || !token) return false;

  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: String(token).trim().replace(/\s+/g, ''),
    window: 1,
  });
};

const sendLoginChallenge = (
  res,
  {
    userId,
    provider = 'password',
    requiresTwoFactor = false,
    message = 'Additional verification required',
  },
) => {
  const twoFactorAuthToken = signLoginChallengeToken({
    userId,
    provider,
    requiresTwoFactor,
  });

  res.status(200).json({
    status: 'success',
    requiresTwoFactor: Boolean(requiresTwoFactor),
    twoFactorAuthToken,
    loginChallengeToken: twoFactorAuthToken,
    message,
  });
};

const isAccountLocked = (user) => {
  if (!user?.security?.lockUntil) return false;
  return new Date(user.security.lockUntil).getTime() > Date.now();
};

const getRemainingLockMinutes = (user) => {
  if (!isAccountLocked(user)) return 0;
  return Math.ceil((new Date(user.security.lockUntil).getTime() - Date.now()) / (60 * 1000));
};

const resetFailedLoginAttempts = async (user) => {
  user.security = {
    ...user.security?.toObject?.(),
    failedLoginAttempts: 0,
    lockUntil: undefined,
  };

  await user.save({ validateBeforeSave: false });
};

const recordFailedLoginAttempt = async (user) => {
  const current = Number(user.security?.failedLoginAttempts || 0) + 1;
  const shouldLock = current >= MAX_FAILED_LOGIN_ATTEMPTS;

  user.security = {
    ...user.security?.toObject?.(),
    failedLoginAttempts: current,
    lockUntil: shouldLock ? new Date(Date.now() + LOGIN_LOCK_MINUTES * 60 * 1000) : user.security?.lockUntil,
  };

  await user.save({ validateBeforeSave: false });
};

const hashRegistrationPassword = (password = '') =>
  crypto.createHash('sha256').update(`${password}:${process.env.JWT_SECRET}`).digest('hex');

const signRegisterChallengeToken = ({ registration, passwordHash, otpCode, issuedAt = Date.now() }) =>
  jwt.sign(
    {
      purpose: REGISTER_CHALLENGE_PURPOSE,
      registration,
      passwordHash,
      otpHash: hashOtpCode(otpCode),
      issuedAt,
    },
    process.env.JWT_SECRET,
    { expiresIn: `${REGISTER_OTP_EXPIRES_MINUTES}m` },
  );

const verifyRegisterChallengeToken = (token) => {
  try {
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.purpose !== REGISTER_CHALLENGE_PURPOSE) return null;
    return decoded;
  } catch (_error) {
    return null;
  }
};

const sendRegistrationOtpEmail = async (email, otpCode) => {
  await sendEmail({
    to: email,
    subject: 'Krishihub registration verification code',
    text: `Your Krishihub registration code is ${otpCode}. It expires in ${REGISTER_OTP_EXPIRES_MINUTES} minutes.`,
    html: `<p>Your Krishihub registration code is <strong>${otpCode}</strong>.</p><p>This code expires in ${REGISTER_OTP_EXPIRES_MINUTES} minutes.</p>`,
  });
};

const handleRegistrationEmailError = (next, error) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error('Registration OTP email delivery failed:', error?.message || error);
  }

  return next(new AppError('Unable to send verification email right now. Please try again shortly.', 503));
};

const sendSecurityLoginAlert = async (user, req) => {
  if (!user?.security?.loginAlerts || !isEmailDeliveryConfigured()) return;

  const ipAddress = getClientIp(req);
  const userAgent = getUserAgent(req);
  const time = new Date().toISOString();

  await sendEmail({
    to: user.email,
    subject: 'New login detected on Krishihub',
    text: `A login to your Krishihub account was detected.\nTime: ${time}\nIP: ${ipAddress}\nDevice: ${userAgent}`,
    html: `<p>A login to your Krishihub account was detected.</p><p><strong>Time:</strong> ${time}<br/><strong>IP:</strong> ${ipAddress}<br/><strong>Device:</strong> ${userAgent}</p>`,
  });
};

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
  googleLinked: Boolean(user.googleId),
  phone: user.phone,
  bio: user.bio,
  location: user.location,
  isFarmerVerified: user.isFarmerVerified,
  walletBalance: user.walletBalance,
  badges: user.badges,
  preferences: user.preferences,
  security: {
    twoFactorEnabled: Boolean(user.security?.twoFactorEnabled),
    loginAlerts: typeof user.security?.loginAlerts === 'boolean' ? user.security.loginAlerts : true,
  },
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

const applyRoleDefaults = async (user) => {
  if (user.role === 'farmer') {
    if (!Array.isArray(user.badges) || !user.badges.includes('new-farmer')) {
      user.badges = [...(user.badges || []), 'new-farmer'];
    }

    user.farmerProfile = {
      ...user.farmerProfile?.toObject?.(),
      farmName: user.farmerProfile?.farmName || `${user.name}'s Farm`,
    };
  }

  if (user.role === 'buyer') {
    user.buyerProfile = {
      ...user.buyerProfile?.toObject?.(),
      preferredPaymentMethod: user.buyerProfile?.preferredPaymentMethod || 'stripe',
    };
  }

  await user.save();
};

const requestRegisterOtp = catchAsync(async (req, res, next) => {
  const { name, email, password, role, location, preferences } = req.body;

  if (!isEmailDeliveryConfigured()) {
    return next(new AppError('Registration OTP requires SMTP configuration', 500));
  }

  if (role === 'admin') {
    return next(new AppError('Admin account cannot be self-registered', 403));
  }

  const normalizedEmail = String(email || '').toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail });

  if (existing) {
    return next(new AppError('Email already in use', 400));
  }

  const otpCode = generateNumericOtp(Math.max(4, Math.min(REGISTER_OTP_LENGTH, 8)));
  const passwordHash = hashRegistrationPassword(password);

  const registerChallengeToken = signRegisterChallengeToken({
    registration: {
      name,
      email: normalizedEmail,
      role: role || 'buyer',
      location,
      preferences,
    },
    passwordHash,
    otpCode,
    issuedAt: Date.now(),
  });

  try {
    await sendRegistrationOtpEmail(normalizedEmail, otpCode);
  } catch (error) {
    return handleRegistrationEmailError(next, error);
  }

  res.status(200).json({
    status: 'success',
    registerChallengeToken,
    message: 'Verification code sent to your email',
  });
});

const verifyRegisterOtp = catchAsync(async (req, res, next) => {
  const { registerChallengeToken, otpCode, password } = req.body;

  const decoded = verifyRegisterChallengeToken(registerChallengeToken);
  if (!decoded) {
    return next(new AppError('Registration session expired. Please request a new verification code.', 401));
  }

  const normalizedOtp = String(otpCode || '').replace(/\D/g, '');
  if (!normalizedOtp) {
    return next(new AppError('Verification code is required', 400));
  }

  if (hashOtpCode(normalizedOtp) !== decoded.otpHash) {
    return next(new AppError('Invalid verification code', 400));
  }

  if (hashRegistrationPassword(password) !== decoded.passwordHash) {
    return next(new AppError('Registration details mismatch. Please request a new verification code.', 400));
  }

  const registration = decoded.registration || {};
  if (registration.role === 'admin') {
    return next(new AppError('Admin account cannot be self-registered', 403));
  }

  const exists = await User.findOne({ email: registration.email });
  if (exists) {
    return next(new AppError('Email already in use', 400));
  }

  const user = await User.create({
    name: registration.name,
    email: registration.email,
    password,
    role: registration.role || 'buyer',
    location: registration.location,
    preferences: registration.preferences,
  });

  await applyRoleDefaults(user);
  createSendToken(user, 201, res);
});

const resendRegisterOtp = catchAsync(async (req, res, next) => {
  const { registerChallengeToken } = req.body;
  const decoded = verifyRegisterChallengeToken(registerChallengeToken);

  if (!decoded) {
    return next(new AppError('Registration session expired. Please restart registration.', 401));
  }

  if (!isEmailDeliveryConfigured()) {
    return next(new AppError('Registration OTP requires SMTP configuration', 500));
  }

  const lastIssuedAt = Number(decoded.issuedAt || 0);
  const elapsedSeconds = lastIssuedAt ? Math.floor((Date.now() - lastIssuedAt) / 1000) : Number.MAX_SAFE_INTEGER;
  if (elapsedSeconds < REGISTER_OTP_RESEND_SECONDS) {
    return next(new AppError(`Please wait ${REGISTER_OTP_RESEND_SECONDS - elapsedSeconds}s before resending`, 429));
  }

  const otpCode = generateNumericOtp(Math.max(4, Math.min(REGISTER_OTP_LENGTH, 8)));
  const nextToken = signRegisterChallengeToken({
    registration: decoded.registration,
    passwordHash: decoded.passwordHash,
    otpCode,
    issuedAt: Date.now(),
  });

  try {
    await sendRegistrationOtpEmail(decoded.registration?.email, otpCode);
  } catch (error) {
    return handleRegistrationEmailError(next, error);
  }

  res.status(200).json({
    status: 'success',
    registerChallengeToken: nextToken,
    message: 'Verification code resent to your email',
  });
});

const login = catchAsync(async (req, res, next) => {
  const { email, password, twoFactorCode, twoFactorAuthToken } = req.body;

  if (!email || !password) {
    return next(new AppError('Email and password are required', 400));
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail }).select(
    '+password +twoFactorSecret +security.failedLoginAttempts +security.lockUntil',
  );

  if (!user) {
    return next(new AppError('Invalid credentials', 401));
  }

  if (!user.isActive) {
    return next(new AppError('This account is deactivated. Contact admin to reactivate.', 403));
  }

  if (user.blocked) {
    return next(new AppError('Account is blocked', 403));
  }

  if (isAccountLocked(user)) {
    return next(
      new AppError(
        `Account temporarily locked due to failed logins. Try again in ${getRemainingLockMinutes(user)} minute(s).`,
        423,
      ),
    );
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    await recordFailedLoginAttempt(user);

    if (isAccountLocked(user)) {
      return next(
        new AppError(
          `Account temporarily locked due to failed logins. Try again in ${getRemainingLockMinutes(user)} minute(s).`,
          423,
        ),
      );
    }

    return next(new AppError('Invalid credentials', 401));
  }

  const requiresTwoFactor = Boolean(user.security?.twoFactorEnabled);
  const needsChallenge = requiresTwoFactor;

  if (needsChallenge) {
    const decoded = verifyLoginChallengeToken(twoFactorAuthToken);
    if (
      !decoded ||
      String(decoded.id) !== String(user._id) ||
      Boolean(decoded.requiresTwoFactor) !== requiresTwoFactor
    ) {
      return sendLoginChallenge(res, {
        userId: user._id,
        provider: 'password',
        requiresTwoFactor,
        message: 'Authenticator code required',
      });
    }

    if (requiresTwoFactor) {
      if (!twoFactorCode) {
        return next(new AppError('Authenticator code is required', 401));
      }

      if (!verifyTotpCode(user.twoFactorSecret, twoFactorCode)) {
        return next(new AppError('Invalid authenticator code', 401));
      }
    }
  }

  await resetFailedLoginAttempts(user);
  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });
  sendSecurityLoginAlert(user, req).catch(() => undefined);

  createSendToken(user, 200, res);
});

const loginWithGoogle = catchAsync(async (req, res, next) => {
  const { credential, role, twoFactorCode, twoFactorAuthToken } = req.body;

  if (!credential) {
    return next(new AppError('Google credential is required', 400));
  }

  if (!googleClient) {
    return next(
      new AppError('Google login is not configured. Set GOOGLE_CLIENT_ID in server environment.', 500),
    );
  }

  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
  } catch (_error) {
    return next(new AppError('Invalid Google credential', 401));
  }

  const payload = ticket.getPayload();
  const googleEmail = payload?.email?.toLowerCase()?.trim();

  if (!googleEmail || !payload?.email_verified) {
    return next(new AppError('Google account email is not verified', 401));
  }

  let user = await User.findOne({ email: googleEmail }).select(
    '+twoFactorSecret +security.failedLoginAttempts +security.lockUntil',
  );

  if (!user) {
    user = await User.create({
      name: payload?.name || googleEmail.split('@')[0],
      email: googleEmail,
      password: crypto.randomBytes(24).toString('hex'),
      role: role === 'farmer' ? 'farmer' : 'buyer',
      avatar: payload?.picture,
      googleId: payload?.sub,
      lastLoginAt: new Date(),
    });

    await applyRoleDefaults(user);
    user = await User.findById(user._id).select(
      '+twoFactorSecret +security.failedLoginAttempts +security.lockUntil',
    );
  } else {
    if (!user.googleId && payload?.sub) {
      user.googleId = payload.sub;
    }

    if (!user.avatar && payload?.picture) {
      user.avatar = payload.picture;
    }
  }

  if (!user.isActive) {
    return next(new AppError('This account is deactivated. Contact admin to reactivate.', 403));
  }

  if (user.blocked) {
    return next(new AppError('Account is blocked', 403));
  }

  if (isAccountLocked(user)) {
    return next(
      new AppError(
        `Account temporarily locked due to failed logins. Try again in ${getRemainingLockMinutes(user)} minute(s).`,
        423,
      ),
    );
  }

  const requiresTwoFactor = Boolean(user.security?.twoFactorEnabled);
  const needsChallenge = requiresTwoFactor;

  if (needsChallenge) {
    const decoded = verifyLoginChallengeToken(twoFactorAuthToken);
    if (
      !decoded ||
      String(decoded.id) !== String(user._id) ||
      Boolean(decoded.requiresTwoFactor) !== requiresTwoFactor
    ) {
      return sendLoginChallenge(res, {
        userId: user._id,
        provider: 'google',
        requiresTwoFactor,
        message: 'Authenticator code required',
      });
    }

    if (requiresTwoFactor) {
      if (!twoFactorCode) {
        return next(new AppError('Authenticator code is required', 401));
      }

      if (!verifyTotpCode(user.twoFactorSecret, twoFactorCode)) {
        return next(new AppError('Invalid authenticator code', 401));
      }
    }
  }

  await resetFailedLoginAttempts(user);
  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });
  sendSecurityLoginAlert(user, req).catch(() => undefined);

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
    'security',
    'twoFactorSecret',
    'twoFactorTempSecret',
    'googleId',
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

  const loginAlerts = parseBoolean(security.loginAlerts);

  if (typeof security.twoFactorEnabled !== 'undefined') {
    return next(
      new AppError(
        'Use dedicated two-factor endpoints to enable or disable authentication app verification',
        400,
      ),
    );
  }

  if (typeof loginAlerts === 'undefined') {
    return next(new AppError('At least one security setting is required (loginAlerts)', 400));
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  user.security = {
    ...user.security?.toObject?.(),
    ...(typeof loginAlerts === 'boolean' ? { loginAlerts } : {}),
  };

  await user.save();

  res.status(200).json({
    status: 'success',
    user,
  });
});

const setupTwoFactor = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id).select('+twoFactorSecret +twoFactorTempSecret');

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  const generated = speakeasy.generateSecret({
    name: `${TWO_FACTOR_ISSUER} (${user.email})`,
    issuer: TWO_FACTOR_ISSUER,
    length: 20,
  });

  user.twoFactorTempSecret = generated.base32;
  await user.save({ validateBeforeSave: false });

  const qrCodeDataUrl = await QRCode.toDataURL(generated.otpauth_url);

  res.status(200).json({
    status: 'success',
    setup: {
      secret: generated.base32,
      otpauthUrl: generated.otpauth_url,
      qrCodeDataUrl,
    },
  });
});

const enableTwoFactor = catchAsync(async (req, res, next) => {
  const { token } = req.body;

  if (!token) {
    return next(new AppError('Authentication code is required', 400));
  }

  const user = await User.findById(req.user._id).select('+twoFactorSecret +twoFactorTempSecret');

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  if (!user.twoFactorTempSecret) {
    return next(new AppError('Start two-factor setup first', 400));
  }

  if (!verifyTotpCode(user.twoFactorTempSecret, token)) {
    return next(new AppError('Invalid authentication code', 400));
  }

  user.twoFactorSecret = user.twoFactorTempSecret;
  user.twoFactorTempSecret = undefined;
  user.security = {
    ...user.security?.toObject?.(),
    twoFactorEnabled: true,
  };

  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: 'success',
    message: 'Two-factor authentication enabled',
    user: safeUserPayload(user),
  });
});

const disableTwoFactor = catchAsync(async (req, res, next) => {
  const { token } = req.body;

  if (!token) {
    return next(new AppError('Authentication code is required', 400));
  }

  const user = await User.findById(req.user._id).select('+twoFactorSecret +twoFactorTempSecret');

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  if (!user.security?.twoFactorEnabled || !user.twoFactorSecret) {
    return next(new AppError('Two-factor authentication is not enabled', 400));
  }

  if (!verifyTotpCode(user.twoFactorSecret, token)) {
    return next(new AppError('Invalid authentication code', 400));
  }

  user.security = {
    ...user.security?.toObject?.(),
    twoFactorEnabled: false,
  };
  user.twoFactorSecret = undefined;
  user.twoFactorTempSecret = undefined;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: 'success',
    message: 'Two-factor authentication disabled',
    user: safeUserPayload(user),
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
  requestRegisterOtp,
  verifyRegisterOtp,
  resendRegisterOtp,
  login,
  loginWithGoogle,
  logout,
  getMe,
  getAccountOverview,
  updateMe,
  changePassword,
  changeEmail,
  updatePreferences,
  updateSecurity,
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
  updateAddresses,
  updateRoleProfile,
  deactivateAccount,
};
