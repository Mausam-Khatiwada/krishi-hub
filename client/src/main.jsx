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

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        if (import.meta.env.DEV) {
          console.error('Service worker registration failed:', error);
        }
      });
    });
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch(() => undefined);

      if ('caches' in window) {
        caches
          .keys()
          .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
          .catch(() => undefined);
      }
    });
  }
}

ReactDOM.createRoot(document.getElementById('app')).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-right"
          gutter={10}
          containerStyle={{ top: 18, right: 16 }}
          toastOptions={{
            duration: 4200,
            style: {
              borderRadius: '14px',
              border: '1px solid var(--line)',
              background: 'color-mix(in srgb, var(--surface) 95%, transparent)',
              color: 'var(--text)',
              boxShadow: 'var(--shadow-sm)',
              maxWidth: 'min(24rem, 92vw)',
            },
          }}
        />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>,
);
