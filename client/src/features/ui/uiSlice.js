import { createSlice } from '@reduxjs/toolkit';

const initialTheme = localStorage.getItem('krishihub_theme') || 'light';

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    theme: initialTheme,
  },
  reducers: {
    restoreTheme: (state) => {
      const stored = localStorage.getItem('krishihub_theme') || 'light';
      state.theme = stored;
      document.documentElement.setAttribute('data-theme', stored);
    },
    toggleTheme: (state) => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('krishihub_theme', state.theme);
      document.documentElement.setAttribute('data-theme', state.theme);
    },
  },
});

export const { restoreTheme, toggleTheme } = uiSlice.actions;
export default uiSlice.reducer;
