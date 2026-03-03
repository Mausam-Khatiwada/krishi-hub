const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    productName: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const farmerDecisionSchema = new mongoose.Schema(
  {
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    decision: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
      index: true,
    },
    updatedAt: Date,
  },
  { _id: false },
);

const returnRequestSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: [
        'none',
        'requested',
        'approved',
        'pickup_scheduled',
        'received',
        'refunded',
        'rejected',
        'closed',
      ],
      default: 'none',
      index: true,
    },
    requestedAt: Date,
    reason: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    pickupAddress: {
      fullName: String,
      phone: String,
      district: String,
      province: String,
      country: { type: String, default: 'Nepal' },
      addressLine: String,
    },
    pickupWindowStart: Date,
    pickupWindowEnd: Date,
    logisticsPartner: String,
    trackingId: String,
    refundAmount: {
      type: Number,
      min: 0,
    },
    resolution: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedAt: Date,
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    items: [orderItemSchema],
    shippingAddress: {
      fullName: String,
      phone: String,
      district: String,
      province: String,
      country: { type: String, default: 'Nepal' },
      addressLine: String,
    },
    status: {
      type: String,
      enum: ['placed', 'accepted', 'rejected', 'paid', 'shipped', 'delivered', 'cancelled'],
      default: 'placed',
      index: true,
    },
    farmerDecisions: [farmerDecisionSchema],
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid', 'failed', 'refunded'],
      default: 'unpaid',
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['stripe', 'cod', 'esewa', 'khalti', 'mobile_banking'],
      default: 'stripe',
    },
    paymentReference: {
      type: String,
      trim: true,
    },
    stripeSessionId: String,
    paymentGateway: {
      provider: {
        type: String,
        trim: true,
        lowercase: true,
      },
      lastVerifiedAt: Date,
      esewa: {
        transactionUuid: { type: String, trim: true },
        productCode: { type: String, trim: true },
        totalAmount: { type: String, trim: true },
        transactionCode: { type: String, trim: true },
        status: { type: String, trim: true },
        verifiedAt: Date,
        rawResponse: mongoose.Schema.Types.Mixed,
      },
      khalti: {
        pidx: { type: String, trim: true },
        status: { type: String, trim: true },
        transactionId: { type: String, trim: true },
        totalAmountPaisa: Number,
        verifiedAt: Date,
        rawResponse: mongoose.Schema.Types.Mixed,
      },
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
    },
    tracking: {
      partnerName: String,
      trackingId: String,
      status: String,
      lastLocation: String,
      estimatedDelivery: Date,
      dispatchZone: String,
      routeEngineVersion: String,
      routeScore: Number,
      etaConfidence: Number,
      routeReason: String,
    },
    returnRequest: returnRequestSchema,
  },
  { timestamps: true },
);

orderSchema.index({ buyer: 1, createdAt: -1 });
orderSchema.index({ 'items.farmer': 1, createdAt: -1 });
orderSchema.index({ 'paymentGateway.esewa.transactionUuid': 1 }, { sparse: true });
orderSchema.index({ 'paymentGateway.khalti.pidx': 1 }, { sparse: true });

module.exports = mongoose.model('Order', orderSchema);
