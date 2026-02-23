import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import productReducer from '../features/products/productsSlice';
import cartReducer from '../features/cart/cartSlice';
import ordersReducer from '../features/orders/ordersSlice';
import adminReducer from '../features/admin/adminSlice';
import forumReducer from '../features/forum/forumSlice';
import chatReducer from '../features/chat/chatSlice';
import notificationReducer from '../features/notifications/notificationSlice';
import uiReducer from '../features/ui/uiSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    products: productReducer,
    cart: cartReducer,
    orders: ordersReducer,
    admin: adminReducer,
    forum: forumReducer,
    chat: chatReducer,
    notifications: notificationReducer,
    ui: uiReducer,
  },
});
