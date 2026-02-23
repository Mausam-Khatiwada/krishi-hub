import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from './app/hooks';
import { fetchMe } from './features/auth/authSlice';
import { fetchNotifications } from './features/notifications/notificationSlice';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import LoadingSpinner from './components/LoadingSpinner';

const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ProductDetailsPage = lazy(() => import('./pages/ProductDetailsPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const BuyerDashboardPage = lazy(() => import('./pages/BuyerDashboardPage'));
const FarmerDashboardPage = lazy(() => import('./pages/FarmerDashboardPage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const ForumPage = lazy(() => import('./pages/ForumPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const WishlistPage = lazy(() => import('./pages/WishlistPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

const App = () => {
  const dispatch = useAppDispatch();
  const { token, initialized } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (token) {
      dispatch(fetchMe());
      dispatch(fetchNotifications());
    }
  }, [dispatch, token]);

  if (token && !initialized) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="products/:id" element={<ProductDetailsPage />} />
          <Route path="forum" element={<ForumPage />} />
          <Route
            path="chat"
            element={
              <ProtectedRoute roles={['farmer', 'buyer']}>
                <ChatPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="cart"
            element={
              <ProtectedRoute roles={['buyer']}>
                <CartPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="wishlist"
            element={
              <ProtectedRoute roles={['buyer']}>
                <WishlistPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="checkout"
            element={
              <ProtectedRoute roles={['buyer']}>
                <CheckoutPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="orders"
            element={
              <ProtectedRoute roles={['buyer', 'farmer', 'admin']}>
                <OrdersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="settings"
            element={
              <ProtectedRoute roles={['buyer', 'farmer', 'admin']}>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="buyer/dashboard"
            element={
              <ProtectedRoute roles={['buyer']}>
                <BuyerDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="farmer/dashboard"
            element={
              <ProtectedRoute roles={['farmer']}>
                <FarmerDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/dashboard"
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="404" element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
};

export default App;
