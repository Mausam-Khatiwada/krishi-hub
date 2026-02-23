import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './styles.css';
import './i18n';
import { store } from './app/store';
import { restoreCart } from './features/cart/cartSlice';
import { restoreTheme } from './features/ui/uiSlice';

store.dispatch(restoreCart());
store.dispatch(restoreTheme());

ReactDOM.createRoot(document.getElementById('app')).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
        <Toaster position="top-right" />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>,
);
