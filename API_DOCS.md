# Krishihub API Documentation

Base URL (local): `http://localhost:5000/api/v1`

Auth is JWT-based with `Authorization: Bearer <token>` and cookie support.

## Health

- `GET /health`
  - Response: `{ status: "ok", service: "krishihub-api" }`

## Auth

- `POST /auth/register/request-otp`
  - Body:
    ```json
    {
      "name": "Rita Farmer",
      "email": "rita@example.com",
      "password": "secret123",
      "role": "farmer",
      "location": { "district": "Kaski", "province": "Gandaki", "country": "Nepal" }
    }
    ```
  - Response includes `registerChallengeToken`.

- `POST /auth/register/verify`
  - Body:
    ```json
    {
      "registerChallengeToken": "...",
      "otpCode": "123456",
      "password": "secret123"
    }
    ```

- `POST /auth/register/resend-otp`
  - Body:
    ```json
    {
      "registerChallengeToken": "..."
    }
    ```

- `POST /auth/login`
  - Supports optional two-factor fields:
    ```json
    {
      "email": "user@example.com",
      "password": "secret123",
      "twoFactorCode": "123456",
      "twoFactorAuthToken": "optional-challenge-token"
    }
    ```
  - If 2FA is enabled and code is missing, response includes:
    ```json
    {
      "status": "success",
      "requiresTwoFactor": true,
      "twoFactorAuthToken": "..."
    }
    ```
  - May return `423 Locked` after repeated failed password attempts.
- `POST /auth/google`
  - Body:
    ```json
    {
      "credential": "google_id_token",
      "role": "buyer",
      "twoFactorCode": "123456",
      "twoFactorAuthToken": "optional-challenge-token"
    }
    ```
- `POST /auth/logout`
- `GET /auth/me` (protected)
- `PATCH /auth/me` (protected)
- `PATCH /auth/security` (protected)
  - Supports:
    ```json
    {
      "security": {
        "loginAlerts": true
      }
    }
    ```
- `POST /auth/2fa/setup` (protected)
- `POST /auth/2fa/enable` (protected)
  - Body: `{ "token": "123456" }`
- `POST /auth/2fa/disable` (protected)
  - Body: `{ "token": "123456" }`

## Users

- `PATCH /users/wishlist/:productId` (buyer/farmer)
- `PATCH /users/subscribe/:farmerId` (buyer)
- `GET /users/purchase-history` (buyer)
- `GET /users/alerts` (buyer)
- `PATCH /users/alerts/:productId` (buyer)
  - Body example:
    ```json
    {
      "active": true,
      "targetPrice": 180,
      "notifyOnPriceDrop": true,
      "notifyOnRestock": true
    }
    ```
- `GET /users/insights/buyer-buy-again` (buyer)
- `GET /users/insights/farmer-demand` (farmer)
- `GET /users/insights/farmer-customers` (farmer)

## Categories

- `GET /categories`
- `POST /categories` (admin)
- `PATCH /categories/:id` (admin)
- `DELETE /categories/:id` (admin)

## Products

- `GET /products`
  - Query: `category`, `minPrice`, `maxPrice`, `location`, `organic`, `search`, `sort`, `page`, `limit`
- `GET /products/:id`
- `GET /products/farmer/:farmerId`
- `GET /products/farmer/list/me` (farmer)
- `GET /products/recommendations/for/me` (buyer/farmer)
- `POST /products/price-suggestion` (farmer)
- `POST /products` (farmer, multipart)
  - Fields: `name`, `category`, `description`, `pricePerUnit`, `quantityAvailable`, `harvestDate`, `organic`, `district`, `province`, `country`, `tags`
  - Files: `images[]`, `videos[]`
- `PATCH /products/:id` (owner/admin, multipart)
- `DELETE /products/:id` (owner/admin)
- `PATCH /products/:id/moderate` (admin)
  - Body: `{ "status": "approved" | "rejected" }`

## Orders

- `POST /orders` (buyer)
  - Body:
    ```json
    {
      "items": [{ "productId": "...", "quantity": 2 }],
      "shippingAddress": {
        "fullName": "Sita Buyer",
        "phone": "9800000000",
        "district": "Kathmandu",
        "province": "Bagmati",
        "addressLine": "Baneshwor"
      },
      "couponCode": "FRESH10",
      "paymentMethod": "stripe"
    }
    ```
  - `paymentMethod` supports: `stripe`, `cod`, `esewa`, `khalti`, `mobile_banking`
  - Notes:
    - `stripe`: returns hosted Stripe `checkoutUrl`.
    - `esewa`: returns internal `checkoutUrl` that auto-posts to eSewa with signed payload.
    - `khalti`: returns Khalti `payment_url` as `checkoutUrl`.
- `POST /orders/payments/confirm` (buyer)
  - Body:
    ```json
    {
      "sessionId": "cs_test_..."
    }
    ```
  - Notes:
    - Confirms only buyer-owned order sessions.
    - Validates Stripe session `payment_status=paid` before marking order as paid.
- `GET /orders/my` (buyer)
- `GET /orders/farmer` (farmer)
- `GET /orders/analytics/farmer` (farmer)
- `GET /orders/admin/all` (admin)
- `GET /orders/:id` (buyer/farmer/admin)
- `GET /orders/:id/invoice` (buyer/farmer/admin)
- `PATCH /orders/:id/farmer-decision` (farmer)
  - Body: `{ "decision": "accepted" | "rejected" }`
- `PATCH /orders/:id/status` (admin/farmer)
- `PATCH /orders/:id/tracking` (admin)

### Public Payment Callback Endpoints

- `GET /orders/payments/esewa/checkout?token=...`
  - Auto-submits signed eSewa payment form.
- `GET /orders/payments/esewa/callback/success`
  - Decodes callback payload, verifies signature, verifies transaction status with eSewa API, marks order paid, then redirects to client.
- `GET /orders/payments/esewa/callback/failure`
  - Marks payment failed/cancelled and redirects to client checkout page.
- `GET /orders/payments/khalti/callback`
- `POST /orders/payments/khalti/callback`
  - Verifies `pidx` through Khalti lookup API, marks order paid on successful verification, and redirects to client.

## Reviews

- `GET /reviews/product/:productId`
- `POST /reviews` (buyer)
  - Body: `{ "productId": "...", "orderId": "...", "rating": 5, "comment": "Excellent" }`

## Admin

- `GET /admin/dashboard`
- `GET /admin/intelligence/overview`
- `GET /admin/intelligence/dynamic-pricing`
- `POST /admin/intelligence/dynamic-pricing/apply`
  - Body:
    ```json
    {
      "updates": [
        { "productId": "...", "pricePerUnit": 180 }
      ]
    }
    ```
- `GET /admin/intelligence/inventory`
- `POST /admin/intelligence/inventory/automate`
  - Body:
    ```json
    {
      "mode": "notify-and-tag",
      "thresholdDays": 10
    }
    ```
- `GET /admin/intelligence/marketing`
- `POST /admin/intelligence/marketing/launch`
  - Body:
    ```json
    {
      "campaignType": "reactivation",
      "targetSegment": "dormant-buyers",
      "title": "We miss you on Krishihub",
      "message": "Fresh harvests are live again.",
      "createCoupon": {
        "enabled": true,
        "codePrefix": "BACK",
        "discountType": "percent",
        "value": 10,
        "expiresDays": 7
      }
    }
    ```
- `GET /admin/users`
- `PATCH /admin/users/:id/block`
- `PATCH /admin/farmers/:id/verify`
- `DELETE /admin/products/:id`
- `POST /admin/announcements`
- `GET /admin/reports`

## Chat

- `GET /chats`
- `POST /chats`
  - Body: `{ "participantId": "..." }`
- `POST /chats/:chatId/messages`

Socket events:
- Client -> Server: `join:chat`, `leave:chat`
- Server -> Client: `chat:message`, `notification:new`, `inventory:update`

## Notifications

- `GET /notifications`
- `PATCH /notifications/read-all`
- `PATCH /notifications/:id/read`

## Coupons (admin)

- `GET /coupons`
- `POST /coupons`
- `PATCH /coupons/:id`
- `DELETE /coupons/:id`

## Forum

- `GET /forum`
- `POST /forum`
- `POST /forum/:id/comments`
- `PATCH /forum/:id/like`

## Weather & Analytics

- `GET /weather` (query: `district` or `lat` + `lng`)
- `GET /analytics/crop-trends`
