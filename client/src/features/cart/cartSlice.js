import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  items: [],
  couponCode: '',
};

const persistCart = (state) => {
  localStorage.setItem('krishihub_cart', JSON.stringify(state.items));
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    restoreCart: (state) => {
      const stored = localStorage.getItem('krishihub_cart');
      state.items = stored ? JSON.parse(stored) : [];
    },
    addToCart: (state, action) => {
      const item = action.payload;
      const exists = state.items.find((cartItem) => cartItem.productId === item.productId);

      if (exists) {
        exists.quantity += item.quantity || 1;
      } else {
        state.items.push({ ...item, quantity: item.quantity || 1 });
      }

      persistCart(state);
    },
    removeFromCart: (state, action) => {
      state.items = state.items.filter((item) => item.productId !== action.payload);
      persistCart(state);
    },
    updateCartQty: (state, action) => {
      const { productId, quantity } = action.payload;
      const item = state.items.find((cartItem) => cartItem.productId === productId);

      if (item) {
        item.quantity = Math.max(1, Number(quantity || 1));
      }

      persistCart(state);
    },
    clearCart: (state) => {
      state.items = [];
      persistCart(state);
    },
    setCouponCode: (state, action) => {
      state.couponCode = action.payload;
    },
  },
});

export const { restoreCart, addToCart, removeFromCart, updateCartQty, clearCart, setCouponCode } =
  cartSlice.actions;

export default cartSlice.reducer;
