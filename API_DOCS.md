# Krishihub API Documentation

Base URL (local): `http://localhost:5000/api/v1`

Auth is JWT-based with `Authorization: Bearer <token>` and cookie support.

## Health

- `GET /health`
  - Response: `{ status: "ok", service: "krishihub-api" }`

## Auth

- `POST /auth/register`
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

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me` (protected)
- `PATCH /auth/me` (protected)

## Users

- `PATCH /users/wishlist/:productId` (buyer/farmer)
- `PATCH /users/subscribe/:farmerId` (buyer)
- `GET /users/purchase-history` (buyer)

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
- `POST /orders/payments/confirm` (buyer)
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

## Reviews

- `GET /reviews/product/:productId`
- `POST /reviews` (buyer)
  - Body: `{ "productId": "...", "orderId": "...", "rating": 5, "comment": "Excellent" }`

## Admin

- `GET /admin/dashboard`
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
