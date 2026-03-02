const nodemailer = require('nodemailer');

const parseBoolean = (value, fallback = undefined) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  return fallback;
};

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const sendEmail = async ({ to, subject, text, html }) => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return;
  }

  const port = parsePositiveInt(process.env.SMTP_PORT, 587);
  const secureFromEnv = parseBoolean(process.env.SMTP_SECURE);
  const secure = typeof secureFromEnv === 'boolean' ? secureFromEnv : port === 465;
  const tlsRejectUnauthorized = parseBoolean(process.env.SMTP_TLS_REJECT_UNAUTHORIZED, true);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: tlsRejectUnauthorized },
    connectionTimeout: parsePositiveInt(process.env.SMTP_CONNECTION_TIMEOUT_MS, 10000),
    greetingTimeout: parsePositiveInt(process.env.SMTP_GREETING_TIMEOUT_MS, 10000),
    socketTimeout: parsePositiveInt(process.env.SMTP_SOCKET_TIMEOUT_MS, 20000),
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'Krishihub <noreply@krishihub.com>',
    to,
    subject,
    text,
    html,
  });
};

module.exports = sendEmail;
