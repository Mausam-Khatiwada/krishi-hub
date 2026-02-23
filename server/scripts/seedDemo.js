const dotenv = require('dotenv');
const mongoose = require('mongoose');

const connectDB = require('../config/db');
const Category = require('../models/Category');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Coupon = require('../models/Coupon');
const ForumPost = require('../models/ForumPost');
const Chat = require('../models/Chat');
const Notification = require('../models/Notification');

dotenv.config();

const DEMO_PASSWORD = 'demo12345';

const categorySeed = [
  { name: 'Vegetables', description: 'Fresh seasonal vegetables' },
  { name: 'Fruits', description: 'Locally grown fruits' },
  { name: 'Grains', description: 'Rice, maize, millet and more' },
  { name: 'Dairy', description: 'Milk and dairy products' },
  { name: 'Spices', description: 'Herbs and spices' },
];

const farmerSeed = [
  {
    name: 'Hari Gurung',
    email: 'hari@demo.krishihub.com',
    role: 'farmer',
    isFarmerVerified: true,
    location: { district: 'Kaski', province: 'Gandaki', country: 'Nepal' },
    badges: ['new-farmer', 'top-farmer'],
    walletBalance: 18000,
  },
  {
    name: 'Sita Karki',
    email: 'sita@demo.krishihub.com',
    role: 'farmer',
    isFarmerVerified: true,
    location: { district: 'Chitwan', province: 'Bagmati', country: 'Nepal' },
    badges: ['new-farmer'],
    walletBalance: 12400,
  },
  {
    name: 'Binod Thapa',
    email: 'binod@demo.krishihub.com',
    role: 'farmer',
    isFarmerVerified: false,
    location: { district: 'Jhapa', province: 'Koshi', country: 'Nepal' },
    badges: ['new-farmer'],
    walletBalance: 6400,
  },
];

const buyerSeed = [
  {
    name: 'Maya Sharma',
    email: 'maya@demo.krishihub.com',
    role: 'buyer',
    location: { district: 'Kathmandu', province: 'Bagmati', country: 'Nepal' },
  },
  {
    name: 'Raj Bhandari',
    email: 'raj@demo.krishihub.com',
    role: 'buyer',
    location: { district: 'Lalitpur', province: 'Bagmati', country: 'Nepal' },
  },
];

const productSeed = [
  {
    name: 'Organic Cauliflower',
    category: 'Vegetables',
    description: 'Fresh morning-harvested organic cauliflower from Kaski hills.',
    pricePerUnit: 120,
    quantityAvailable: 180,
    harvestDateOffsetDays: 1,
    organic: true,
    district: 'Kaski',
    province: 'Gandaki',
    farmerEmail: 'hari@demo.krishihub.com',
    image:
      'https://images.unsplash.com/photo-1613743990305-45f2488e5f4f?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: 'Farm Fresh Tomato',
    category: 'Vegetables',
    description: 'Juicy red tomatoes ideal for salad and cooking.',
    pricePerUnit: 95,
    quantityAvailable: 260,
    harvestDateOffsetDays: 2,
    organic: false,
    district: 'Chitwan',
    province: 'Bagmati',
    farmerEmail: 'sita@demo.krishihub.com',
    image:
      'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: 'Highland Potato',
    category: 'Vegetables',
    description: 'Starch-rich local potato grown in fertile upland fields.',
    pricePerUnit: 70,
    quantityAvailable: 500,
    harvestDateOffsetDays: 3,
    organic: false,
    district: 'Jhapa',
    province: 'Koshi',
    farmerEmail: 'binod@demo.krishihub.com',
    image:
      'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: 'Mountain Mandarin',
    category: 'Fruits',
    description: 'Sweet and aromatic mandarin sourced from mountain orchards.',
    pricePerUnit: 180,
    quantityAvailable: 210,
    harvestDateOffsetDays: 1,
    organic: true,
    district: 'Kaski',
    province: 'Gandaki',
    farmerEmail: 'hari@demo.krishihub.com',
    image:
      'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: 'Chitwan Banana',
    category: 'Fruits',
    description: 'Naturally ripened banana bunches from Chitwan farms.',
    pricePerUnit: 140,
    quantityAvailable: 300,
    harvestDateOffsetDays: 2,
    organic: false,
    district: 'Chitwan',
    province: 'Bagmati',
    farmerEmail: 'sita@demo.krishihub.com',
    image:
      'https://images.unsplash.com/photo-1603833665858-e61d17a86224?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: 'Premium Basmati Rice',
    category: 'Grains',
    description: 'Aromatic long grain basmati rice, cleaned and packed.',
    pricePerUnit: 220,
    quantityAvailable: 420,
    harvestDateOffsetDays: 8,
    organic: false,
    district: 'Jhapa',
    province: 'Koshi',
    farmerEmail: 'binod@demo.krishihub.com',
    image:
      'https://images.unsplash.com/photo-1586201375761-83865001e31b?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: 'Organic Millet',
    category: 'Grains',
    description: 'Stone-ground millet suitable for healthy traditional meals.',
    pricePerUnit: 165,
    quantityAvailable: 240,
    harvestDateOffsetDays: 7,
    organic: true,
    district: 'Kaski',
    province: 'Gandaki',
    farmerEmail: 'hari@demo.krishihub.com',
    image:
      'https://images.unsplash.com/photo-1471193945509-9ad0617afabf?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: 'Buffalo Milk',
    category: 'Dairy',
    description: 'Fresh buffalo milk delivered chilled from nearby dairy farms.',
    pricePerUnit: 95,
    quantityAvailable: 120,
    harvestDateOffsetDays: 0,
    organic: false,
    district: 'Chitwan',
    province: 'Bagmati',
    farmerEmail: 'sita@demo.krishihub.com',
    image:
      'https://images.unsplash.com/photo-1559598467-f8b76c8155d0?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: 'Farm Paneer',
    category: 'Dairy',
    description: 'Soft handmade paneer for curries and snacks.',
    pricePerUnit: 320,
    quantityAvailable: 90,
    harvestDateOffsetDays: 0,
    organic: false,
    district: 'Kaski',
    province: 'Gandaki',
    farmerEmail: 'hari@demo.krishihub.com',
    image:
      'https://images.unsplash.com/photo-1618164436241-4473940d1f5c?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: 'Turmeric Powder',
    category: 'Spices',
    description: 'Sun-dried pure turmeric powder with high curcumin content.',
    pricePerUnit: 250,
    quantityAvailable: 150,
    harvestDateOffsetDays: 14,
    organic: true,
    district: 'Jhapa',
    province: 'Koshi',
    farmerEmail: 'binod@demo.krishihub.com',
    image:
      'https://images.unsplash.com/photo-1615485291234-9fbc38cdd9c7?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: 'Green Chili',
    category: 'Spices',
    description: 'Fresh green chili with medium heat for daily cooking.',
    pricePerUnit: 130,
    quantityAvailable: 170,
    harvestDateOffsetDays: 1,
    organic: false,
    district: 'Chitwan',
    province: 'Bagmati',
    farmerEmail: 'sita@demo.krishihub.com',
    image:
      'https://images.unsplash.com/photo-1528825871115-3581a5387919?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: 'Seasonal Pumpkin',
    category: 'Vegetables',
    description: 'Large seasonal pumpkin with rich flavor and nutrients.',
    pricePerUnit: 85,
    quantityAvailable: 210,
    harvestDateOffsetDays: 4,
    organic: true,
    district: 'Kaski',
    province: 'Gandaki',
    farmerEmail: 'hari@demo.krishihub.com',
    image:
      'https://images.unsplash.com/photo-1504977401541-0b4a4b2d74df?auto=format&fit=crop&w=1200&q=80',
  },
];

const upsertUser = async (payload) => {
  let user = await User.findOne({ email: payload.email });

  if (!user) {
    user = await User.create({ ...payload, password: DEMO_PASSWORD });
    return user;
  }

  user.name = payload.name;
  user.role = payload.role;
  user.location = payload.location;
  user.isFarmerVerified = Boolean(payload.isFarmerVerified);
  user.walletBalance = payload.walletBalance || 0;
  user.badges = payload.badges || [];
  user.blocked = false;
  user.password = DEMO_PASSWORD;

  await user.save();
  return user;
};

const recalcRatings = async (productIds) => {
  for (const productId of productIds) {
    const stats = await Review.aggregate([
      { $match: { product: productId } },
      {
        $group: {
          _id: '$product',
          avgRating: { $avg: '$rating' },
          count: { $sum: 1 },
        },
      },
    ]);

    const data = stats[0]
      ? {
          ratingAverage: Number(stats[0].avgRating.toFixed(2)),
          ratingCount: stats[0].count,
        }
      : {
          ratingAverage: 0,
          ratingCount: 0,
        };

    await Product.findByIdAndUpdate(productId, data);
  }
};

const seedDemo = async () => {
  await connectDB();

  const categoryMap = new Map();

  for (const item of categorySeed) {
    const category = await Category.findOneAndUpdate(
      { name: item.name },
      { $set: item },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    categoryMap.set(item.name, category._id);
  }

  const farmers = {};
  for (const farmer of farmerSeed) {
    const user = await upsertUser(farmer);
    farmers[farmer.email] = user;
  }

  const buyers = {};
  for (const buyer of buyerSeed) {
    const user = await upsertUser({ ...buyer, badges: [], walletBalance: 0, isFarmerVerified: false });
    buyers[buyer.email] = user;
  }

  const oldProducts = await Product.find({ tags: 'demo-seed' }).select('_id');
  const oldProductIds = oldProducts.map((item) => item._id);

  if (oldProductIds.length) {
    await Review.deleteMany({ product: { $in: oldProductIds } });
    await Order.deleteMany({ 'items.product': { $in: oldProductIds } });
    await Product.deleteMany({ _id: { $in: oldProductIds } });
  }

  await ForumPost.deleteMany({ tags: 'demo-seed' });

  const createdProducts = await Product.insertMany(
    productSeed.map((item) => ({
      farmer: farmers[item.farmerEmail]._id,
      name: item.name,
      category: categoryMap.get(item.category),
      description: item.description,
      pricePerUnit: item.pricePerUnit,
      quantityAvailable: item.quantityAvailable,
      harvestDate: new Date(Date.now() - item.harvestDateOffsetDays * 24 * 60 * 60 * 1000),
      organic: item.organic,
      location: {
        district: item.district,
        province: item.province,
        country: 'Nepal',
      },
      images: [
        {
          url: item.image,
          publicId: `demo-${item.name.toLowerCase().replace(/\s+/g, '-')}`,
          mimeType: 'image/jpeg',
        },
      ],
      videos: [
        {
          url: 'https://samplelib.com/lib/preview/mp4/sample-5s.mp4',
          publicId: `demo-video-${item.name.toLowerCase().replace(/\s+/g, '-')}`,
          mimeType: 'video/mp4',
        },
      ],
      status: 'approved',
      popularity: Math.floor(Math.random() * 50) + 5,
      tags: ['demo-seed', item.category.toLowerCase(), item.organic ? 'organic' : 'non-organic'],
    })),
  );

  const maya = buyers['maya@demo.krishihub.com'];
  const raj = buyers['raj@demo.krishihub.com'];

  const deliveredItems = createdProducts.slice(0, 3).map((product, idx) => {
    const quantity = idx + 1;
    return {
      product: product._id,
      farmer: product.farmer,
      productName: product.name,
      quantity,
      unitPrice: product.pricePerUnit,
      subtotal: quantity * product.pricePerUnit,
    };
  });

  const deliveredTotal = deliveredItems.reduce((sum, item) => sum + item.subtotal, 0);

  const deliveredOrder = await Order.create({
    buyer: maya._id,
    items: deliveredItems,
    shippingAddress: {
      fullName: 'Maya Sharma',
      phone: '9800000011',
      district: 'Kathmandu',
      province: 'Bagmati',
      country: 'Nepal',
      addressLine: 'Demo Seed Delivery Address',
    },
    status: 'delivered',
    paymentStatus: 'paid',
    paymentMethod: 'stripe',
    totalAmount: deliveredTotal,
    discountAmount: 0,
    farmerDecisions: [
      ...new Set(deliveredItems.map((item) => String(item.farmer))),
    ].map((farmer) => ({ farmer, decision: 'accepted', updatedAt: new Date() })),
  });

  const placedItems = createdProducts.slice(3, 6).map((product, idx) => {
    const quantity = idx + 1;
    return {
      product: product._id,
      farmer: product.farmer,
      productName: product.name,
      quantity,
      unitPrice: product.pricePerUnit,
      subtotal: quantity * product.pricePerUnit,
    };
  });

  const placedTotal = placedItems.reduce((sum, item) => sum + item.subtotal, 0);

  await Order.create({
    buyer: raj._id,
    items: placedItems,
    shippingAddress: {
      fullName: 'Raj Bhandari',
      phone: '9800000022',
      district: 'Lalitpur',
      province: 'Bagmati',
      country: 'Nepal',
      addressLine: 'Demo Seed Pending Address',
    },
    status: 'placed',
    paymentStatus: 'unpaid',
    paymentMethod: 'stripe',
    totalAmount: placedTotal,
    discountAmount: 0,
    farmerDecisions: [
      ...new Set(placedItems.map((item) => String(item.farmer))),
    ].map((farmer) => ({ farmer, decision: 'pending' })),
  });

  await Review.insertMany([
    {
      buyer: maya._id,
      product: deliveredItems[0].product,
      order: deliveredOrder._id,
      rating: 5,
      comment: '[Demo Seed] Exceptional freshness and quality.',
    },
    {
      buyer: maya._id,
      product: deliveredItems[1].product,
      order: deliveredOrder._id,
      rating: 4,
      comment: '[Demo Seed] Good quality and packed well.',
    },
  ]);

  await recalcRatings([deliveredItems[0].product, deliveredItems[1].product]);

  await Coupon.findOneAndUpdate(
    { code: 'DEMO10' },
    {
      code: 'DEMO10',
      discountType: 'percent',
      value: 10,
      minOrderAmount: 500,
      expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      isActive: true,
      usageLimit: 100,
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );

  await ForumPost.insertMany([
    {
      user: farmers['hari@demo.krishihub.com']._id,
      title: 'Best irrigation practice before tomato harvest',
      content: 'What schedule has worked best for controlling soil moisture before harvest?',
      tags: ['demo-seed', 'irrigation', 'tomato'],
      comments: [
        {
          user: buyers['maya@demo.krishihub.com']._id,
          text: 'Drip irrigation worked great for our community farm.',
        },
      ],
      likes: [buyers['raj@demo.krishihub.com']._id],
    },
    {
      user: buyers['maya@demo.krishihub.com']._id,
      title: 'Looking for weekly organic vegetable supplier',
      content: 'Need a reliable farmer for bulk organic vegetables every week in Kathmandu.',
      tags: ['demo-seed', 'organic', 'bulk-order'],
      comments: [
        {
          user: farmers['sita@demo.krishihub.com']._id,
          text: 'We can supply every Monday and Thursday.',
        },
      ],
      likes: [farmers['hari@demo.krishihub.com']._id],
    },
  ]);

  await Chat.deleteMany({
    participants: {
      $all: [buyers['maya@demo.krishihub.com']._id, farmers['hari@demo.krishihub.com']._id],
    },
  });
  await Notification.deleteMany({ 'metadata.demoSeed': true });

  await Chat.create({
    participants: [buyers['maya@demo.krishihub.com']._id, farmers['hari@demo.krishihub.com']._id],
    messages: [
      {
        sender: buyers['maya@demo.krishihub.com']._id,
        text: 'Namaste! Can you reserve 20kg organic cauliflower for tomorrow?',
        readBy: [buyers['maya@demo.krishihub.com']._id],
        createdAt: new Date(),
      },
      {
        sender: farmers['hari@demo.krishihub.com']._id,
        text: 'Yes, I can arrange it. Pickup after 8 AM works best.',
        readBy: [farmers['hari@demo.krishihub.com']._id],
        createdAt: new Date(),
      },
    ],
  });

  await Notification.insertMany([
    {
      user: buyers['maya@demo.krishihub.com']._id,
      type: 'announcement',
      title: 'Welcome to Krishihub demo',
      message: 'Try checkout with coupon DEMO10 for discount simulation.',
      metadata: { demoSeed: true },
      isRead: false,
    },
    {
      user: farmers['hari@demo.krishihub.com']._id,
      type: 'order',
      title: 'New demo order created',
      message: 'You have a sample pending order from Raj Bhandari.',
      metadata: { demoSeed: true },
      isRead: false,
    },
  ]);

  console.log('Demo seed completed successfully.');
  console.log('Demo login credentials:');
  console.log('Farmers: hari@demo.krishihub.com, sita@demo.krishihub.com, binod@demo.krishihub.com');
  console.log('Buyers: maya@demo.krishihub.com, raj@demo.krishihub.com');
  console.log(`Password for all demo users: ${DEMO_PASSWORD}`);
  console.log(`Inserted ${createdProducts.length} approved demo products.`);
};

seedDemo()
  .then(async () => {
    await mongoose.connection.close();
  })
  .catch(async (error) => {
    console.error('Demo seed failed:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  });
