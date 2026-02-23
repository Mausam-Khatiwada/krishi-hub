const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema(
  {
    url: String,
    publicId: String,
    mimeType: String,
  },
  { _id: false },
);

const productSchema = new mongoose.Schema(
  {
    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: 150,
      index: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: 1000,
    },
    pricePerUnit: {
      type: Number,
      required: [true, 'Price is required'],
      min: 0,
      index: true,
    },
    quantityAvailable: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: 0,
      index: true,
    },
    harvestDate: Date,
    organic: {
      type: Boolean,
      default: false,
      index: true,
    },
    location: {
      district: String,
      province: String,
      country: { type: String, default: 'Nepal' },
      lat: Number,
      lng: Number,
    },
    images: [mediaSchema],
    videos: [mediaSchema],
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    popularity: {
      type: Number,
      default: 0,
      index: true,
    },
    ratingAverage: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    ratingCount: {
      type: Number,
      default: 0,
    },
    tags: [{ type: String, trim: true }],
  },
  { timestamps: true },
);

productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1, pricePerUnit: 1, organic: 1, createdAt: -1 });

module.exports = mongoose.model('Product', productSchema);
