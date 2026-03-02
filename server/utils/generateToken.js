const jwt = require('jsonwebtoken');

const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const resolveSameSite = () => {
  const raw = String(process.env.COOKIE_SAME_SITE || 'lax').trim().toLowerCase();
  return ['lax', 'strict', 'none'].includes(raw) ? raw : 'lax';
};

const cookieOptions = () => {
  const sameSite = resolveSameSite();
  const isSecure = process.env.NODE_ENV === 'production' || sameSite === 'none';

  return {
    httpOnly: true,
    secure: isSecure,
    sameSite,
    maxAge: parsePositiveInt(process.env.COOKIE_MAX_AGE_MS, 7 * 24 * 60 * 60 * 1000),
  };
};

module.exports = {
  signToken,
  cookieOptions,
};
