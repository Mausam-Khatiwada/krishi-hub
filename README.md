# Krishihub - Full-Stack MERN Agricultural Marketplace

Krishihub is a role-based MERN e-commerce platform that connects farmers directly with buyers. It includes JWT auth, Google login, TOTP 2FA, email OTP registration verification, account lockout protection, product management, order flow with Stripe checkout, analytics dashboards, admin moderation, multilingual UI (English/Nepali), real-time chat, and responsive design.

## Tech Stack

- Frontend: React + Vite + Redux Toolkit + Tailwind CSS v4
- Backend: Node.js + Express.js + Socket.io
- Database: MongoDB + Mongoose
- Auth: JWT (header + httpOnly cookie)
- Payments: Stripe Checkout (test mode)
- Validation: express-validator + zod/react-hook-form
- File Upload: Local upload storage (Cloudinary-ready config included)

## Project Structure

```
krishi-hub/
  client/
    src/
      api/
      app/
      components/
      features/
      pages/
      locales/
  server/
    config/
    models/
    routes/
    controllers/
    middleware/
    utils/
    uploads/
    scripts/
  README.md
  API_DOCS.md
  DEPLOYMENT.md
```

## Implemented Role Features

### Farmer
- Register/login
- Farmer profile data + verification badge support
- Create/edit/delete products with image/video uploads
- Product metadata: category, price/unit, quantity, harvest date, organic, location
- View incoming orders and accept/reject decisions
- Sales analytics dashboard (revenue, units sold, monthly sales)
- Wallet balance display
- Smart price suggestion helper
- Weather insight block for farmer location
- Top farmer badge (gamification threshold)

### Buyer
- Register/login
- Google Sign-In (OAuth credential flow)
- Two-factor authentication with authenticator apps (setup/enable/disable)
- Email OTP verification during registration
- Failed-login lockout policy and login security alert emails
- Browse/search/filter/sort products
- Product detail view with Google Maps embed
- Cart and checkout flow
- Stripe checkout session integration (test mode)
- Order history and invoice download
- Wishlist toggle
- Direct Farm Connect (subscribe to farmers)
- AI-style recommendations endpoint + UI section
- Forum participation and real-time chat access

### Admin
- Secure role-protected admin dashboard
- Analytics: users, farmers, buyers, products, orders, revenue
- Manage users (block/unblock)
- Verify farmers
- Approve/reject product listings
- Category management (create + view)
- Send announcements (all/farmers/buyers)
- View platform report snapshots

## Additional Platform Features

- i18n with English/Nepali toggle, language preference in localStorage
- Dark/light theme toggle with localStorage persistence
- Real-time inventory updates via Socket.io events
- Real-time buyer-farmer messaging (chat rooms)
- In-app notifications module
- Recently viewed products history
- Progressive Web App (PWA) support with install prompt + service worker caching
- Coupon-aware order API
- PDF invoice generation
- Community discussion forum
- Crop trend analytics endpoint + frontend chart
- Admin Intelligence Suite:
  - Dynamic Pricing Engine with guarded bulk apply
  - Smart Inventory & Supply Chain Automation
  - Advanced Marketing Automation with segmentation and optional auto-coupon generation
- Security middleware: helmet, rate limiting, mongo sanitize, hpp, xss clean
- Lazy-loaded route pages for performance

## Local Setup

### 1. Backend

```bash
cd server
cp .env.example .env
npm install
npm run seed
npm run dev
```

Backend runs on `http://localhost:5000`.

### 2. Frontend

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

### Google + 2FA Configuration

- Set `GOOGLE_CLIENT_ID` in `server/.env`
- Set `VITE_GOOGLE_CLIENT_ID` in `client/.env` (same client ID)
- Optional:
  - `TWO_FACTOR_ISSUER` (default: `Krishihub`)
  - `TWO_FACTOR_TOKEN_EXPIRES_IN` (default: `10m`)
  - `MAX_FAILED_LOGIN_ATTEMPTS` (default: `5`)
  - `LOGIN_LOCK_MINUTES` (default: `15`)
  - `REGISTER_OTP_LENGTH` (default: `6`)
  - `REGISTER_OTP_EXPIRES_MINUTES` (default: `10`)
  - `REGISTER_OTP_RESEND_SECONDS` (default: `45`)
  - `AUTH_RATE_LIMIT_MAX` (default: `80` requests/15 min for auth endpoints)
  - `COOKIE_SAME_SITE` (`lax`, `strict`, or `none`)
  - `COOKIE_MAX_AGE_MS` (default: `604800000`)
  - `SMTP_SECURE` (auto-detected by port if unset)
  - `SMTP_TLS_REJECT_UNAUTHORIZED` (default: `true`)

Security note:
- Production startup now validates critical environment variables and rejects weak/placeholder `JWT_SECRET` values.
- Production startup also requires full SMTP configuration because registration uses email OTP verification.

## Test Accounts

- Seeded admin is created when `ADMIN_EMAIL` + `ADMIN_PASSWORD` are set in `server/.env` before running `npm run seed`.
- Farmer and buyer accounts are created from the register page.

## Build Verification

Frontend production build passes:

```bash
cd client
npm run build
```

Backend module load check passes:

```bash
cd server
node -e "require('./app'); console.log('server app ok')"
```

Backend syntax check for all server files:

```bash
cd server
node --check server.js
```

Backend production preflight (env validation + DB connection + health routes):

```bash
cd server
npm run preflight
```

Dependency vulnerability check:

```bash
cd server
npm audit --omit=dev
cd ../client
npm audit --omit=dev
```

## API Documentation

See `API_DOCS.md`.

## Deployment

See `DEPLOYMENT.md` for Vercel + Render/Railway setup.

## Notes

- File storage defaults to local disk under `server/uploads`; Cloudinary env keys are already supported in config for extension.
- Stripe webhook flow is simplified for demo workflow and can be hardened in production.
- Some advanced modules (delivery partner deep integration, full recommendation ML, advanced SEO server rendering) are scaffolded at a practical MVP level and ready for deeper iteration.
