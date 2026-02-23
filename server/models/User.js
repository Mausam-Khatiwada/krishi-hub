const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const locationSchema = new mongoose.Schema(
  {
    district: { type: String, trim: true },
    province: { type: String, trim: true },
    country: { type: String, default: 'Nepal', trim: true },
    lat: Number,
    lng: Number,
  },
  { _id: false },
);

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, maxlength: 40 },
    fullName: { type: String, trim: true, maxlength: 100 },
    phone: { type: String, trim: true, maxlength: 30 },
    district: { type: String, trim: true, maxlength: 80 },
    province: { type: String, trim: true, maxlength: 80 },
    country: { type: String, default: 'Nepal', trim: true, maxlength: 80 },
    addressLine: { type: String, trim: true, maxlength: 220 },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true },
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ['farmer', 'buyer', 'admin'],
      default: 'buyer',
      index: true,
    },
    avatar: String,
    phone: String,
    bio: String,
    location: locationSchema,
    blocked: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isFarmerVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    walletBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    subscribedFarmers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    badges: [{ type: String }],
    preferences: {
      language: { type: String, enum: ['en', 'ne'], default: 'en' },
      theme: { type: String, enum: ['light', 'dark'], default: 'light' },
      notifications: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: false },
        orderUpdates: { type: Boolean, default: true },
        chatMessages: { type: Boolean, default: true },
        marketing: { type: Boolean, default: false },
      },
    },
    security: {
      twoFactorEnabled: { type: Boolean, default: false },
      loginAlerts: { type: Boolean, default: true },
    },
    addresses: [addressSchema],
    farmerProfile: {
      farmName: { type: String, trim: true, maxlength: 120 },
      farmType: { type: String, trim: true, maxlength: 80 },
      farmSizeAcres: { type: Number, min: 0 },
      primaryCrops: [{ type: String, trim: true, maxlength: 80 }],
      certifications: [{ type: String, trim: true, maxlength: 80 }],
      experienceYears: { type: Number, min: 0 },
      pickupInstructions: { type: String, trim: true, maxlength: 250 },
      website: { type: String, trim: true, maxlength: 180 },
    },
    buyerProfile: {
      preferredPaymentMethod: {
        type: String,
        enum: ['stripe', 'cod', 'wallet', 'esewa', 'khalti'],
        default: 'stripe',
      },
      deliveryInstructions: { type: String, trim: true, maxlength: 250 },
      weeklyBudget: { type: Number, min: 0 },
    },
    adminProfile: {
      dashboardDensity: {
        type: String,
        enum: ['comfortable', 'compact'],
        default: 'comfortable',
      },
      criticalAlertsOnly: { type: Boolean, default: false },
      reportDigestEmail: { type: String, trim: true, maxlength: 120 },
    },
    lastLoginAt: Date,
    accountActivity: {
      lastPasswordChangedAt: Date,
      lastEmailChangedAt: Date,
      deactivatedAt: Date,
    },
  },
  { timestamps: true },
);

userSchema.index({ role: 1, isFarmerVerified: 1 });

userSchema.pre('save', async function encryptPassword() {
  if (!this.isModified('password')) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 12);
  this.accountActivity = this.accountActivity || {};
  this.accountActivity.lastPasswordChangedAt = new Date();
});

userSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
