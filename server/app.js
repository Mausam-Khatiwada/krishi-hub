const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const orderRoutes = require('./routes/orderRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const adminRoutes = require('./routes/adminRoutes');
const chatRoutes = require('./routes/chatRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const couponRoutes = require('./routes/couponRoutes');
const forumRoutes = require('./routes/forumRoutes');
const weatherRoutes = require('./routes/weatherRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

const notFound = require('./middleware/notFoundMiddleware');
const globalErrorHandler = require('./middleware/errorMiddleware');
const sanitizeRequest = require('./middleware/sanitizeMiddleware');

const app = express();
const normalizeOrigin = (value = '') => String(value).trim().replace(/\/+$/, '');
const allowedOrigins = String(process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);
const isOriginAllowed = (origin) => !origin || allowedOrigins.includes(normalizeOrigin(origin));

app.disable('x-powered-by');

app.get('/', (req, res) => {
  res.json({ status: 'success', message: 'API is running!' });
});
app.set('trust proxy', 1);

app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX || 300),
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests. Please try again later.',
  }),
);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 80),
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many authentication requests. Please try again later.',
});

app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(hpp());
app.use(sanitizeRequest);

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'krishihub-api' });
});

app.use((req, _res, next) => {
  req.io = app.get('io');
  next();
});

app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/google', authLimiter);
app.use('/api/v1/auth/register/request-otp', authLimiter);
app.use('/api/v1/auth/register/verify', authLimiter);
app.use('/api/v1/auth/register/resend-otp', authLimiter);

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/chats', chatRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/coupons', couponRoutes);
app.use('/api/v1/forum', forumRoutes);
app.use('/api/v1/weather', weatherRoutes);
app.use('/api/v1/analytics', analyticsRoutes);

app.use(notFound);
app.use(globalErrorHandler);

module.exports = app;
