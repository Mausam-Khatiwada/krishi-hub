const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Category = require('../models/Category');
const User = require('../models/User');

dotenv.config();

const seed = async () => {
  await connectDB();

  const categories = [
    { name: 'Vegetables', description: 'Fresh seasonal vegetables' },
    { name: 'Fruits', description: 'Locally grown fruits' },
    { name: 'Grains', description: 'Rice, maize, millet and more' },
    { name: 'Dairy', description: 'Milk and dairy products' },
    { name: 'Spices', description: 'Herbs and spices' },
  ];

  await Category.deleteMany({});
  await Category.insertMany(categories);

  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const exists = await User.findOne({ email: process.env.ADMIN_EMAIL });

    if (!exists) {
      await User.create({
        name: 'Krishihub Admin',
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
        role: 'admin',
      });
      console.log('Admin user seeded');
    }
  }

  console.log('Seed completed');
  await mongoose.connection.close();
};

seed().catch(async (err) => {
  console.error(err);
  await mongoose.connection.close();
  process.exit(1);
});
