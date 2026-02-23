import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../api/client';

const initialState = {
  posts: [],
  loading: false,
  error: null,
};

export const fetchForumPosts = createAsyncThunk('forum/fetchForumPosts', async (search, thunkAPI) => {
  try {
    const { data } = await api.get('/forum', { params: { search } });
    return data.posts;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to load forum posts');
  }
});

export const createForumPost = createAsyncThunk('forum/createForumPost', async (payload, thunkAPI) => {
  try {
    const { data } = await api.post('/forum', payload);
    return data.post;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to create post');
  }
});

export const addForumComment = createAsyncThunk('forum/addForumComment', async ({ id, text }, thunkAPI) => {
  try {
    const { data } = await api.post(`/forum/${id}/comments`, { text });
    return data.post;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to add comment');
  }
});

export const toggleForumLike = createAsyncThunk('forum/toggleForumLike', async (id, thunkAPI) => {
  try {
    await api.patch(`/forum/${id}/like`);
    return id;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to toggle like');
  }
});

const forumSlice = createSlice({
  name: 'forum',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchForumPosts.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchForumPosts.fulfilled, (state, action) => {
        state.loading = false;
        state.posts = action.payload;
      })
      .addCase(fetchForumPosts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(createForumPost.fulfilled, (state, action) => {
        state.posts.unshift(action.payload);
      })
      .addCase(addForumComment.fulfilled, (state, action) => {
        state.posts = state.posts.map((post) => (post._id === action.payload._id ? action.payload : post));
      });
  },
});

export default forumSlice.reducer;
