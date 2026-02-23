const KEY_SANITIZE_REGEX = /^\$|\./;

const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

const escapeHtml = (value) =>
  value.replace(/[&<>"'`=\/]/g, (char) => HTML_ESCAPE_MAP[char] || char);

const isObjectLike = (value) =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  !(value instanceof Date) &&
  !(value instanceof RegExp);

const sanitizeNoSqlInPlace = (target) => {
  if (Array.isArray(target)) {
    target.forEach((item) => sanitizeNoSqlInPlace(item));
    return;
  }

  if (!isObjectLike(target)) {
    return;
  }

  Object.keys(target).forEach((key) => {
    if (KEY_SANITIZE_REGEX.test(key)) {
      delete target[key];
      return;
    }

    sanitizeNoSqlInPlace(target[key]);
  });
};

const sanitizeXssInPlace = (target) => {
  if (Array.isArray(target)) {
    target.forEach((item, index) => {
      if (typeof item === 'string') {
        target[index] = escapeHtml(item);
      } else {
        sanitizeXssInPlace(item);
      }
    });
    return;
  }

  if (!isObjectLike(target)) {
    return;
  }

  Object.keys(target).forEach((key) => {
    const value = target[key];

    if (typeof value === 'string') {
      target[key] = escapeHtml(value);
      return;
    }

    sanitizeXssInPlace(value);
  });
};

const sanitizeRequest = (req, _res, next) => {
  ['body', 'params', 'query'].forEach((key) => {
    if (!req[key]) return;
    sanitizeNoSqlInPlace(req[key]);
    sanitizeXssInPlace(req[key]);
  });

  next();
};

module.exports = sanitizeRequest;

