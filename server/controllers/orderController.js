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

const getUniqueFarmerIds = (items) => {
  const set = new Set(items.map((item) => String(item.farmer)));
  return [...set];
};

const calculateDiscount = (coupon, total) => {
  if (!coupon) return 0;

  if (coupon.discountType === 'percent') {
    return Number(((total * coupon.value) / 100).toFixed(2));
  }

  return Math.min(coupon.value, total);
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

  const order = await Order.create({
    buyer: req.user._id,
    items: orderItems,
    shippingAddress,
    farmerDecisions,
    paymentMethod,
    totalAmount,
    discountAmount,
    coupon: coupon?._id,
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

  if (paymentMethod === 'stripe') {
    const stripe = getStripe();

    if (stripe) {
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
        success_url: `${process.env.CLIENT_URL}/orders?payment=success&orderId=${order._id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_URL}/checkout?payment=cancelled`,
      });

      order.stripeSessionId = session.id;
      await order.save();
      checkoutUrl = session.url;
    }
  }

  res.status(201).json({
    status: 'success',
    order,
    checkoutUrl,
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
    details: { status, paymentStatus: order.paymentStatus },
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

  const order = await Order.findOne({ stripeSessionId: sessionId });

  if (!order) {
    return next(new AppError('Order not found for this payment session', 404));
  }

  order.paymentStatus = 'paid';
  order.status = 'paid';
  await order.save();

  await createNotification({
    user: order.buyer,
    type: 'order',
    title: 'Payment successful',
    message: `Payment received for order ${order._id}`,
    metadata: { orderId: order._id },
    io: req.io,
  });

  res.status(200).json({
    status: 'success',
    order,
  });
});

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

module.exports = {
  createOrder,
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
};

