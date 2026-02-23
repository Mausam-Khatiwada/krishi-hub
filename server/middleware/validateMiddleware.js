const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

const validateRequest = (req, _res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return next(new AppError(errors.array().map((e) => e.msg).join(', '), 400));
  }

  next();
};

module.exports = validateRequest;
