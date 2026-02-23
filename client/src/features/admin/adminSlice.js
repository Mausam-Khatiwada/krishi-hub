import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../api/client';

const initialState = {
  stats: null,
  users: [],
  report: null,
  loading: false,
  error: null,
};

export const fetchAdminDashboard = createAsyncThunk('admin/fetchAdminDashboard', async (_, thunkAPI) => {
  try {
    const { data } = await api.get('/admin/dashboard');
    return data.stats;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to load dashboard');
  }
});

export const fetchAdminUsers = createAsyncThunk('admin/fetchAdminUsers', async (_, thunkAPI) => {
  try {
    const { data } = await api.get('/admin/users');
    return data.users;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to load users');
  }
});

export const toggleUserBlock = createAsyncThunk('admin/toggleUserBlock', async (userId, thunkAPI) => {
  try {
    const { data } = await api.patch(`/admin/users/${userId}/block`);
    return data.user;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to update user');
  }
});

export const setUserAccountStatus = createAsyncThunk(
  'admin/setUserAccountStatus',
  async ({ userId, isActive }, thunkAPI) => {
    try {
      const { data } = await api.patch(`/admin/users/${userId}/account-status`, { isActive });
      return data.user;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to update account status');
    }
  },
);

export const verifyFarmer = createAsyncThunk('admin/verifyFarmer', async (userId, thunkAPI) => {
  try {
    const { data } = await api.patch(`/admin/farmers/${userId}/verify`);
    return data.user;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to verify farmer');
  }
});

export const sendAnnouncement = createAsyncThunk(
  'admin/sendAnnouncement',
  async ({ title, message, role }, thunkAPI) => {
    try {
      const { data } = await api.post('/admin/announcements', { title, message, role });
      return data.sent;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to send announcement');
    }
  },
);

export const fetchAdminReport = createAsyncThunk('admin/fetchAdminReport', async (_, thunkAPI) => {
  try {
    const { data } = await api.get('/admin/reports');
    return data.report;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to load report');
  }
});

const adminSlice = createSlice({
  name: 'admin',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminDashboard.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchAdminDashboard.fulfilled, (state, action) => {
        state.loading = false;
        state.stats = action.payload;
      })
      .addCase(fetchAdminDashboard.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchAdminUsers.fulfilled, (state, action) => {
        state.users = action.payload;
      })
      .addCase(toggleUserBlock.fulfilled, (state, action) => {
        state.users = state.users.map((user) => (user._id === action.payload._id ? action.payload : user));
      })
      .addCase(setUserAccountStatus.fulfilled, (state, action) => {
        state.users = state.users.map((user) => (user._id === action.payload._id ? action.payload : user));
      })
      .addCase(verifyFarmer.fulfilled, (state, action) => {
        state.users = state.users.map((user) => (user._id === action.payload._id ? action.payload : user));
      })
      .addCase(fetchAdminReport.fulfilled, (state, action) => {
        state.report = action.payload;
      });
  },
});

export default adminSlice.reducer;
