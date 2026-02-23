const Coupon = require('../models/Coupon');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

const listCoupons = catchAsync(async (_req, res) => {
  const coupons = await Coupon.find().sort({ createdAt: -1 });

  res.status(200).json({
    status: 'success',
    coupons,
  });
});

const createCoupon = catchAsync(async (req, res) => {
  const payload = {
    ...req.body,
    code: req.body.code?.toUpperCase(),
  };

  const coupon = await Coupon.create(payload);

  res.status(201).json({
    status: 'success',
    coupon,
  });
});

const updateCoupon = catchAsync(async (req, res, next) => {
  if (req.body.code) {
    req.body.code = req.body.code.toUpperCase();
  }

  const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!coupon) {
    return next(new AppError('Coupon not found', 404));
  }

  res.status(200).json({
    status: 'success',
    coupon,
  });
});

const deleteCoupon = catchAsync(async (req, res, next) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);

  if (!coupon) {
    return next(new AppError('Coupon not found', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

module.exports = {
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
};
