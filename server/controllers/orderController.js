const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const dayjs = require('dayjs');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const getStripe = require('../config/stripe');
const { generateInvoiceBuffer } = require('../utils/invoice');
const { createNotification } = require('../utils/notify');
const ROUTING_ENGINE_VERSION = 'krishihub-routing-v1';
const RETURN_WINDOW_DAYS = Math.max(Number(process.env.RETURN_WINDOW_DAYS || 10), 1);
const PAYMENT_METHODS = ['stripe', 'cod', 'esewa', 'khalti', 'mobile_banking'];
const DIGITAL_PAYMENT_METHODS = ['esewa', 'khalti', 'mobile_banking'];
const PAYMENT_METHOD_LABELS = {
  stripe: 'Card (Stripe)',
  cod: 'Cash on Delivery',
  esewa: 'eSewa',
  khalti: 'Khalti',
  mobile_banking: 'Mobile Banking',
};
const PAYMENT_REDIRECT_QUERY_FIELDS = ['payment', 'provider', 'orderId', 'message'];
const ESEWA_SIGNED_FIELD_NAMES = ['total_amount', 'transaction_uuid', 'product_code'];
const PAYMENT_CHECKOUT_PURPOSE = 'payment-checkout';

const DELIVERY_ZONES = {
  'bagmati': { minDays: 1, maxDays: 2, partners: ['KrishiExpress', 'GreenGo Logistics', 'NepXpress'] },
  'gandaki': { minDays: 1, maxDays: 2, partners: ['KrishiExpress', 'YetiParcel', 'NepXpress'] },
  'koshi': { minDays: 2, maxDays: 4, partners: ['GreenGo Logistics', 'NepXpress', 'Himal Courier'] },
  'lumbini': { minDays: 2, maxDays: 4, partners: ['NepXpress', 'Himal Courier', 'FarmFreight'] },
  'madhesh': { minDays: 2, maxDays: 4, partners: ['KrishiExpress', 'Himal Courier', 'FarmFreight'] },
  'sudurpashchim': { minDays: 3, maxDays: 6, partners: ['Himal Courier', 'FarmFreight', 'NepXpress'] },
  'karnali': { minDays: 3, maxDays: 6, partners: ['Himal Courier', 'FarmFreight', 'GreenGo Logistics'] },
  'default': { minDays: 2, maxDays: 5, partners: ['KrishiExpress', 'NepXpress', 'GreenGo Logistics'] },
};

const normalizeLocationToken = (value) => String(value || '').trim().toLowerCase();
const normalizePaymentMethod = (value = 'stripe') =>
  String(value || 'stripe')
    .trim()
    .toLowerCase();

const getUniqueFarmerIds = (items) => {
  const set = new Set(items.map((item) => String(item.farmer)));
  return [...set];
};

const normalizeOrigin = (value = '') => String(value).trim().replace(/\/+$/, '');
const getPrimaryClientUrl = () =>
  String(process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean)[0] || 'http://localhost:5173';

const getPrimaryServerUrl = (req) => {
  const configured = normalizeOrigin(process.env.SERVER_URL || '');
  if (configured) return configured;

  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim();
  const protocol = forwardedProto || req.protocol || 'http';
  return `${protocol}://${req.get('host')}`;
};

const hasValue = (value) => typeof value === 'string' && value.trim().length > 0;
const normalizeMoney = (value) => Number(Math.max(0, Number(value || 0)).toFixed(2));
const formatMoney = (value) => normalizeMoney(value).toFixed(2);

const getEsewaConfig = () => ({
  baseUrl: normalizeOrigin(process.env.ESEWA_BASE_URL || 'https://rc-epay.esewa.com.np'),
  productCode: String(process.env.ESEWA_PRODUCT_CODE || '').trim(),
  secretKey: String(process.env.ESEWA_SECRET_KEY || '').trim(),
});

const getKhaltiConfig = () => ({
  baseUrl: normalizeOrigin(process.env.KHALTI_BASE_URL || 'https://dev.khalti.com'),
  secretKey: String(process.env.KHALTI_SECRET_KEY || '').trim(),
  websiteUrl: normalizeOrigin(process.env.KHALTI_WEBSITE_URL || getPrimaryClientUrl()),
});

const signCheckoutToken = (payload) =>
  jwt.sign(
    {
      purpose: PAYMENT_CHECKOUT_PURPOSE,
      ...payload,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.PAYMENT_CHECKOUT_TOKEN_EXPIRES_IN || '30m',
    },
  );

const verifyCheckoutToken = (token) => {
  try {
    const decoded = jwt.verify(String(token || ''), process.env.JWT_SECRET);
    if (decoded?.purpose !== PAYMENT_CHECKOUT_PURPOSE) return null;
    return decoded;
  } catch (_error) {
    return null;
  }
};

const extractObjectIdFromTransactionUuid = (value) => {
  const source = String(value || '').trim();
  if (!source) return null;
  const match = source.match(/([a-f0-9]{24})/i);
  if (!match) return null;
  const candidate = match[1].toLowerCase();
  return mongoose.isValidObjectId(candidate) ? candidate : null;
};

const extractLegacyOrderSuffixFromTransactionUuid = (value) => {
  const source = String(value || '').trim();
  if (!source) return null;
  const match = source.match(/^KH-([a-f0-9]{10})-/i);
  return match ? match[1].toLowerCase() : null;
};

const buildEsewaSignatureMessage = ({ payload = {}, signedFieldNames }) => {
  const fieldNames = String(signedFieldNames || ESEWA_SIGNED_FIELD_NAMES.join(','))
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return fieldNames.map((key) => `${key}=${String(payload[key] ?? '')}`).join(',');
};

const signEsewaSignature = ({ payload = {}, signedFieldNames, secretKey }) =>
  crypto
    .createHmac('sha256', String(secretKey || ''))
    .update(
      buildEsewaSignatureMessage({
        payload,
        signedFieldNames,
      }),
    )
    .digest('base64');

const compareSignatures = (left, right) => {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

const decodeEsewaDataPayload = (encoded) => {
  if (!encoded) return null;
  const raw = String(encoded).trim();
  if (!raw) return null;

  const candidates = [
    raw,
    decodeURIComponent(raw),
    raw.replace(/\s/g, '+'),
    decodeURIComponent(raw).replace(/\s/g, '+'),
    raw.replace(/-/g, '+').replace(/_/g, '/'),
    decodeURIComponent(raw).replace(/-/g, '+').replace(/_/g, '/'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const asJson = JSON.parse(candidate);
      if (asJson && typeof asJson === 'object') return asJson;
    } catch (_ignore) {
      // try base64 path
    }

    try {
      const decoded = Buffer.from(candidate, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (_ignore) {
      // continue
    }
  }

  return null;
};

const normalizeGatewayStatus = (value) => String(value || '').trim().toUpperCase();
const escapeHtmlValue = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildClientRedirectUrl = ({ req, destination = 'orders', query = {} }) => {
  const clientUrl = getPrimaryClientUrl();
  const path = destination === 'checkout' ? '/checkout' : '/orders';
  const params = new URLSearchParams();

  PAYMENT_REDIRECT_QUERY_FIELDS.forEach((field) => {
    const value = query[field];
    if (typeof value === 'undefined' || value === null || value === '') return;
    params.set(field, String(value));
  });

  const search = params.toString();
  return `${clientUrl}${path}${search ? `?${search}` : ''}`;
};

const redirectToClient = (req, res, options) => {
  res.redirect(302, buildClientRedirectUrl({ req, ...options }));
};

const mergePaymentGateway = (order, nextGateway) => {
  const current = order.paymentGateway?.toObject?.() || order.paymentGateway || {};
  order.paymentGateway = {
    ...current,
    ...nextGateway,
  };
};

const markOrderAsPaid = async ({ order, provider, reference, details = {}, io }) => {
  if (!order) return false;

  if (order.paymentStatus !== 'paid') {
    order.paymentStatus = 'paid';
  }
  order.status = 'paid';
  if (reference) {
    order.paymentReference = String(reference);
  }

  mergePaymentGateway(order, {
    provider,
    lastVerifiedAt: new Date(),
    ...details,
  });

  await order.save();

  await createNotification({
    user: order.buyer,
    type: 'order',
    title: 'Payment successful',
    message: `Payment received for order ${order._id}`,
    metadata: { orderId: order._id, provider },
    io,
  });

  return true;
};

const markOrderPaymentFailed = async ({ order, provider, details = {} }) => {
  if (!order || order.paymentStatus === 'paid') return false;

  order.paymentStatus = 'failed';
  mergePaymentGateway(order, {
    provider,
    ...details,
  });

  await order.save();
  return true;
};

const findOrderForEsewa = async ({ orderId, transactionUuid, callbackToken }) => {
  const decodedCallbackToken = verifyCheckoutToken(callbackToken);

  if (decodedCallbackToken?.orderId && mongoose.isValidObjectId(decodedCallbackToken.orderId)) {
    const byToken = await Order.findById(decodedCallbackToken.orderId);
    if (byToken) return byToken;
  }

  if (mongoose.isValidObjectId(orderId)) {
    const byId = await Order.findById(orderId);
    if (byId) return byId;
  }

  if (hasValue(transactionUuid)) {
    const cleanedTransactionUuid = String(transactionUuid).trim();
    const byTxnUuid = await Order.findOne({ 'paymentGateway.esewa.transactionUuid': cleanedTransactionUuid });
    if (byTxnUuid) return byTxnUuid;

    const embeddedOrderId = extractObjectIdFromTransactionUuid(cleanedTransactionUuid);
    if (embeddedOrderId) {
      const byEmbeddedId = await Order.findById(embeddedOrderId);
      if (byEmbeddedId) return byEmbeddedId;
    }

    const legacySuffix = extractLegacyOrderSuffixFromTransactionUuid(cleanedTransactionUuid);
    if (legacySuffix) {
      const matches = await Order.aggregate([
        {
          $match: {
            paymentMethod: 'esewa',
          },
        },
        {
          $addFields: {
            orderIdStr: { $toString: '$_id' },
          },
        },
        {
          $match: {
            orderIdStr: { $regex: `${legacySuffix}$`, $options: 'i' },
          },
        },
        {
          $sort: { createdAt: -1 },
        },
        {
          $limit: 1,
        },
      ]);

      if (matches[0]?._id) {
        const byLegacySuffix = await Order.findById(matches[0]._id);
        if (byLegacySuffix) return byLegacySuffix;
      }
    }
  }

  return null;
};

const findOrderForKhalti = async ({ orderId, pidx }) => {
  if (mongoose.isValidObjectId(orderId)) {
    const byId = await Order.findById(orderId);
    if (byId) return byId;
  }

  if (hasValue(pidx)) {
    return Order.findOne({ 'paymentGateway.khalti.pidx': String(pidx).trim() });
  }

  return null;
};

const calculateDiscount = (coupon, total) => {
  if (!coupon) return 0;

  if (coupon.discountType === 'percent') {
    return Number(((total * coupon.value) / 100).toFixed(2));
  }

  return Math.min(coupon.value, total);
};

const resolveDeliveryZone = (shippingAddress = {}) => {
  const provinceKey = normalizeLocationToken(shippingAddress.province || shippingAddress.district);
  if (provinceKey.includes('bagmati')) return 'bagmati';
  if (provinceKey.includes('gandaki')) return 'gandaki';
  if (provinceKey.includes('koshi')) return 'koshi';
  if (provinceKey.includes('lumbini')) return 'lumbini';
  if (provinceKey.includes('madhesh')) return 'madhesh';
  if (provinceKey.includes('sudur') || provinceKey.includes('sudurpashchim')) return 'sudurpashchim';
  if (provinceKey.includes('karnali')) return 'karnali';
  return 'default';
};

const buildRoutingCandidates = ({ zone, paymentMethod, totalAmount, farmerCount, itemCount }) => {
  const zonePreset = DELIVERY_ZONES[zone] || DELIVERY_ZONES.default;
  return zonePreset.partners.map((partnerName, index) => {
    const baseScore = 78 - index * 6;
    const codPenalty = paymentMethod === 'cod' && index === 0 ? -4 : 0;
    const highValueBoost = totalAmount >= 5000 && index === 0 ? 5 : 0;
    const splitShipmentPenalty = farmerCount >= 3 ? -6 : farmerCount === 2 ? -2 : 0;
    const itemComplexityPenalty = itemCount >= 7 ? -3 : 0;
    const score = Math.max(
      40,
      Math.min(98, baseScore + codPenalty + highValueBoost + splitShipmentPenalty + itemComplexityPenalty),
    );

    return { partnerName, score };
  });
};

const generateTrackingId = () =>
  `KH-${Date.now().toString(36).slice(-6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const buildIntelligentRoutingPlan = ({
  shippingAddress = {},
  paymentMethod = 'stripe',
  totalAmount = 0,
  farmerCount = 1,
  itemCount = 1,
}) => {
  const zone = resolveDeliveryZone(shippingAddress);
  const zonePreset = DELIVERY_ZONES[zone] || DELIVERY_ZONES.default;
  const [bestCandidate] = buildRoutingCandidates({
    zone,
    paymentMethod,
    totalAmount,
    farmerCount,
    itemCount,
  }).sort((a, b) => b.score - a.score);

  const etaDays = Math.round((zonePreset.minDays + zonePreset.maxDays) / 2);
  const estimatedDelivery = dayjs().add(etaDays, 'day').toDate();
  const routeReason = [
    `Zone ${zone}`,
    `payment ${paymentMethod}`,
    farmerCount > 1 ? `${farmerCount} farmers in basket` : 'single-farmer basket',
    totalAmount >= 5000 ? 'high value order' : 'standard order',
  ].join(', ');

  return {
    partnerName: bestCandidate.partnerName,
    trackingId: generateTrackingId(),
    status: 'routing-ready',
    lastLocation: `${shippingAddress.district || 'Dispatch Hub'}, ${shippingAddress.province || 'Nepal'}`,
    estimatedDelivery,
    dispatchZone: zone,
    routeEngineVersion: ROUTING_ENGINE_VERSION,
    routeScore: bestCandidate.score,
    etaConfidence: Math.max(52, Math.min(96, bestCandidate.score - (farmerCount > 2 ? 6 : 0))),
    routeReason,
    deliveryWindowDays: {
      min: zonePreset.minDays,
      max: zonePreset.maxDays,
    },
  };
};

const calculateCouponSavings = (coupon, subtotal) => {
  if (!coupon || subtotal <= 0) return 0;
  if (coupon.discountType === 'percent') {
    return Number(((subtotal * Number(coupon.value || 0)) / 100).toFixed(2));
  }
  return Math.min(Number(coupon.value || 0), subtotal);
};

const getPaymentRecommendation = ({ subtotal = 0, farmerCount = 1 }) => {
  if (subtotal >= 10000 || farmerCount >= 4) {
    return {
      method: 'stripe',
      rationale: 'Card payments provide better success rate for high-value and complex multi-farm orders.',
    };
  }

  if (subtotal >= 5000 || farmerCount >= 3) {
    return {
      method: 'esewa',
      rationale: 'eSewa is optimized for mid to high-value Nepal digital payments with strong buyer adoption.',
    };
  }

  if (subtotal >= 2500 || farmerCount === 2) {
    return {
      method: 'khalti',
      rationale: 'Khalti reduces checkout friction for regular Nepal domestic orders.',
    };
  }

  return {
    method: 'cod',
    rationale: 'Cash on delivery is optimal for low-friction local orders.',
  };
};

const buildPaymentInstructions = ({ paymentMethod, orderId, totalAmount }) => {
  if (!DIGITAL_PAYMENT_METHODS.includes(paymentMethod)) return null;

  if (paymentMethod === 'esewa') {
    return {
      provider: 'eSewa',
      channel: 'wallet',
      amount: totalAmount,
      merchantCode: process.env.ESEWA_MERCHANT_CODE || '',
      accountHint: process.env.ESEWA_ACCOUNT_HINT || '',
      referenceHint: `Use order ID ${orderId} as remarks/reference.`,
      message: 'Complete payment in eSewa and keep transaction reference for verification.',
    };
  }

  if (paymentMethod === 'khalti') {
    return {
      provider: 'Khalti',
      channel: 'wallet',
      amount: totalAmount,
      merchantId: process.env.KHALTI_MERCHANT_ID || '',
      accountHint: process.env.KHALTI_ACCOUNT_HINT || '',
      referenceHint: `Use order ID ${orderId} as payment reference.`,
      message: 'Complete payment in Khalti and keep transaction reference for verification.',
    };
  }

  return {
    provider: 'Mobile Banking',
    channel: 'bank_transfer',
    amount: totalAmount,
    bankName: process.env.MOBILE_BANKING_BANK_NAME || '',
    beneficiaryName: process.env.MOBILE_BANKING_BENEFICIARY || '',
    accountNumber: process.env.MOBILE_BANKING_ACCOUNT_NUMBER || '',
    referenceHint: `Use order ID ${orderId} as transaction purpose/reference.`,
    message: 'Transfer from your banking app and keep transaction reference for verification.',
  };
};

const isReturnWindowOpen = (order) => {
  const referenceDate = order.updatedAt || order.createdAt;
  return dayjs(referenceDate).add(RETURN_WINDOW_DAYS, 'day').isAfter(new Date());
};

const recordAdminOrderAudit = (req, payload) => {
  if (req.user?.role !== 'admin') return;

  AuditLog.create({
    actor: req.user._id,
    actorName: req.user.name,
    action: payload.action,
    targetType: 'order',
    targetId: String(payload.orderId || ''),
    targetLabel: payload.targetLabel || '',
    details: payload.details || {},
    ipAddress: req.headers['x-forwarded-for']?.split(',')?.[0]?.trim() || req.ip || '',
    userAgent: req.get('user-agent') || '',
  }).catch((error) => {
    console.error('Failed to create order audit log entry:', error.message);
  });
};

const createOrder = catchAsync(async (req, res, next) => {
  const { items = [], shippingAddress = {}, couponCode, paymentMethod = 'stripe' } = req.body;
  const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);

  if (!PAYMENT_METHODS.includes(normalizedPaymentMethod)) {
    return next(new AppError(`Invalid payment method. Allowed: ${PAYMENT_METHODS.join(', ')}`, 400));
  }

  if (!items.length) {
    return next(new AppError('Order must include at least one item', 400));
  }

  const productIds = items.map((item) => item.productId);
  const products = await Product.find({ _id: { $in: productIds }, status: 'approved' });

  if (products.length !== items.length) {
    return next(new AppError('One or more products are unavailable', 400));
  }

  const orderItems = [];
  let totalBeforeDiscount = 0;

  for (const item of items) {
    const product = products.find((p) => String(p._id) === String(item.productId));
    const qty = Number(item.quantity || 0);

    if (!product || qty < 1) {
      return next(new AppError('Invalid order item payload', 400));
    }

    if (product.quantityAvailable < qty) {
      return next(new AppError(`Insufficient inventory for ${product.name}`, 400));
    }

    const subtotal = Number((product.pricePerUnit * qty).toFixed(2));

    orderItems.push({
      product: product._id,
      farmer: product.farmer,
      productName: product.name,
      quantity: qty,
      unitPrice: product.pricePerUnit,
      subtotal,
    });

    totalBeforeDiscount += subtotal;
  }

  let coupon = null;

  if (couponCode) {
    coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });

    if (!coupon || coupon.expiresAt < new Date()) {
      return next(new AppError('Coupon is invalid or expired', 400));
    }

    if (coupon.usedBy.some((id) => String(id) === String(req.user._id))) {
      return next(new AppError('Coupon already used by this user', 400));
    }

    if (coupon.usedBy.length >= coupon.usageLimit) {
      return next(new AppError('Coupon usage limit reached', 400));
    }

    if (totalBeforeDiscount < coupon.minOrderAmount) {
      return next(new AppError('Order does not meet minimum coupon amount', 400));
    }
  }

  const discountAmount = calculateDiscount(coupon, totalBeforeDiscount);
  const totalAmount = Number((totalBeforeDiscount - discountAmount).toFixed(2));

  const farmerDecisions = getUniqueFarmerIds(orderItems).map((farmer) => ({
    farmer,
    decision: 'pending',
  }));
  const routingPlan = buildIntelligentRoutingPlan({
    shippingAddress,
    paymentMethod: normalizedPaymentMethod,
    totalAmount,
    farmerCount: farmerDecisions.length,
    itemCount: orderItems.length,
  });

  const order = await Order.create({
    buyer: req.user._id,
    items: orderItems,
    shippingAddress,
    farmerDecisions,
    paymentMethod: normalizedPaymentMethod,
    totalAmount,
    discountAmount,
    coupon: coupon?._id,
    tracking: routingPlan,
  });

  await Promise.all(
    orderItems.map(async (item) => {
      const product = products.find((p) => String(p._id) === String(item.product));
      product.quantityAvailable -= item.quantity;
      product.popularity += item.quantity;
      await product.save();

      if (req.io) {
        req.io.emit('inventory:update', {
          productId: product._id,
          quantityAvailable: product.quantityAvailable,
        });
      }
    }),
  );

  if (coupon) {
    coupon.usedBy.push(req.user._id);
    await coupon.save();
  }

  const farmerIds = getUniqueFarmerIds(orderItems);

  await Promise.all(
    farmerIds.map((farmerId) =>
      createNotification({
        user: farmerId,
        type: 'order',
        title: 'New order received',
        message: `Order ${order._id} has new items from your farm`,
        metadata: { orderId: order._id },
        io: req.io,
      }),
    ),
  );

  let checkoutUrl = null;

  if (normalizedPaymentMethod === 'stripe') {
    const stripe = getStripe();

    if (!stripe) {
      return next(
        new AppError(
          'Stripe payment is currently unavailable. Please choose COD, eSewa, Khalti, or mobile banking.',
          503,
        ),
      );
    }

    const clientUrl = getPrimaryClientUrl();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: orderItems.map((item) => ({
        price_data: {
          currency: (process.env.STRIPE_CURRENCY || 'npr').toLowerCase(),
          product_data: {
            name: item.productName,
          },
          unit_amount: Math.round(item.unitPrice * 100),
        },
        quantity: item.quantity,
      })),
      metadata: {
        orderId: String(order._id),
        buyerId: String(req.user._id),
      },
      success_url: `${clientUrl}/orders?payment=success&orderId=${order._id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/checkout?payment=cancelled`,
    });

    order.stripeSessionId = session.id;
    await order.save();
    checkoutUrl = session.url;
  } else if (normalizedPaymentMethod === 'esewa') {
    const { productCode, secretKey } = getEsewaConfig();
    if (!hasValue(productCode) || !hasValue(secretKey)) {
      return next(
        new AppError('eSewa payment is not configured. Please choose another payment method.', 503),
      );
    }

    const serverUrl = getPrimaryServerUrl(req);
    const transactionUuid = `KH-${String(order._id)}-${Date.now().toString(36).toUpperCase()}`;
    const totalAmount = formatMoney(order.totalAmount);
    const checkoutToken = signCheckoutToken({
      provider: 'esewa',
      orderId: String(order._id),
      transactionUuid,
      totalAmount,
    });

    mergePaymentGateway(order, {
      provider: 'esewa',
      esewa: {
        transactionUuid,
        productCode,
        totalAmount,
        status: 'initiated',
      },
    });

    await order.save();

    checkoutUrl = `${serverUrl}/api/v1/orders/payments/esewa/checkout?token=${encodeURIComponent(checkoutToken)}`;
  } else if (normalizedPaymentMethod === 'khalti') {
    const khalti = getKhaltiConfig();
    if (!hasValue(khalti.secretKey)) {
      return next(
        new AppError('Khalti payment is not configured. Please choose another payment method.', 503),
      );
    }

    const serverUrl = getPrimaryServerUrl(req);
    const amountPaisa = Math.round(normalizeMoney(order.totalAmount) * 100);
    const payload = {
      return_url: `${serverUrl}/api/v1/orders/payments/khalti/callback`,
      website_url: khalti.websiteUrl,
      amount: amountPaisa,
      purchase_order_id: String(order._id),
      purchase_order_name: `Krishihub Order ${String(order._id).slice(-8)}`,
      customer_info: {
        name: shippingAddress?.fullName || req.user?.name || 'Krishihub Buyer',
        email: req.user?.email || 'buyer@krishihub.local',
        phone: shippingAddress?.phone || req.user?.phone || '9800000000',
      },
    };

    let initiateResponse;
    try {
      initiateResponse = await axios.post(
        `${khalti.baseUrl}/api/v2/epayment/initiate/`,
        payload,
        {
          headers: {
            Authorization: `Key ${khalti.secretKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 12000,
        },
      );
    } catch (error) {
      const gatewayMessage =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.response?.data?.error_key ||
        'Khalti payment initiation failed';
      return next(new AppError(gatewayMessage, 502));
    }

    const paymentUrl = initiateResponse.data?.payment_url;
    const pidx = initiateResponse.data?.pidx;

    if (!hasValue(paymentUrl) || !hasValue(pidx)) {
      return next(new AppError('Khalti initiation response is invalid', 502));
    }

    mergePaymentGateway(order, {
      provider: 'khalti',
      khalti: {
        pidx: String(pidx),
        status: 'initiated',
        totalAmountPaisa: amountPaisa,
      },
    });
    await order.save();

    checkoutUrl = paymentUrl;
  }

  const paymentInstructions = buildPaymentInstructions({
    paymentMethod: normalizedPaymentMethod,
    orderId: order._id,
    totalAmount: order.totalAmount,
  });

  res.status(201).json({
    status: 'success',
    order,
    checkoutUrl,
    paymentInstructions,
  });
});

const getCheckoutOptimization = catchAsync(async (req, res, next) => {
  const { items = [], shippingAddress = {}, paymentMethod = 'stripe', couponCode } = req.body || {};
  const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);

  if (!Array.isArray(items) || !items.length) {
    return next(new AppError('Checkout optimization requires at least one item', 400));
  }

  if (!PAYMENT_METHODS.includes(normalizedPaymentMethod)) {
    return next(new AppError(`Invalid payment method. Allowed: ${PAYMENT_METHODS.join(', ')}`, 400));
  }

  const productIds = items
    .map((item) => String(item.productId || '').trim())
    .filter((id) => mongoose.isValidObjectId(id));
  const products = await Product.find({ _id: { $in: productIds }, status: 'approved' }).select(
    '_id name pricePerUnit quantityAvailable farmer',
  );

  if (!products.length) {
    return next(new AppError('No valid products found for optimization', 400));
  }

  let subtotal = 0;
  let lowStockItems = 0;
  const uniqueFarmerSet = new Set();

  for (const item of items) {
    const product = products.find((entry) => String(entry._id) === String(item.productId));
    const qty = Math.max(1, Number(item.quantity || 0));
    if (!product) continue;

    subtotal += Number(product.pricePerUnit || 0) * qty;
    uniqueFarmerSet.add(String(product.farmer));

    if (Number(product.quantityAvailable || 0) <= qty + 5) {
      lowStockItems += 1;
    }
  }

  subtotal = Number(subtotal.toFixed(2));
  const farmerCount = uniqueFarmerSet.size || 1;
  const routingPlan = buildIntelligentRoutingPlan({
    shippingAddress,
    paymentMethod: normalizedPaymentMethod,
    totalAmount: subtotal,
    farmerCount,
    itemCount: items.length,
  });

  const candidateCoupons = await Coupon.find({
    isActive: true,
    expiresAt: { $gt: new Date() },
    $expr: { $lt: [{ $size: '$usedBy' }, '$usageLimit'] },
    usedBy: { $ne: req.user._id },
    minOrderAmount: { $lte: subtotal },
  })
    .sort({ value: -1, createdAt: -1 })
    .limit(30)
    .lean();

  const suggestedCoupons = candidateCoupons
    .map((coupon) => {
      const estimatedSavings = calculateCouponSavings(coupon, subtotal);
      return {
        code: coupon.code,
        discountType: coupon.discountType,
        value: coupon.value,
        minOrderAmount: coupon.minOrderAmount,
        expiresAt: coupon.expiresAt,
        estimatedSavings: Number(estimatedSavings.toFixed(2)),
      };
    })
    .filter((coupon) => coupon.estimatedSavings > 0)
    .sort((a, b) => b.estimatedSavings - a.estimatedSavings || Number(b.value || 0) - Number(a.value || 0))
    .slice(0, 5);

  const bestCoupon = suggestedCoupons[0] || null;
  const selectedCoupon = couponCode
    ? suggestedCoupons.find((item) => item.code === String(couponCode).trim().toUpperCase()) || null
    : null;

  const recommendation = getPaymentRecommendation({ subtotal, farmerCount });
  const splitShipmentRisk = farmerCount >= 4 ? 'high' : farmerCount >= 2 ? 'medium' : 'low';

  res.status(200).json({
    status: 'success',
    optimization: {
      totals: {
        subtotal,
        selectedCouponSavings: Number(selectedCoupon?.estimatedSavings || 0),
        bestCouponSavings: Number(bestCoupon?.estimatedSavings || 0),
        optimizedPayable: Number((subtotal - Number(bestCoupon?.estimatedSavings || 0)).toFixed(2)),
      },
      payment: {
        currentMethod: normalizedPaymentMethod,
        currentMethodLabel: PAYMENT_METHOD_LABELS[normalizedPaymentMethod] || normalizedPaymentMethod,
        recommendedMethod: recommendation.method,
        recommendedMethodLabel: PAYMENT_METHOD_LABELS[recommendation.method] || recommendation.method,
        rationale: recommendation.rationale,
        supportedMethods: PAYMENT_METHODS.map((method) => ({
          value: method,
          label: PAYMENT_METHOD_LABELS[method] || method,
        })),
      },
      routing: {
        partnerName: routingPlan.partnerName,
        dispatchZone: routingPlan.dispatchZone,
        etaConfidence: routingPlan.etaConfidence,
        routeScore: routingPlan.routeScore,
        deliveryWindowDays: routingPlan.deliveryWindowDays,
      },
      coupons: {
        selectedCoupon,
        suggestions: suggestedCoupons,
      },
      riskSignals: {
        splitShipmentRisk,
        lowStockItems,
        farmersInvolved: farmerCount,
        inventoryPressureScore: Math.min(100, lowStockItems * 20 + farmerCount * 8),
      },
    },
  });
});

const getMyOrders = catchAsync(async (req, res) => {
  const orders = await Order.find({ buyer: req.user._id })
    .sort({ createdAt: -1 })
    .populate('items.product', 'name images')
    .populate('items.farmer', 'name')
    .populate('coupon', 'code value');

  res.status(200).json({
    status: 'success',
    count: orders.length,
    orders,
  });
});

const getOrderById = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id)
    .populate('buyer', 'name email')
    .populate('items.product', 'name images')
    .populate('items.farmer', 'name')
    .populate('coupon', 'code value');

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  const isBuyer = String(order.buyer._id) === String(req.user._id);
  const isFarmer = order.items.some((item) => String(item.farmer._id || item.farmer) === String(req.user._id));
  const isAdmin = req.user.role === 'admin';

  if (!isBuyer && !isFarmer && !isAdmin) {
    return next(new AppError('Not authorized to view this order', 403));
  }

  res.status(200).json({
    status: 'success',
    order,
  });
});

const getFarmerOrders = catchAsync(async (req, res) => {
  const orders = await Order.find({ 'items.farmer': req.user._id })
    .sort({ createdAt: -1 })
    .populate('buyer', 'name email');

  res.status(200).json({
    status: 'success',
    count: orders.length,
    orders,
  });
});

const setFarmerDecision = catchAsync(async (req, res, next) => {
  const { decision } = req.body;

  if (!['accepted', 'rejected'].includes(decision)) {
    return next(new AppError('Decision must be accepted or rejected', 400));
  }

  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  const hasFarmerItems = order.items.some((item) => String(item.farmer) === String(req.user._id));

  if (!hasFarmerItems) {
    return next(new AppError('No items in this order belong to this farmer', 403));
  }

  const entry = order.farmerDecisions.find((item) => String(item.farmer) === String(req.user._id));

  if (!entry) {
    return next(new AppError('Farmer decision record missing', 404));
  }

  entry.decision = decision;
  entry.updatedAt = new Date();

  const hasRejected = order.farmerDecisions.some((item) => item.decision === 'rejected');
  const allAccepted = order.farmerDecisions.every((item) => item.decision === 'accepted');

  if (hasRejected) {
    order.status = 'rejected';
  } else if (allAccepted) {
    order.status = 'accepted';
  }

  await order.save();

  recordAdminOrderAudit(req, {
    action: 'order.update_status',
    orderId: order._id,
    targetLabel: `Order ${order._id}`,
    details: { status: order.status, decision, paymentStatus: order.paymentStatus },
  });

  await createNotification({
    user: order.buyer,
    type: 'order',
    title: 'Order status changed',
    message: `A farmer has ${decision} your order ${order._id}`,
    metadata: { orderId: order._id },
    io: req.io,
  });

  res.status(200).json({
    status: 'success',
    order,
  });
});

const updateOrderStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;
  const allowed = ['paid', 'shipped', 'delivered', 'cancelled'];

  if (!allowed.includes(status)) {
    return next(new AppError(`Status must be one of: ${allowed.join(', ')}`, 400));
  }

  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  order.status = status;

  if (status === 'paid') {
    order.paymentStatus = 'paid';
  }

  await order.save();

  await createNotification({
    user: order.buyer,
    type: 'order',
    title: 'Order update',
    message: `Your order ${order._id} is now ${status}`,
    metadata: { orderId: order._id, status },
    io: req.io,
  });

  res.status(200).json({
    status: 'success',
    order,
  });
});

const updateTracking = catchAsync(async (req, res, next) => {
  const order = await Order.findByIdAndUpdate(
    req.params.id,
    { tracking: req.body },
    { new: true, runValidators: true },
  );

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  recordAdminOrderAudit(req, {
    action: 'order.update_tracking',
    orderId: order._id,
    targetLabel: `Order ${order._id}`,
    details: { tracking: req.body || {} },
  });

  await createNotification({
    user: order.buyer,
    type: 'order',
    title: 'Delivery tracking updated',
    message: `Tracking updated for order ${order._id}`,
    metadata: { orderId: order._id, tracking: order.tracking },
    io: req.io,
  });

  res.status(200).json({
    status: 'success',
    order,
  });
});

const markPaymentBySession = catchAsync(async (req, res, next) => {
  const { sessionId } = req.body;

  if (!sessionId || typeof sessionId !== 'string') {
    return next(new AppError('Stripe sessionId is required', 400));
  }

  const order = await Order.findOne({ stripeSessionId: sessionId });

  if (!order) {
    return next(new AppError('Order not found for this payment session', 404));
  }

  if (String(order.buyer) !== String(req.user._id)) {
    return next(new AppError('Not authorized to confirm this payment', 403));
  }

  const stripe = getStripe();
  if (!stripe) {
    return next(new AppError('Stripe payment confirmation is unavailable', 503));
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (!session || session.payment_status !== 'paid') {
    return next(new AppError('Payment is not completed for this session', 400));
  }

  if (session.metadata?.orderId && String(session.metadata.orderId) !== String(order._id)) {
    return next(new AppError('Payment session does not match this order', 400));
  }

  if (session.metadata?.buyerId && String(session.metadata.buyerId) !== String(req.user._id)) {
    return next(new AppError('Payment session does not belong to this account', 403));
  }

  await markOrderAsPaid({
    order,
    provider: 'stripe',
    reference: session.payment_intent || session.id,
    details: {},
    io: req.io,
  });

  res.status(200).json({
    status: 'success',
    order,
  });
});

const serveEsewaCheckoutPage = catchAsync(async (req, res, next) => {
  const token = String(req.query.token || '').trim();
  const decoded = verifyCheckoutToken(token);

  if (!decoded || decoded.provider !== 'esewa' || !mongoose.isValidObjectId(decoded.orderId)) {
    return next(new AppError('Invalid or expired checkout token', 400));
  }

  const order = await Order.findById(decoded.orderId);
  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  if (order.paymentMethod !== 'esewa') {
    return next(new AppError('Order is not configured for eSewa payment', 400));
  }

  if (order.paymentStatus === 'paid') {
    return redirectToClient(req, res, {
      destination: 'orders',
      query: {
        payment: 'success',
        provider: 'esewa',
        orderId: order._id,
      },
    });
  }

  const { baseUrl, productCode, secretKey } = getEsewaConfig();
  if (!hasValue(productCode) || !hasValue(secretKey)) {
    return next(new AppError('eSewa payment is not configured', 503));
  }

  const transactionUuid =
    order.paymentGateway?.esewa?.transactionUuid || String(decoded.transactionUuid || '').trim();
  const totalAmount = order.paymentGateway?.esewa?.totalAmount || formatMoney(order.totalAmount);
  const signedFieldNames = ESEWA_SIGNED_FIELD_NAMES.join(',');
  const signature = signEsewaSignature({
    payload: {
      total_amount: totalAmount,
      transaction_uuid: transactionUuid,
      product_code: productCode,
    },
    signedFieldNames,
    secretKey,
  });
  const serverUrl = getPrimaryServerUrl(req);
  const formAction = `${baseUrl}/api/epay/main/v2/form`;
  const fields = {
    amount: totalAmount,
    tax_amount: '0',
    total_amount: totalAmount,
    transaction_uuid: transactionUuid,
    product_code: productCode,
    product_service_charge: '0',
    product_delivery_charge: '0',
    success_url: `${serverUrl}/api/v1/orders/payments/esewa/callback/success/${order._id}`,
    failure_url: `${serverUrl}/api/v1/orders/payments/esewa/callback/failure/${order._id}`,
    signed_field_names: signedFieldNames,
    signature,
  };

  const hiddenFields = Object.entries(fields)
    .map(
      ([key, value]) =>
        `<input type="hidden" name="${escapeHtmlValue(key)}" value="${escapeHtmlValue(value)}" />`,
    )
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Redirecting to eSewa...</title>
    <style>
      body { margin: 0; font-family: Arial, sans-serif; background: #f4f8ef; color: #122218; }
      .wrap { min-height: 100vh; display: grid; place-items: center; padding: 1rem; }
      .card { max-width: 28rem; width: 100%; background: #fff; border: 1px solid #cfdfc8; border-radius: 16px; padding: 1.25rem; box-shadow: 0 12px 30px rgba(12, 30, 18, 0.12); text-align: center; }
      h1 { margin: 0 0 .5rem; font-size: 1.1rem; }
      p { margin: 0; color: #5c7063; font-size: .92rem; }
      button { margin-top: 1rem; border: 0; background: #1f8f4f; color: #fff; border-radius: 10px; padding: .6rem .95rem; font-weight: 600; cursor: pointer; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h1>Redirecting to eSewa</h1>
        <p>Please wait while we transfer you to secure payment.</p>
        <form id="esewaCheckoutForm" action="${escapeHtmlValue(formAction)}" method="POST">
          ${hiddenFields}
          <noscript><button type="submit">Continue to eSewa</button></noscript>
        </form>
      </div>
    </div>
    <script>document.getElementById('esewaCheckoutForm').submit();</script>
  </body>
</html>`;

  const cspDirectives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline'",
    `form-action 'self' ${baseUrl}`,
  ].join('; ');

  res.setHeader('Content-Security-Policy', cspDirectives);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
});

const handleEsewaSuccessCallback = async (req, res) => {
  const provider = 'esewa';
  const orderId = String(req.params.orderId || req.query.orderId || '').trim();
  const callbackToken = String(req.query.token || '').trim();
  const payload =
    decodeEsewaDataPayload(req.query.data || req.body?.data) ||
    decodeEsewaDataPayload(req.query.response || req.body?.response);
  const transactionUuid = String(
    payload?.transaction_uuid || req.query.transaction_uuid || req.body?.transaction_uuid || '',
  ).trim();
  const order = await findOrderForEsewa({ orderId, transactionUuid, callbackToken });

  if (!order) {
    return redirectToClient(req, res, {
      destination: 'checkout',
      query: { payment: 'failed', provider, message: 'order_not_found' },
    });
  }

  if (order.paymentMethod !== 'esewa') {
    return redirectToClient(req, res, {
      destination: 'checkout',
      query: { payment: 'failed', provider, orderId: order._id, message: 'method_mismatch' },
    });
  }

  if (order.paymentStatus === 'paid') {
    return redirectToClient(req, res, {
      destination: 'orders',
      query: { payment: 'success', provider, orderId: order._id },
    });
  }

  const { baseUrl, productCode, secretKey } = getEsewaConfig();
  if (!hasValue(productCode) || !hasValue(secretKey)) {
    await markOrderPaymentFailed({
      order,
      provider,
      details: {
        esewa: {
          ...(order.paymentGateway?.esewa || {}),
          status: 'configuration_missing',
        },
      },
    });
    return redirectToClient(req, res, {
      destination: 'checkout',
      query: { payment: 'failed', provider, orderId: order._id, message: 'gateway_unavailable' },
    });
  }

  if (!payload) {
    await markOrderPaymentFailed({
      order,
      provider,
      details: {
        esewa: {
          ...(order.paymentGateway?.esewa || {}),
          status: 'callback_payload_invalid',
        },
      },
    });
    return redirectToClient(req, res, {
      destination: 'checkout',
      query: { payment: 'failed', provider, orderId: order._id, message: 'payload_invalid' },
    });
  }

  const expectedTransactionUuid = order.paymentGateway?.esewa?.transactionUuid || transactionUuid;
  const totalAmount = order.paymentGateway?.esewa?.totalAmount || formatMoney(order.totalAmount);
  const signedFieldNames = String(payload.signed_field_names || ESEWA_SIGNED_FIELD_NAMES.join(','));
  const providedSignature = String(payload.signature || '').replace(/\s/g, '+').trim();
  const expectedSignature = signEsewaSignature({
    payload,
    signedFieldNames,
    secretKey,
  });

  if (
    !compareSignatures(providedSignature, expectedSignature) ||
    String(payload.transaction_uuid || '').trim() !== String(expectedTransactionUuid || '').trim()
  ) {
    await markOrderPaymentFailed({
      order,
      provider,
      details: {
        esewa: {
          ...(order.paymentGateway?.esewa || {}),
          status: 'signature_mismatch',
          rawResponse: { callback: payload },
        },
      },
    });
    return redirectToClient(req, res, {
      destination: 'checkout',
      query: { payment: 'failed', provider, orderId: order._id, message: 'signature_mismatch' },
    });
  }

  let lookupData;
  try {
    const lookupResponse = await axios.get(`${baseUrl}/api/epay/transaction/status/`, {
      params: {
        product_code: productCode,
        total_amount: totalAmount,
        transaction_uuid: expectedTransactionUuid,
      },
      timeout: 12000,
    });
    lookupData = lookupResponse.data || {};
  } catch (_error) {
    await markOrderPaymentFailed({
      order,
      provider,
      details: {
        esewa: {
          ...(order.paymentGateway?.esewa || {}),
          status: 'lookup_failed',
          rawResponse: { callback: payload },
        },
      },
    });
    return redirectToClient(req, res, {
      destination: 'checkout',
      query: { payment: 'failed', provider, orderId: order._id, message: 'lookup_failed' },
    });
  }

  const lookupStatus = normalizeGatewayStatus(lookupData.status || payload.status);
  const lookupTotalAmount = formatMoney(lookupData.total_amount || totalAmount);
  const lookupProductCode = String(lookupData.product_code || productCode).trim();

  if (!['COMPLETE', 'COMPLETED', 'SUCCESS'].includes(lookupStatus)) {
    await markOrderPaymentFailed({
      order,
      provider,
      details: {
        esewa: {
          ...(order.paymentGateway?.esewa || {}),
          status: lookupStatus || 'FAILED',
          rawResponse: { callback: payload, lookup: lookupData },
        },
      },
    });
    return redirectToClient(req, res, {
      destination: 'checkout',
      query: { payment: 'failed', provider, orderId: order._id, message: 'status_not_complete' },
    });
  }

  if (lookupTotalAmount !== totalAmount || lookupProductCode !== productCode) {
    await markOrderPaymentFailed({
      order,
      provider,
      details: {
        esewa: {
          ...(order.paymentGateway?.esewa || {}),
          status: 'verification_mismatch',
          rawResponse: { callback: payload, lookup: lookupData },
        },
      },
    });
    return redirectToClient(req, res, {
      destination: 'checkout',
      query: { payment: 'failed', provider, orderId: order._id, message: 'verification_mismatch' },
    });
  }

  await markOrderAsPaid({
    order,
    provider,
    reference: lookupData.transaction_code || payload.transaction_code,
    details: {
      esewa: {
        ...(order.paymentGateway?.esewa || {}),
        transactionUuid: expectedTransactionUuid,
        productCode,
        totalAmount,
        transactionCode: String(lookupData.transaction_code || payload.transaction_code || '').trim(),
        status: lookupStatus,
        verifiedAt: new Date(),
        rawResponse: { callback: payload, lookup: lookupData },
      },
    },
    io: req.io,
  });

  return redirectToClient(req, res, {
    destination: 'orders',
    query: { payment: 'success', provider, orderId: order._id },
  });
};

const handleEsewaFailureCallback = async (req, res) => {
  const provider = 'esewa';
  const orderId = String(req.params.orderId || req.query.orderId || '').trim();
  const transactionUuid = String(req.query.transaction_uuid || '').trim();
  const callbackToken = String(req.query.token || '').trim();
  const order = await findOrderForEsewa({ orderId, transactionUuid, callbackToken });

  if (order) {
    await markOrderPaymentFailed({
      order,
      provider,
      details: {
        esewa: {
          ...(order.paymentGateway?.esewa || {}),
          status: 'cancelled',
        },
      },
    });
  }

  return redirectToClient(req, res, {
    destination: 'checkout',
    query: {
      payment: 'cancelled',
      provider,
      orderId: order?._id || orderId || undefined,
      message: 'payment_cancelled',
    },
  });
};

const handleKhaltiCallback = async (req, res) => {
  const provider = 'khalti';
  const query = req.query || {};
  const body = req.body || {};
  const orderId = String(query.purchase_order_id || query.orderId || body.purchase_order_id || '').trim();
  const pidx = String(query.pidx || body.pidx || '').trim();
  const order = await findOrderForKhalti({ orderId, pidx });

  if (!order) {
    return redirectToClient(req, res, {
      destination: 'checkout',
      query: { payment: 'failed', provider, message: 'order_not_found' },
    });
  }

  if (order.paymentMethod !== 'khalti') {
    return redirectToClient(req, res, {
      destination: 'checkout',
      query: { payment: 'failed', provider, orderId: order._id, message: 'method_mismatch' },
    });
  }

  if (order.paymentStatus === 'paid') {
    return redirectToClient(req, res, {
      destination: 'orders',
      query: { payment: 'success', provider, orderId: order._id },
    });
  }

  const khalti = getKhaltiConfig();
  const lookupPidx = pidx || String(order.paymentGateway?.khalti?.pidx || '').trim();
  if (!hasValue(khalti.secretKey) || !hasValue(lookupPidx)) {
    await markOrderPaymentFailed({
      order,
      provider,
      details: {
        khalti: {
          ...(order.paymentGateway?.khalti || {}),
          pidx: lookupPidx,
          status: 'configuration_missing',
        },
      },
    });
    return redirectToClient(req, res, {
      destination: 'checkout',
      query: { payment: 'failed', provider, orderId: order._id, message: 'gateway_unavailable' },
    });
  }

  let lookupData;
  try {
    const lookupResponse = await axios.post(
      `${khalti.baseUrl}/api/v2/epayment/lookup/`,
      { pidx: lookupPidx },
      {
        headers: {
          Authorization: `Key ${khalti.secretKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 12000,
      },
    );
    lookupData = lookupResponse.data || {};
  } catch (_error) {
    await markOrderPaymentFailed({
      order,
      provider,
      details: {
        khalti: {
          ...(order.paymentGateway?.khalti || {}),
          pidx: lookupPidx,
          status: 'lookup_failed',
        },
      },
    });
    return redirectToClient(req, res, {
      destination: 'checkout',
      query: { payment: 'failed', provider, orderId: order._id, message: 'lookup_failed' },
    });
  }

  const lookupStatus = normalizeGatewayStatus(lookupData.status || query.status);
  const expectedPaisa = Math.round(normalizeMoney(order.totalAmount) * 100);
  const receivedPaisa = Number(lookupData.total_amount || query.total_amount || expectedPaisa);

  if (!['COMPLETE', 'COMPLETED', 'SUCCESS'].includes(lookupStatus) || receivedPaisa !== expectedPaisa) {
    await markOrderPaymentFailed({
      order,
      provider,
      details: {
        khalti: {
          ...(order.paymentGateway?.khalti || {}),
          pidx: lookupPidx,
          status: lookupStatus || 'FAILED',
          totalAmountPaisa: receivedPaisa,
          rawResponse: { callback: query, lookup: lookupData },
        },
      },
    });
    return redirectToClient(req, res, {
      destination: 'checkout',
      query: { payment: 'failed', provider, orderId: order._id, message: 'verification_failed' },
    });
  }

  await markOrderAsPaid({
    order,
    provider,
    reference: lookupData.transaction_id || query.transaction_id || lookupPidx,
    details: {
      khalti: {
        ...(order.paymentGateway?.khalti || {}),
        pidx: lookupPidx,
        status: lookupStatus,
        transactionId: String(lookupData.transaction_id || query.transaction_id || '').trim(),
        totalAmountPaisa: receivedPaisa,
        verifiedAt: new Date(),
        rawResponse: { callback: query, lookup: lookupData },
      },
    },
    io: req.io,
  });

  return redirectToClient(req, res, {
    destination: 'orders',
    query: { payment: 'success', provider, orderId: order._id },
  });
};

const generateInvoice = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate('buyer', 'name');

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  const isBuyer = String(order.buyer._id || order.buyer) === String(req.user._id);
  const isFarmer = order.items.some((item) => String(item.farmer) === String(req.user._id));
  const isAdmin = req.user.role === 'admin';

  if (!isBuyer && !isFarmer && !isAdmin) {
    return next(new AppError('Not authorized to access this invoice', 403));
  }

  const pdfBuffer = await generateInvoiceBuffer(order);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=invoice-${order._id}.pdf`);
  res.send(pdfBuffer);
});

const getFarmerAnalytics = catchAsync(async (req, res) => {
  const farmerId = new mongoose.Types.ObjectId(req.user._id);

  const deliveredOrders = await Order.find({
    status: { $in: ['paid', 'shipped', 'delivered'] },
    'items.farmer': farmerId,
  });

  let revenue = 0;
  let unitsSold = 0;

  deliveredOrders.forEach((order) => {
    order.items.forEach((item) => {
      if (String(item.farmer) === String(farmerId)) {
        revenue += item.subtotal;
        unitsSold += item.quantity;
      }
    });
  });

  const productStats = await Order.aggregate([
    {
      $match: {
        status: { $in: ['paid', 'shipped', 'delivered'] },
        'items.farmer': farmerId,
      },
    },
    { $unwind: '$items' },
    { $match: { 'items.farmer': farmerId } },
    {
      $group: {
        _id: '$items.productName',
        totalUnits: { $sum: '$items.quantity' },
        totalSales: { $sum: '$items.subtotal' },
      },
    },
    { $sort: { totalSales: -1 } },
    { $limit: 5 },
  ]);

  const monthlySales = await Order.aggregate([
    {
      $match: {
        status: { $in: ['paid', 'shipped', 'delivered'] },
        createdAt: { $gte: dayjs().subtract(6, 'month').toDate() },
        'items.farmer': farmerId,
      },
    },
    { $unwind: '$items' },
    { $match: { 'items.farmer': farmerId } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
        sales: { $sum: '$items.subtotal' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const farmer = await User.findById(req.user._id);

  if (revenue >= Number(process.env.TOP_FARMER_REVENUE_THRESHOLD || 50000)) {
    if (!farmer.badges.includes('top-farmer')) {
      farmer.badges.push('top-farmer');
      await farmer.save();
    }
  }

  res.status(200).json({
    status: 'success',
    analytics: {
      revenue,
      unitsSold,
      ordersCount: deliveredOrders.length,
      walletBalance: farmer.walletBalance,
      topProducts: productStats,
      monthlySales,
      badges: farmer.badges,
    },
  });
});

const listAllOrders = catchAsync(async (_req, res) => {
  const orders = await Order.find()
    .sort({ createdAt: -1 })
    .populate('buyer', 'name email')
    .limit(200);

  res.status(200).json({
    status: 'success',
    count: orders.length,
    orders,
  });
});

const requestOrderReturn = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  if (String(order.buyer) !== String(req.user._id)) {
    return next(new AppError('Not authorized to request a return for this order', 403));
  }

  if (!['paid', 'shipped', 'delivered'].includes(order.status)) {
    return next(new AppError('Returns are available only for paid, shipped, or delivered orders', 400));
  }

  if (!isReturnWindowOpen(order)) {
    return next(new AppError(`Return window has expired (${RETURN_WINDOW_DAYS} days)`, 400));
  }

  const reason = String(req.body.reason || '').trim();
  const description = String(req.body.description || '').trim();

  if (!reason) {
    return next(new AppError('Return reason is required', 400));
  }

  const currentStatus = order.returnRequest?.status || 'none';
  if (!['none', 'rejected', 'closed'].includes(currentStatus)) {
    return next(new AppError('A return request is already in progress for this order', 400));
  }

  order.returnRequest = {
    status: 'requested',
    requestedAt: new Date(),
    reason: reason.slice(0, 120),
    description: description.slice(0, 500),
    pickupAddress: {
      fullName: req.body?.pickupAddress?.fullName || order.shippingAddress?.fullName,
      phone: req.body?.pickupAddress?.phone || order.shippingAddress?.phone,
      district: req.body?.pickupAddress?.district || order.shippingAddress?.district,
      province: req.body?.pickupAddress?.province || order.shippingAddress?.province,
      country: req.body?.pickupAddress?.country || order.shippingAddress?.country || 'Nepal',
      addressLine: req.body?.pickupAddress?.addressLine || order.shippingAddress?.addressLine,
    },
    updatedAt: new Date(),
  };

  await order.save();

  const admins = await User.find({ role: 'admin', isActive: true, blocked: false }).select('_id');
  await Promise.all(
    admins.map((admin) =>
      createNotification({
        user: admin._id,
        type: 'order',
        title: 'New return request',
        message: `Order ${order._id} has a return request from buyer.`,
        metadata: { orderId: order._id, returnStatus: order.returnRequest.status },
        io: req.io,
      }),
    ),
  );

  res.status(200).json({
    status: 'success',
    order,
  });
});

const listAdminReturnsQueue = catchAsync(async (req, res, next) => {
  const status = String(req.query.status || 'all')
    .trim()
    .toLowerCase();
  const allowedStatuses = ['all', 'requested', 'approved', 'pickup_scheduled', 'received', 'refunded', 'rejected', 'closed'];

  if (!allowedStatuses.includes(status)) {
    return next(new AppError(`status must be one of: ${allowedStatuses.join(', ')}`, 400));
  }

  const filter =
    status === 'all'
      ? { 'returnRequest.status': { $ne: 'none' } }
      : { 'returnRequest.status': status };

  const orders = await Order.find(filter)
    .sort({ 'returnRequest.updatedAt': -1, createdAt: -1 })
    .populate('buyer', 'name email')
    .limit(250);

  res.status(200).json({
    status: 'success',
    count: orders.length,
    orders,
  });
});

const processReturnAutomation = catchAsync(async (req, res, next) => {
  const { action, notes, logisticsPartner, refundAmount } = req.body || {};
  const normalizedAction = String(action || '').trim().toLowerCase();
  const transitions = {
    approve: { from: ['requested'], to: 'approved' },
    reject: { from: ['requested', 'approved', 'pickup_scheduled'], to: 'rejected' },
    'schedule-pickup': { from: ['approved'], to: 'pickup_scheduled' },
    'mark-received': { from: ['pickup_scheduled'], to: 'received' },
    'issue-refund': { from: ['received', 'approved'], to: 'refunded' },
    close: { from: ['refunded', 'rejected'], to: 'closed' },
  };

  if (!transitions[normalizedAction]) {
    return next(new AppError(`Invalid return action: ${normalizedAction}`, 400));
  }

  const order = await Order.findById(req.params.id);
  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  const currentStatus = order.returnRequest?.status || 'none';
  const transition = transitions[normalizedAction];

  if (!transition.from.includes(currentStatus)) {
    return next(
      new AppError(
        `Cannot run action "${normalizedAction}" from return status "${currentStatus}"`,
        400,
      ),
    );
  }

  order.returnRequest = order.returnRequest || { status: 'none' };
  order.returnRequest.status = transition.to;
  order.returnRequest.updatedAt = new Date();
  order.returnRequest.processedBy = req.user._id;
  order.returnRequest.resolution = String(notes || '').trim().slice(0, 300) || order.returnRequest.resolution;

  if (normalizedAction === 'schedule-pickup') {
    const start = dayjs().add(1, 'day').toDate();
    const end = dayjs(start).add(1, 'day').toDate();
    order.returnRequest.pickupWindowStart = req.body?.pickupWindowStart || start;
    order.returnRequest.pickupWindowEnd = req.body?.pickupWindowEnd || end;
    order.returnRequest.logisticsPartner = String(logisticsPartner || 'ReverseHub').trim();
    order.returnRequest.trackingId = order.returnRequest.trackingId || generateTrackingId();
  }

  if (normalizedAction === 'issue-refund') {
    const safeRefund = Number.isFinite(Number(refundAmount))
      ? Math.max(0, Number(refundAmount))
      : Number(order.totalAmount || 0);
    order.returnRequest.refundAmount = Number(safeRefund.toFixed(2));
    order.paymentStatus = 'refunded';
    order.status = 'cancelled';
  }

  await order.save();

  recordAdminOrderAudit(req, {
    action: 'order.return_process',
    orderId: order._id,
    targetLabel: `Order ${order._id}`,
    details: {
      action: normalizedAction,
      from: currentStatus,
      to: transition.to,
      logisticsPartner: order.returnRequest.logisticsPartner || null,
      refundAmount: order.returnRequest.refundAmount || null,
    },
  });

  await createNotification({
    user: order.buyer,
    type: 'order',
    title: 'Return request updated',
    message: `Your return request for order ${order._id} is now ${transition.to}.`,
    metadata: {
      orderId: order._id,
      returnStatus: transition.to,
      action: normalizedAction,
      refundAmount: order.returnRequest.refundAmount || null,
    },
    io: req.io,
  });

  res.status(200).json({
    status: 'success',
    order,
  });
});

module.exports = {
  createOrder,
  serveEsewaCheckoutPage,
  handleEsewaSuccessCallback,
  handleEsewaFailureCallback,
  handleKhaltiCallback,
  getCheckoutOptimization,
  getMyOrders,
  getOrderById,
  getFarmerOrders,
  setFarmerDecision,
  updateOrderStatus,
  updateTracking,
  markPaymentBySession,
  generateInvoice,
  getFarmerAnalytics,
  listAllOrders,
  requestOrderReturn,
  listAdminReturnsQueue,
  processReturnAutomation,
};

