import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import api from '../api/client';
import { fetchMe } from '../features/auth/authSlice';
import { addToCart } from '../features/cart/cartSlice';
import { fetchNotifications } from '../features/notifications/notificationSlice';
import { fetchMyOrders } from '../features/orders/ordersSlice';
import { fetchRecommendations, fetchWishlist } from '../features/products/productsSlice';
import ProductCard from '../components/ProductCard';
import {
  BellIcon,
  CandleChartIcon,
  CartIcon,
  CheckCircleIcon,
  ClockIcon,
  HeartIcon,
  MessageCircleIcon,
  ShieldCheckIcon,
  SparkleIcon,
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
  const { recommendations, wishlist } = useAppSelector((state) => state.products);
  const { myOrders } = useAppSelector((state) => state.orders);
  const { notifications } = useAppSelector((state) => state.notifications);

  const [buyAgainInsights, setBuyAgainInsights] = useState([]);
  const [priceAlerts, setPriceAlerts] = useState([]);
  const [buyerIntelLoading, setBuyerIntelLoading] = useState(false);
  const [alertsDraft, setAlertsDraft] = useState({});

  const subscribedFarmers = user?.subscribedFarmers || [];
  const unreadNotifications = notifications.filter((item) => !item.isRead).length;

  const alertByProductId = useMemo(
    () => new Map(priceAlerts.map((alert) => [alert.product?._id, alert])),
    [priceAlerts],
  );

  const untrackedWishlistItems = useMemo(
    () => (wishlist || []).filter((item) => item?._id && !alertByProductId.has(item._id)),
    [alertByProductId, wishlist],
  );

  useEffect(() => {
    dispatch(fetchMe());
    dispatch(fetchRecommendations());
    dispatch(fetchMyOrders());
    dispatch(fetchNotifications());
    dispatch(fetchWishlist());

    let alive = true;

    const loadBuyerIntel = async () => {
      setBuyerIntelLoading(true);

      try {
        const [buyAgainResponse, alertsResponse] = await Promise.all([
          api.get('/users/insights/buyer-buy-again'),
          api.get('/users/alerts'),
        ]);

        if (!alive) return;

        const nextBuyAgain = buyAgainResponse.data?.insights?.buyAgain || [];
        const nextAlerts = alertsResponse.data?.alerts || [];

        setBuyAgainInsights(nextBuyAgain);
        setPriceAlerts(nextAlerts);
      } catch (_error) {
        if (alive) {
          setBuyAgainInsights([]);
          setPriceAlerts([]);
        }
      } finally {
        if (alive) {
          setBuyerIntelLoading(false);
        }
      }
    };

    loadBuyerIntel();

    return () => {
      alive = false;
    };
  }, [dispatch]);

  useEffect(() => {
    setAlertsDraft((prev) => {
      const next = { ...prev };
      priceAlerts.forEach((alert) => {
        const productId = alert.product?._id;
        if (!productId || typeof next[productId] !== 'undefined') return;
        next[productId] = typeof alert.targetPrice === 'number' ? String(alert.targetPrice) : '';
      });
      return next;
    });
  }, [priceAlerts]);

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

  const addInsightItemToCart = (entry) => {
    const product = entry?.product;
    if (!product?._id) return;

    dispatch(
      addToCart({
        productId: product._id,
        name: product.name,
        pricePerUnit: product.pricePerUnit,
        farmerId: product.farmer?._id || product.farmer,
        image: product.images?.[0]?.url,
        quantity: entry.metrics?.suggestedQuantity || 1,
      }),
    );

    toast.success(`${product.name} added to cart`);
  };

  const setTrackingState = async (product, active) => {
    if (!product?._id) return;

    const defaultTarget =
      Number(product.pricePerUnit) > 0 ? Number((Number(product.pricePerUnit) * 0.95).toFixed(2)) : null;

    try {
      const { data } = await api.patch(`/users/alerts/${product._id}`, {
        active,
        targetPrice: active ? defaultTarget : undefined,
      });
      setPriceAlerts(data.alerts || []);
      if (active) {
        setAlertsDraft((prev) => ({
          ...prev,
          [product._id]: defaultTarget ? String(defaultTarget) : '',
        }));
      }
      toast.success(active ? 'Product tracking enabled' : 'Product tracking removed');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update tracking');
    }
  };

  const saveAlertTarget = async (productId) => {
    const value = alertsDraft[productId];
    const normalized = value === '' ? null : Number(value);

    if (value !== '' && (!Number.isFinite(normalized) || normalized < 0)) {
      toast.error('Target must be a non-negative number');
      return;
    }

    try {
      const { data } = await api.patch(`/users/alerts/${productId}`, {
        active: true,
        targetPrice: normalized,
      });
      setPriceAlerts(data.alerts || []);
      toast.success('Price alert target saved');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save alert target');
    }
  };

  return (
    <div className="space-y-6">
      <section className="hero-panel bg-gradient-to-r from-[#103d25] via-[#1d6f3e] to-[#78b852] p-6 text-white md:p-7">
        <h1 className="font-['Sora'] text-3xl font-bold">Buyer Command Center</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/90">
          Operate like a pro buyer with AI reorder intelligence, smart price tracking, and direct farm subscriptions.
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

      <section className="grid grid-cols-2 gap-4 md:grid-cols-5">
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
            <SparkleIcon className="h-3.5 w-3.5 text-[var(--accent)]" />
            Buy-again signals
          </p>
          <p className="mt-1 text-2xl font-bold">{buyAgainInsights.length}</p>
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

      <section className="app-card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="inline-flex items-center gap-2 text-xl font-bold">
            <CandleChartIcon className="h-5 w-5 text-[var(--accent)]" />
            Buy Again Intelligence
          </h2>
          <button type="button" onClick={reorderLatest} className="btn-secondary">
            <CartIcon className="h-4 w-4" />
            Reorder latest purchase
          </button>
        </div>

        {buyAgainInsights.length ? (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {buyAgainInsights.slice(0, 8).map((entry) => (
              <article key={entry.product?._id} className="rounded-xl border border-[var(--line)] p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{entry.productName}</p>
                  <span
                    className={`badge ${
                      entry.metrics?.urgency === 'high'
                        ? 'border-rose-400/40 bg-rose-500/10 text-rose-700'
                        : entry.metrics?.urgency === 'medium'
                          ? 'border-amber-400/40 bg-amber-500/10 text-amber-700'
                          : ''
                    }`}
                  >
                    {entry.metrics?.urgency || 'low'} urgency
                  </span>
                </div>
                <p className="mt-1 text-[var(--text-muted)]">
                  Bought {entry.metrics?.orderHits} times | Avg paid {formatCurrency(entry.metrics?.averagePaidPrice || 0)}
                </p>
                <p className="text-[var(--text-muted)]">
                  Next likely reorder:{' '}
                  {entry.metrics?.nextLikelyReorderAt
                    ? formatDate(entry.metrics.nextLikelyReorderAt)
                    : 'insufficient history'}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary" onClick={() => addInsightItemToCart(entry)}>
                    <CartIcon className="h-4 w-4" />
                    Add suggested qty ({entry.metrics?.suggestedQuantity || 1})
                  </button>
                  <p className="inline-flex items-center gap-1 self-center text-xs text-[var(--text-muted)]">
                    <ClockIcon className="h-3.5 w-3.5" />
                    {entry.metrics?.averageReorderDays
                      ? `${entry.metrics.averageReorderDays} day reorder cycle`
                      : 'Cycle learning in progress'}
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            Buy-again intelligence becomes available after paid or delivered orders.
          </p>
        )}
      </section>

      <section className="app-card p-5">
        <h2 className="inline-flex items-center gap-2 text-xl font-bold">
          <BellIcon className="h-5 w-5 text-[var(--accent)]" />
          Price & Restock Watchtower
        </h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Track products and get notified when price drops or stock returns.
        </p>

        {buyerIntelLoading && !priceAlerts.length ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">Loading tracked products...</p>
        ) : null}

        <div className="mt-3 space-y-3">
          {priceAlerts.slice(0, 8).map((alert) => {
            const product = alert.product;
            if (!product?._id) return null;

            const isInStock = alert.status?.isInStock;
            const isTargetReached = alert.status?.priceReached;

            return (
              <article key={product._id} className="rounded-xl border border-[var(--line)] p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{product.name}</p>
                  <span className={`badge ${isInStock ? 'badge-info' : 'border-rose-400/40 bg-rose-500/10 text-rose-700'}`}>
                    {isInStock ? 'In stock' : 'Out of stock'}
                  </span>
                </div>
                <p className="mt-1 text-[var(--text-muted)]">
                  Current price: {formatCurrency(product.pricePerUnit)}{' '}
                  {isTargetReached ? (
                    <span className="ml-1 text-xs font-semibold text-emerald-600">Target reached</span>
                  ) : null}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input w-40"
                    value={alertsDraft[product._id] ?? ''}
                    onChange={(event) =>
                      setAlertsDraft((prev) => ({
                        ...prev,
                        [product._id]: event.target.value,
                      }))
                    }
                    placeholder="Target price"
                  />
                  <button type="button" className="btn-secondary" onClick={() => saveAlertTarget(product._id)}>
                    Save target
                  </button>
                  <button type="button" className="btn-danger" onClick={() => setTrackingState(product, false)}>
                    Stop tracking
                  </button>
                </div>
              </article>
            );
          })}

          {!priceAlerts.length && (
            <p className="text-sm text-[var(--text-muted)]">
              No tracked products yet. Start tracking from your wishlist below.
            </p>
          )}
        </div>

        {untrackedWishlistItems.length ? (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Quick add from wishlist</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {untrackedWishlistItems.slice(0, 8).map((item) => (
                <button key={item._id} type="button" className="btn-secondary" onClick={() => setTrackingState(item, true)}>
                  <BellIcon className="h-4 w-4" />
                  Track {item.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
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
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{item.name}</p>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setTrackingState(item, !alertByProductId.has(item._id))}
                  >
                    {alertByProductId.has(item._id) ? 'Tracking' : 'Track price'}
                  </button>
                </div>
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
