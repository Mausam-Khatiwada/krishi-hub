const jwt = require('jsonwebtoken');
const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

const getTokenFromHeaders = (req) => {
  if (req.headers.authorization?.startsWith('Bearer ')) {
    return req.headers.authorization.split(' ')[1];
  }

  return req.cookies?.token;
};

const protect = catchAsync(async (req, _res, next) => {
  const token = getTokenFromHeaders(req);

  if (!token) {
    return next(new AppError('You are not logged in', 401));
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  const currentUser = await User.findById(decoded.id).select('-password');

  if (!currentUser) {
    return next(new AppError('User no longer exists', 401));
  }

  if (!currentUser.isActive) {
    return next(new AppError('This account is deactivated. Contact support to reactivate.', 403));
  }

  if (currentUser.blocked) {
    return next(new AppError('Your account is blocked', 403));
  }

  req.user = currentUser;
  next();
});

module.exports = {
  protect,
};
