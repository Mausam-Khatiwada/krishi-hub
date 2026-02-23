# Deployment Guide (Vercel + Render/Railway)

This project is deployment-ready as separate frontend and backend services.

## 1. Backend Deployment (Render or Railway)

### Render
1. Create a new **Web Service** and connect the repository.
2. Root directory: `server`
3. Build command: `npm install`
4. Start command: `npm start`
5. Add environment variables from `server/.env.example`.
6. Ensure `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`, and `STRIPE_SECRET_KEY` are set.

### Railway
1. Create a new project from repository.
2. Set service root to `server`.
3. Use default Node build/start (or explicit `npm start`).
4. Add all backend env vars.

## 2. Frontend Deployment (Vercel)

1. Create a new Vercel project from the same repository.
2. Set root directory to `client`.
3. Framework preset: **Vite**.
4. Build command: `npm run build`
5. Output directory: `dist`
6. Add environment variables:
   - `VITE_API_URL=https://<your-backend-domain>/api/v1`
   - `VITE_SOCKET_URL=https://<your-backend-domain>`
   - `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...`

## 3. CORS + Client URL

After frontend deployment, set backend `CLIENT_URL` to your Vercel URL, for example:

`CLIENT_URL=https://krishihub.vercel.app`

If using preview + production domains, comma-separate:

`CLIENT_URL=https://krishihub.vercel.app,https://krishihub-git-main-yourteam.vercel.app`

## 4. MongoDB

- Use MongoDB Atlas.
- Add network access and credentials.
- Set `MONGO_URI` in backend env.

## 5. Stripe Test Mode

- Set `STRIPE_SECRET_KEY` (backend) and `VITE_STRIPE_PUBLISHABLE_KEY` (frontend).
- Use Stripe test cards in checkout.

## 6. Post-Deploy Checklist

- Verify `/health` endpoint.
- Verify login/register, product listing, checkout, and chat.
- Confirm static uploads route works (`/uploads/*`).
- Confirm admin account seeded or created manually.

## Optional Hardening for Production

- Add Stripe webhook endpoint validation for payment confirmation.
- Move file uploads to Cloudinary/S3.
- Add centralized logging and uptime monitoring.
- Add automated tests (API + E2E) in CI.
