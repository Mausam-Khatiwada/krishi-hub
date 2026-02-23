import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../api/client';

const initialState = {
  myOrders: [],
  farmerOrders: [],
  adminOrders: [],
  currentOrder: null,
  farmerAnalytics: null,
  checkoutUrl: null,
  loading: false,
  error: null,
};

export const createOrder = createAsyncThunk('orders/createOrder', async (payload, thunkAPI) => {
  try {
    const { data } = await api.post('/orders', payload);
    return data;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Order creation failed');
  }
});

export const fetchMyOrders = createAsyncThunk('orders/fetchMyOrders', async (_, thunkAPI) => {
  try {
    const { data } = await api.get('/orders/my');
    return data.orders;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to load orders');
  }
});

export const fetchFarmerOrders = createAsyncThunk('orders/fetchFarmerOrders', async (_, thunkAPI) => {
  try {
    const { data } = await api.get('/orders/farmer');
    return data.orders;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to load farmer orders');
  }
});

export const fetchAdminOrders = createAsyncThunk('orders/fetchAdminOrders', async (_, thunkAPI) => {
  try {
    const { data } = await api.get('/orders/admin/all');
    return data.orders;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to load admin orders');
  }
});

export const fetchOrderById = createAsyncThunk('orders/fetchOrderById', async (id, thunkAPI) => {
  try {
    const { data } = await api.get(`/orders/${id}`);
    return data.order;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to load order');
  }
});

export const fetchFarmerAnalytics = createAsyncThunk('orders/fetchFarmerAnalytics', async (_, thunkAPI) => {
  try {
    const { data } = await api.get('/orders/analytics/farmer');
    return data.analytics;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to load analytics');
  }
});

export const setFarmerDecision = createAsyncThunk(
  'orders/setFarmerDecision',
  async ({ id, decision }, thunkAPI) => {
    try {
      const { data } = await api.patch(`/orders/${id}/farmer-decision`, { decision });
      return data.order;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to update decision');
    }
  },
);

export const setOrderStatus = createAsyncThunk('orders/setOrderStatus', async ({ id, status }, thunkAPI) => {
  try {
    const { data } = await api.patch(`/orders/${id}/status`, { status });
    return data.order;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to update order status');
  }
});

export const confirmPayment = createAsyncThunk('orders/confirmPayment', async (sessionId, thunkAPI) => {
  try {
    const { data } = await api.post('/orders/payments/confirm', { sessionId });
    return data.order;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to confirm payment');
  }
});

const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    clearCheckoutUrl: (state) => {
      state.checkoutUrl = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createOrder.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createOrder.fulfilled, (state, action) => {
        state.loading = false;
        state.currentOrder = action.payload.order;
        state.checkoutUrl = action.payload.checkoutUrl;
        state.myOrders.unshift(action.payload.order);
      })
      .addCase(createOrder.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchMyOrders.fulfilled, (state, action) => {
        state.myOrders = action.payload;
      })
      .addCase(fetchFarmerOrders.fulfilled, (state, action) => {
        state.farmerOrders = action.payload;
      })
      .addCase(fetchAdminOrders.fulfilled, (state, action) => {
        state.adminOrders = action.payload;
      })
      .addCase(fetchOrderById.fulfilled, (state, action) => {
        state.currentOrder = action.payload;
      })
      .addCase(fetchFarmerAnalytics.fulfilled, (state, action) => {
        state.farmerAnalytics = action.payload;
      });
  },
});

export const { clearCheckoutUrl } = ordersSlice.actions;
export default ordersSlice.reducer;
