import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../api/client';

const initialState = {
  products: [],
  product: null,
  categories: [],
  recommendations: [],
  farmerProducts: [],
  wishlist: [],
  loading: false,
  wishlistLoading: false,
  error: null,
  total: 0,
  filters: {
    search: '',
    category: '',
    minPrice: '',
    maxPrice: '',
    location: '',
    organic: false,
    sort: 'newest',
  },
};

export const fetchProducts = createAsyncThunk('products/fetchProducts', async (params, thunkAPI) => {
  try {
    const { data } = await api.get('/products', { params });
    return data;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to load products');
  }
});

export const fetchProductById = createAsyncThunk('products/fetchProductById', async (id, thunkAPI) => {
  try {
    const { data } = await api.get(`/products/${id}`);
    return data;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to load product');
  }
});

export const fetchCategories = createAsyncThunk('products/fetchCategories', async (_, thunkAPI) => {
  try {
    const { data } = await api.get('/categories');
    return data.categories;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to load categories');
  }
});

export const fetchRecommendations = createAsyncThunk('products/fetchRecommendations', async (_, thunkAPI) => {
  try {
    const { data } = await api.get('/products/recommendations/for/me');
    return data.recommendations;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to load recommendations');
  }
});

export const toggleWishlistProduct = createAsyncThunk(
  'products/toggleWishlistProduct',
  async (productId, thunkAPI) => {
    try {
      const { data } = await api.patch(`/users/wishlist/${productId}`);
      return {
        productId,
        isWishlisted: data.isWishlisted,
        wishlist: data.wishlist || [],
      };
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data?.message || 'Wishlist update failed');
    }
  },
);

export const fetchWishlist = createAsyncThunk('products/fetchWishlist', async (_, thunkAPI) => {
  try {
    const { data } = await api.get('/users/wishlist');
    return data.wishlist || [];
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to load wishlist');
  }
});

export const clearWishlist = createAsyncThunk('products/clearWishlist', async (_, thunkAPI) => {
  try {
    await api.delete('/users/wishlist');
    return [];
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to clear wishlist');
  }
});

export const subscribeFarmer = createAsyncThunk('products/subscribeFarmer', async (farmerId, thunkAPI) => {
  try {
    const { data } = await api.patch(`/users/subscribe/${farmerId}`);
    return data.subscribedFarmers;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Subscription failed');
  }
});

export const createProduct = createAsyncThunk('products/createProduct', async (formData, thunkAPI) => {
  try {
    const { data } = await api.post('/products', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.product;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to create product');
  }
});

export const fetchFarmerProducts = createAsyncThunk('products/fetchFarmerProducts', async (_, thunkAPI) => {
  try {
    const { data } = await api.get('/products/farmer/list/me');
    return data.products;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to load farmer products');
  }
});

export const updateProduct = createAsyncThunk('products/updateProduct', async ({ id, payload }, thunkAPI) => {
  try {
    const { data } = await api.patch(`/products/${id}`, payload, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.product;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to update product');
  }
});

export const quickUpdateProduct = createAsyncThunk(
  'products/quickUpdateProduct',
  async ({ id, payload }, thunkAPI) => {
    try {
      const { data } = await api.patch(`/products/${id}`, payload);
      return data.product;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to quick update product');
    }
  },
);

export const deleteProduct = createAsyncThunk('products/deleteProduct', async (id, thunkAPI) => {
  try {
    await api.delete(`/products/${id}`);
    return id;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to delete product');
  }
});

export const moderateProduct = createAsyncThunk(
  'products/moderateProduct',
  async ({ id, status }, thunkAPI) => {
    try {
      const { data } = await api.patch(`/products/${id}/moderate`, { status });
      return data.product;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to moderate product');
    }
  },
);

const productsSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    setProductFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearProductError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.products = action.payload.products;
        state.total = action.payload.total;
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchProductById.fulfilled, (state, action) => {
        state.product = action.payload.product;
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.categories = action.payload;
      })
      .addCase(fetchRecommendations.fulfilled, (state, action) => {
        state.recommendations = action.payload;
      })
      .addCase(fetchWishlist.pending, (state) => {
        state.wishlistLoading = true;
      })
      .addCase(fetchWishlist.fulfilled, (state, action) => {
        state.wishlistLoading = false;
        state.wishlist = action.payload;
      })
      .addCase(fetchWishlist.rejected, (state) => {
        state.wishlistLoading = false;
      })
      .addCase(toggleWishlistProduct.fulfilled, (state, action) => {
        state.wishlist = action.payload.wishlist;
      })
      .addCase(clearWishlist.fulfilled, (state) => {
        state.wishlist = [];
      })
      .addCase(fetchFarmerProducts.fulfilled, (state, action) => {
        state.farmerProducts = action.payload;
      })
      .addCase(createProduct.fulfilled, (state, action) => {
        state.farmerProducts.unshift(action.payload);
      })
      .addCase(updateProduct.fulfilled, (state, action) => {
        state.farmerProducts = state.farmerProducts.map((product) =>
          product._id === action.payload._id ? action.payload : product,
        );
      })
      .addCase(quickUpdateProduct.fulfilled, (state, action) => {
        state.farmerProducts = state.farmerProducts.map((product) =>
          product._id === action.payload._id ? action.payload : product,
        );
      })
      .addCase(deleteProduct.fulfilled, (state, action) => {
        state.farmerProducts = state.farmerProducts.filter((product) => product._id !== action.payload);
      })
      .addCase(moderateProduct.fulfilled, (state, action) => {
        state.products = state.products.map((product) =>
          product._id === action.payload._id ? action.payload : product,
        );
      });
  },
});

export const { setProductFilters, clearProductError } = productsSlice.actions;
export default productsSlice.reducer;
