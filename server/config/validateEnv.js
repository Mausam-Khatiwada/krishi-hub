const isPlaceholderSecret = (value = '') =>
  /(replace|changeme|change_me|default|your[_-]?secret|test[_-]?secret)/i.test(String(value));

const parsePositiveInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const validateRange = (value, min, max) => value >= min && value <= max;

const hasValue = (value) => typeof value === 'string' && value.trim().length > 0;

const normalizeOrigins = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const validateEnv = () => {
  const issues = [];
  const warnings = [];
  const isProduction = process.env.NODE_ENV === 'production';

  if (!hasValue(process.env.MONGO_URI)) {
    issues.push('MONGO_URI is required.');
  }

  if (!hasValue(process.env.JWT_SECRET)) {
    issues.push('JWT_SECRET is required.');
  } else {
    const jwtSecret = String(process.env.JWT_SECRET);
    if (jwtSecret.length < 32) {
      const message = 'JWT_SECRET should be at least 32 characters.';
      if (isProduction) issues.push(message);
      else warnings.push(message);
    }

    if (isPlaceholderSecret(jwtSecret)) {
      const message = 'JWT_SECRET appears to be a placeholder value.';
      if (isProduction) issues.push(message);
      else warnings.push(message);
    }
  }

  const origins = normalizeOrigins(process.env.CLIENT_URL);
  if (!origins.length) {
    issues.push('CLIENT_URL must contain at least one allowed origin.');
  }

  const registerOtpLength = parsePositiveInt(process.env.REGISTER_OTP_LENGTH || '6');
  if (!registerOtpLength || !validateRange(registerOtpLength, 4, 8)) {
    issues.push('REGISTER_OTP_LENGTH must be between 4 and 8.');
  }

  const registerOtpExpiresMinutes = parsePositiveInt(process.env.REGISTER_OTP_EXPIRES_MINUTES || '10');
  if (!registerOtpExpiresMinutes || !validateRange(registerOtpExpiresMinutes, 1, 30)) {
    issues.push('REGISTER_OTP_EXPIRES_MINUTES must be between 1 and 30.');
  }

  const registerOtpResendSeconds = parsePositiveInt(process.env.REGISTER_OTP_RESEND_SECONDS || '45');
  if (!registerOtpResendSeconds || !validateRange(registerOtpResendSeconds, 15, 300)) {
    issues.push('REGISTER_OTP_RESEND_SECONDS must be between 15 and 300.');
  }

  const maxFailedAttempts = parsePositiveInt(process.env.MAX_FAILED_LOGIN_ATTEMPTS || '5');
  if (!maxFailedAttempts || !validateRange(maxFailedAttempts, 3, 20)) {
    issues.push('MAX_FAILED_LOGIN_ATTEMPTS must be between 3 and 20.');
  }

  const loginLockMinutes = parsePositiveInt(process.env.LOGIN_LOCK_MINUTES || '15');
  if (!loginLockMinutes || !validateRange(loginLockMinutes, 1, 180)) {
    issues.push('LOGIN_LOCK_MINUTES must be between 1 and 180.');
  }

  const smtpFields = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  const configuredSmtpFields = smtpFields.filter((field) => hasValue(process.env[field]));
  if (configuredSmtpFields.length > 0 && configuredSmtpFields.length < smtpFields.length) {
    issues.push('SMTP configuration is incomplete. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS together.');
  }

  if (isProduction && configuredSmtpFields.length === 0) {
    issues.push('SMTP configuration is required in production because registration uses email OTP verification.');
  }

  if (configuredSmtpFields.length && !hasValue(process.env.SMTP_FROM)) {
    const message = 'SMTP_FROM is recommended when SMTP is configured.';
    if (isProduction) issues.push(message);
    else warnings.push(message);
  }

  if (isProduction) {
    const insecureOrigins = origins.filter((origin) => origin.startsWith('http://'));
    if (insecureOrigins.length > 0) {
      issues.push('CLIENT_URL must use https:// origins in production.');
    }
  }

  if (warnings.length > 0 && !isProduction) {
    warnings.forEach((warning) => {
      console.warn(`[env-warning] ${warning}`);
    });
  }

  if (issues.length > 0) {
    throw new Error(`Environment validation failed:\n- ${issues.join('\n- ')}`);
  }
};

module.exports = validateEnv;
