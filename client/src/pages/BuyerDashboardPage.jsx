import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { fetchMe } from '../features/auth/authSlice';
import { addToCart } from '../features/cart/cartSlice';
import { fetchNotifications } from '../features/notifications/notificationSlice';
import { fetchMyOrders } from '../features/orders/ordersSlice';
import { fetchRecommendations } from '../features/products/productsSlice';
import ProductCard from '../components/ProductCard';
import {
  BellIcon,
  CartIcon,
  CheckCircleIcon,
  HeartIcon,
  MessageCircleIcon,
  ShieldCheckIcon,
  StoreIcon,
  TrendUpIcon,
  UserGroupIcon,
} from '../components/icons/AppIcons';
import { formatCurrency, formatDate } from '../utils/format';
import usePageTitle from '../hooks/usePageTitle';

const BuyerDashboardPage = () => {
  usePageTitle('Buyer Dashboard');

  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { recommendations } = useAppSelector((state) => state.products);
  const { myOrders } = useAppSelector((state) => state.orders);
  const { notifications } = useAppSelector((state) => state.notifications);

  const wishlist = user?.wishlist || [];
  const subscribedFarmers = user?.subscribedFarmers || [];
  const unreadNotifications = notifications.filter((item) => !item.isRead).length;

  useEffect(() => {
    dispatch(fetchMe());
    dispatch(fetchRecommendations());
    dispatch(fetchMyOrders());
    dispatch(fetchNotifications());
  }, [dispatch]);

  const reorderLatest = () => {
    const latest = myOrders[0];
    if (!latest?.items?.length) {
      toast.error('No order items to reorder');
      return;
    }

    latest.items.forEach((item) => {
      dispatch(
        addToCart({
          productId: item.product?._id || item.product,
          name: item.productName,
          pricePerUnit: item.unitPrice,
          farmerId: item.farmer?._id || item.farmer,
          image: item.product?.images?.[0]?.url,
          quantity: item.quantity,
        }),
      );
    });

    toast.success('Latest order items added to cart');
  };

  return (
    <div className="space-y-6">
      <section className="hero-panel bg-gradient-to-r from-[#103d25] via-[#1d6f3e] to-[#78b852] p-6 text-white md:p-7">
        <h1 className="font-['Sora'] text-3xl font-bold">Buyer Command Center</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/90">
          Monitor purchases, track favorites, and act faster with one-click reorder, live recommendations, and direct farmer connections.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/" className="btn-secondary !border-white/30 !bg-white/15 !text-white">
            <StoreIcon className="h-4 w-4" />
            Explore Marketplace
          </Link>
          <Link to="/chat" className="btn-secondary !border-white/30 !bg-white/15 !text-white">
            <MessageCircleIcon className="h-4 w-4" />
            Open Chat
          </Link>
          <button type="button" onClick={reorderLatest} className="btn-secondary !border-white/30 !bg-white/15 !text-white">
            <CartIcon className="h-4 w-4" />
            Reorder Latest
          </button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <article className="metric-card p-4">
          <p className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <CheckCircleIcon className="h-3.5 w-3.5 text-[var(--accent)]" />
            Orders placed
          </p>
          <p className="mt-1 text-2xl font-bold">{myOrders.length}</p>
        </article>
        <article className="metric-card p-4">
          <p className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <HeartIcon className="h-3.5 w-3.5 text-[var(--accent)]" />
            Wishlist items
          </p>
          <p className="mt-1 text-2xl font-bold">{wishlist.length}</p>
        </article>
        <article className="metric-card p-4">
          <p className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <UserGroupIcon className="h-3.5 w-3.5 text-[var(--accent)]" />
            Subscribed farmers
          </p>
          <p className="mt-1 text-2xl font-bold">{subscribedFarmers.length}</p>
        </article>
        <article className="metric-card p-4">
          <p className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <BellIcon className="h-3.5 w-3.5 text-[var(--accent)]" />
            Unread alerts
          </p>
          <p className="mt-1 text-2xl font-bold">{unreadNotifications}</p>
        </article>
      </section>

      <section className="app-card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="inline-flex items-center gap-2 text-xl font-bold">
            <TrendUpIcon className="h-5 w-5 text-[var(--accent)]" />
            AI Recommendations
          </h2>
          <div className="flex gap-2">
            <Link to="/wishlist" className="btn-secondary">
              Open wishlist
            </Link>
            <Link to="/" className="btn-secondary">
              Browse all products
            </Link>
          </div>
        </div>

        {recommendations.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {recommendations.slice(0, 4).map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            Recommendations appear after marketplace activity and completed orders.
          </p>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="app-card p-5">
          <h2 className="inline-flex items-center gap-2 text-xl font-bold">
            <HeartIcon className="h-5 w-5 text-[var(--accent)]" />
            Wishlist Snapshot
          </h2>
          <div className="mt-3 space-y-2">
            {wishlist.slice(0, 6).map((item) => (
              <article key={item._id} className="rounded-xl border border-[var(--line)] p-2.5 text-sm">
                <p className="font-semibold">{item.name}</p>
                <p className="text-[var(--text-muted)]">{formatCurrency(item.pricePerUnit)}</p>
              </article>
            ))}
            {!wishlist.length && <p className="text-sm text-[var(--text-muted)]">Your wishlist is empty.</p>}
          </div>
        </div>

        <div className="app-card p-5">
          <h2 className="inline-flex items-center gap-2 text-xl font-bold">
            <ShieldCheckIcon className="h-5 w-5 text-[var(--accent)]" />
            Direct Farm Connect
          </h2>
          <div className="mt-3 space-y-2">
            {subscribedFarmers.slice(0, 6).map((farmer) => (
              <article key={farmer._id} className="rounded-xl border border-[var(--line)] p-2.5 text-sm">
                <p className="font-semibold">{farmer.name}</p>
                <p className="text-[var(--text-muted)]">
                  {farmer.location?.district}, {farmer.location?.province}
                </p>
                {farmer.isFarmerVerified && <span className="badge-verified mt-1">Verified farmer</span>}
              </article>
            ))}
            {!subscribedFarmers.length && (
              <p className="text-sm text-[var(--text-muted)]">
                Subscribe to farmers from product pages for direct updates.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="app-card p-5">
        <h2 className="inline-flex items-center gap-2 text-xl font-bold">
          <StoreIcon className="h-5 w-5 text-[var(--accent)]" />
          Purchase History
        </h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={reorderLatest} className="btn-secondary">
            <CartIcon className="h-4 w-4" />
            Reorder latest purchase
          </button>
          <Link to="/orders" className="btn-secondary">
            Open detailed orders
          </Link>
        </div>
        <div className="mt-3 space-y-3">
          {myOrders.slice(0, 6).map((order) => (
            <article key={order._id} className="rounded-xl border border-[var(--line)] p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">Order #{order._id.slice(-8)}</p>
                <p className="text-[var(--text-muted)]">{formatDate(order.createdAt)}</p>
              </div>
              <p className="mt-1 text-[var(--text-muted)]">
                {order.items.length} items | {order.status}
              </p>
              <p className="mt-1 font-semibold text-[var(--accent)]">{formatCurrency(order.totalAmount)}</p>
            </article>
          ))}
          {!myOrders.length && <p className="text-sm text-[var(--text-muted)]">No purchases yet.</p>}
        </div>
      </section>
    </div>
  );
};

export default BuyerDashboardPage;
