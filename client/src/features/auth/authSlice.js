import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../api/client';
import { subscribeFarmer, toggleWishlistProduct } from '../products/productsSlice';

const tokenFromStorage = localStorage.getItem('krishihub_token');

const initialState = {
  user: null,
  token: tokenFromStorage,
  initialized: !tokenFromStorage,
  loading: false,
  registerChallengeToken: null,
  twoFactorRequired: false,
  twoFactorAuthToken: null,
  twoFactorProvider: null,
  error: null,
};

export const requestRegisterOtp = createAsyncThunk(
  'auth/requestRegisterOtp',
  async (payload, thunkAPI) => {
    try {
      const { data } = await api.post('/auth/register/request-otp', payload);
      return data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to send registration OTP');
    }
  },
);

export const resendRegisterOtp = createAsyncThunk(
  'auth/resendRegisterOtp',
  async (payload, thunkAPI) => {
    try {
      const { data } = await api.post('/auth/register/resend-otp', payload);
      return data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to resend registration OTP');
    }
  },
);

export const registerUser = createAsyncThunk('auth/registerUser', async (payload, thunkAPI) => {
  try {
    const { data } = await api.post('/auth/register/verify', payload);
    return data;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Registration verification failed');
  }
});

export const loginUser = createAsyncThunk('auth/loginUser', async (payload, thunkAPI) => {
  try {
    const { data } = await api.post('/auth/login', payload);
    return data;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Login failed');
  }
});

export const loginWithGoogle = createAsyncThunk('auth/loginWithGoogle', async (payload, thunkAPI) => {
  try {
    const { data } = await api.post('/auth/google', payload);
    return data;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Google login failed');
  }
});

export const fetchMe = createAsyncThunk('auth/fetchMe', async (_, thunkAPI) => {
  try {
    const { data } = await api.get('/auth/me');
    return data.user;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to fetch profile');
  }
});

export const logoutUser = createAsyncThunk('auth/logoutUser', async () => {
  await api.post('/auth/logout');
  return true;
});

export const updateProfile = createAsyncThunk('auth/updateProfile', async (payload, thunkAPI) => {
  try {
    const { data } = await api.patch('/auth/me', payload);
    return data.user;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Profile update failed');
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearAuthError: (state) => {
      state.error = null;
    },
    clearRegisterChallenge: (state) => {
      state.registerChallengeToken = null;
    },
    clearTwoFactorState: (state) => {
      state.twoFactorRequired = false;
      state.twoFactorAuthToken = null;
      state.twoFactorProvider = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(requestRegisterOtp.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(requestRegisterOtp.fulfilled, (state, action) => {
        state.loading = false;
        state.registerChallengeToken = action.payload.registerChallengeToken;
      })
      .addCase(requestRegisterOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(resendRegisterOtp.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(resendRegisterOtp.fulfilled, (state, action) => {
        state.loading = false;
        state.registerChallengeToken = action.payload.registerChallengeToken;
      })
      .addCase(resendRegisterOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.initialized = true;
        state.registerChallengeToken = null;
        state.twoFactorRequired = false;
        state.twoFactorAuthToken = null;
        state.twoFactorProvider = null;
        localStorage.setItem('krishihub_token', action.payload.token);
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.requiresTwoFactor) {
          state.twoFactorRequired = true;
          state.twoFactorAuthToken = action.payload.twoFactorAuthToken;
          state.twoFactorProvider = 'password';
          return;
        }

        state.user = action.payload.user;
        state.token = action.payload.token;
        state.initialized = true;
        state.twoFactorRequired = false;
        state.twoFactorAuthToken = null;
        state.twoFactorProvider = null;
        localStorage.setItem('krishihub_token', action.payload.token);
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.twoFactorRequired = false;
        state.twoFactorAuthToken = null;
        state.twoFactorProvider = null;
      })
      .addCase(loginWithGoogle.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginWithGoogle.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.requiresTwoFactor) {
          state.twoFactorRequired = true;
          state.twoFactorAuthToken = action.payload.twoFactorAuthToken;
          state.twoFactorProvider = 'google';
          return;
        }

        state.user = action.payload.user;
        state.token = action.payload.token;
        state.initialized = true;
        state.twoFactorRequired = false;
        state.twoFactorAuthToken = null;
        state.twoFactorProvider = null;
        localStorage.setItem('krishihub_token', action.payload.token);
      })
      .addCase(loginWithGoogle.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.twoFactorRequired = false;
        state.twoFactorAuthToken = null;
        state.twoFactorProvider = null;
      })
      .addCase(fetchMe.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.initialized = true;
      })
      .addCase(fetchMe.rejected, (state) => {
        state.loading = false;
        state.initialized = true;
        state.user = null;
        state.token = null;
        state.twoFactorRequired = false;
        state.twoFactorAuthToken = null;
        state.twoFactorProvider = null;
        localStorage.removeItem('krishihub_token');
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.initialized = true;
        state.registerChallengeToken = null;
        state.twoFactorRequired = false;
        state.twoFactorAuthToken = null;
        state.twoFactorProvider = null;
        localStorage.removeItem('krishihub_token');
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.user = action.payload;
      })
      .addCase(toggleWishlistProduct.fulfilled, (state, action) => {
        if (state.user) {
          state.user.wishlist = action.payload.wishlist;
        }
      })
      .addCase(subscribeFarmer.fulfilled, (state, action) => {
        if (state.user) {
          state.user.subscribedFarmers = action.payload;
        }
      });
  },
});

export const { clearAuthError, clearRegisterChallenge, clearTwoFactorState } = authSlice.actions;
export default authSlice.reducer;
