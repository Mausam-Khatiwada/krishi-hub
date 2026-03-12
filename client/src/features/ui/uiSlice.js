import { createSlice } from '@reduxjs/toolkit';

const resolveTheme = () => (localStorage.getItem('krishihub_theme') === 'dark' ? 'dark' : 'light');
const initialTheme = resolveTheme();

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    theme: initialTheme,
  },
  reducers: {
    restoreTheme: (state) => {
      const stored = resolveTheme();
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
