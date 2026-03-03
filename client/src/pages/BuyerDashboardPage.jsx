import { useEffect, useMemo, useRef, useState } from 'react';
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
import RoleSectionNav from '../components/RoleSectionNav';
import {
  BellIcon,
  BoltIcon,
  CandleChartIcon,
  CartIcon,
  CheckCircleIcon,
  ClockIcon,
  HeartIcon,
  MessageCircleIcon,
  ShieldCheckIcon,
  SparkleIcon,
  StoreIcon,
  TicketIcon,
  TrendUpIcon,
  UserGroupIcon,
} from '../components/icons/AppIcons';
import { formatCurrency, formatDate } from '../utils/format';
import usePageTitle from '../hooks/usePageTitle';

const WHEEL_SEGMENTS = [
  { key: 'no-reward', label: 'No Reward', color: '#455a4f' },
  { key: 'off-5', label: '5% OFF', color: '#31b665' },
  { key: 'off-8', label: '8% OFF', color: '#2a8a5a' },
  { key: 'off-12', label: '12% OFF', color: '#3aa06f' },
  { key: 'npr-150', label: 'NPR 150', color: '#f3a640' },
  { key: 'npr-250', label: 'NPR 250', color: '#d7842b' },
  { key: 'off-20', label: '20% OFF', color: '#ff7d4d' },
  { key: 'off-25', label: '25% OFF', color: '#f94a3d' },
  { key: 'off-30', label: '30% OFF', color: '#cf2626' },
];

const SEGMENT_SWEEP = 360 / WHEEL_SEGMENTS.length;
const SPIN_ANIMATION_MS = 5600;
const SPIN_CELEBRATION_MS = 1250;
const MIN_SPIN_TURNS = 7;
const normalizeRewardToken = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

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
  const [spinState, setSpinState] = useState(null);
  const [spinResult, setSpinResult] = useState(null);
  const [spinningWheel, setSpinningWheel] = useState(false);
  const [wheelAnimating, setWheelAnimating] = useState(false);
  const [wheelCelebrating, setWheelCelebrating] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const spinFinishTimeoutRef = useRef(null);
  const spinCelebrateTimeoutRef = useRef(null);

  const subscribedFarmers = user?.subscribedFarmers || [];
  const unreadNotifications = notifications.filter((item) => !item.isRead).length;

  const [activeSection, setActiveSection] = useState('overview');

  const dashboardSections = useMemo(
    () => [
      {
        key: 'overview',
        label: 'Overview',
        description: 'KPIs and quick health',
        icon: CheckCircleIcon,
        badge: myOrders.length,
      },
      {
        key: 'rewards',
        label: 'Rewards',
        description: 'Spin wheel and perks',
        icon: SparkleIcon,
        badge: spinState?.canSpinNow ? 'Live' : spinState?.nextEligibleAt ? 'Soon' : '-',
      },
      {
        key: 'intelligence',
        label: 'Intelligence',
        description: 'AI recommendation stack',
        icon: CandleChartIcon,
        badge: buyAgainInsights.length,
      },
      {
        key: 'network',
        label: 'Network',
        description: 'Wishlist and farmers',
        icon: UserGroupIcon,
        badge: subscribedFarmers.length,
      },
      {
        key: 'orders',
        label: 'Orders',
        description: 'Purchase timeline',
        icon: StoreIcon,
        badge: myOrders.length,
      },
    ],
    [buyAgainInsights.length, myOrders.length, spinState?.canSpinNow, spinState?.nextEligibleAt, subscribedFarmers.length],
  );

  const onSectionChange = (sectionKey) => {
    setActiveSection(sectionKey);
    const target = document.getElementById(`buyer-${sectionKey}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };


  const alertByProductId = useMemo(
    () => new Map(priceAlerts.map((alert) => [alert.product?._id, alert])),
    [priceAlerts],
  );

  const untrackedWishlistItems = useMemo(
    () => (wishlist || []).filter((item) => item?._id && !alertByProductId.has(item._id)),
    [alertByProductId, wishlist],
  );
  const wheelGradient = useMemo(() => {
    const stops = WHEEL_SEGMENTS.map((segment, index) => {
      const start = (index * SEGMENT_SWEEP).toFixed(2);
      const end = ((index + 1) * SEGMENT_SWEEP).toFixed(2);
      return `${segment.color} ${start}deg ${end}deg`;
    });
    return `conic-gradient(from -90deg, ${stops.join(', ')})`;
  }, []);

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
        const [buyAgainResponse, alertsResponse, spinResponse] = await Promise.all([
          api.get('/users/insights/buyer-buy-again'),
          api.get('/users/alerts'),
          api.get('/users/engagement/spin-wheel'),
        ]);

        if (!alive) return;

        const nextBuyAgain = buyAgainResponse.data?.insights?.buyAgain || [];
        const nextAlerts = alertsResponse.data?.alerts || [];
        const nextSpin = spinResponse.data?.spin || null;

        setBuyAgainInsights(nextBuyAgain);
        setPriceAlerts(nextAlerts);
        setSpinState(nextSpin);
      } catch (_error) {
        if (alive) {
          setBuyAgainInsights([]);
          setPriceAlerts([]);
          setSpinState(null);
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

  useEffect(
    () => () => {
      if (spinFinishTimeoutRef.current) {
        window.clearTimeout(spinFinishTimeoutRef.current);
      }
      if (spinCelebrateTimeoutRef.current) {
        window.clearTimeout(spinCelebrateTimeoutRef.current);
      }
    },
    [],
  );

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

  const spinDiscountWheel = async () => {
    if (!spinState?.canSpinNow || spinningWheel || wheelAnimating) return;
    setSpinningWheel(true);
    setWheelCelebrating(false);

    try {
      const { data } = await api.post('/users/engagement/spin-wheel');
      const result = data.result || null;
      const rewardKey = result?.rewardKey;
      const rewardLabelToken = normalizeRewardToken(result?.rewardLabel || '');
      const targetIndex =
        WHEEL_SEGMENTS.findIndex((segment) => segment.key === rewardKey) >= 0
          ? WHEEL_SEGMENTS.findIndex((segment) => segment.key === rewardKey)
          : Math.max(
              0,
              WHEEL_SEGMENTS.findIndex((segment) =>
                rewardLabelToken.includes(normalizeRewardToken(segment.label)),
              ),
            );

      const centerAngle = targetIndex * SEGMENT_SWEEP + SEGMENT_SWEEP / 2;
      const desiredRotation = ((360 - centerAngle) % 360 + 360) % 360;
      const fullTurns = 360 * (MIN_SPIN_TURNS + Math.floor(Math.random() * 3));

      setWheelAnimating(true);
      setSpinState(data.spin || null);
      setSpinResult(null);
      setWheelRotation((previous) => {
        const normalizedCurrent = ((previous % 360) + 360) % 360;
        const delta = (desiredRotation - normalizedCurrent + 360) % 360;
        return previous + fullTurns + delta;
      });

      if (spinFinishTimeoutRef.current) {
        window.clearTimeout(spinFinishTimeoutRef.current);
      }

      spinFinishTimeoutRef.current = window.setTimeout(() => {
        setWheelAnimating(false);
        setSpinningWheel(false);
        setSpinResult(result);
        setWheelCelebrating(true);

        if (spinCelebrateTimeoutRef.current) {
          window.clearTimeout(spinCelebrateTimeoutRef.current);
        }

        spinCelebrateTimeoutRef.current = window.setTimeout(() => {
          setWheelCelebrating(false);
        }, SPIN_CELEBRATION_MS);

        if (result?.coupon?.code) {
          toast.success(`Reward unlocked: ${result.coupon.code}`);
        } else {
          toast.success(result?.rewardLabel || 'Spin complete');
        }
      }, SPIN_ANIMATION_MS);
    } catch (error) {
      setWheelAnimating(false);
      setSpinningWheel(false);
      setWheelCelebrating(false);
      toast.error(error.response?.data?.message || 'Spin failed');
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
          <Link to="/" className="hero-power-chip">
            <StoreIcon className="h-4 w-4" />
            Explore Marketplace
          </Link>
          <Link to="/chat" className="hero-power-chip">
            <MessageCircleIcon className="h-4 w-4" />
            Open Chat
          </Link>
          <button type="button" onClick={reorderLatest} className="hero-power-chip">
            <CartIcon className="h-4 w-4" />
            Reorder Latest
          </button>
        </div>
      </section>

      <RoleSectionNav sections={dashboardSections} activeSection={activeSection} onChange={onSectionChange} />

      <section id="buyer-overview" className="grid scroll-mt-28 grid-cols-2 gap-4 md:grid-cols-5">
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

      <section id="buyer-rewards" className="app-card scroll-mt-28 p-5">
        <div className="grid gap-5 xl:grid-cols-[20rem_1fr]">
          <div className={`spin-wheel-stage mx-auto ${wheelAnimating ? 'is-spinning' : ''} ${wheelCelebrating ? 'is-celebrating' : ''}`}>
            <div className="spin-wheel-pointer" />
            <div
              className={`spin-wheel-disc ${wheelAnimating ? 'is-spinning' : ''} ${spinningWheel && !wheelAnimating ? 'is-preparing' : ''}`}
              style={{
                backgroundImage: wheelGradient,
                transform: `rotate(${wheelRotation}deg)`,
              }}
            />
            <div className={`spin-wheel-hub ${wheelCelebrating ? 'is-celebrating' : ''}`}>
              <SparkleIcon className={`h-5 w-5 ${(spinningWheel || wheelAnimating) ? 'animate-spin' : ''}`} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="inline-flex items-center gap-2 text-xl font-bold">
                  <BoltIcon className="h-5 w-5 text-[var(--accent)]" />
                  Spin-the-Wheel Rewards
                </h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  One spin every 24 hours. Higher discounts are intentionally much rarer.
                </p>
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={spinDiscountWheel}
                disabled={!spinState?.canSpinNow || spinningWheel || wheelAnimating}
              >
                <SparkleIcon className={`h-4 w-4 ${(spinningWheel || wheelAnimating) ? 'animate-spin' : ''}`} />
                {wheelAnimating
                  ? 'Spinning...'
                  : spinningWheel
                    ? 'Preparing...'
                    : spinState?.canSpinNow
                      ? 'Spin now'
                      : 'On cooldown'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <article className="rounded-xl border border-[var(--line)] p-3 text-sm">
                <p className="text-xs text-[var(--text-muted)]">Total spins</p>
                <p className="text-xl font-bold">{spinState?.totalSpins || 0}</p>
              </article>
              <article className="rounded-xl border border-[var(--line)] p-3 text-sm">
                <p className="text-xs text-[var(--text-muted)]">Streak</p>
                <p className="text-xl font-bold">{spinState?.streakDays || 0} day(s)</p>
              </article>
              <article className="rounded-xl border border-[var(--line)] p-3 text-sm">
                <p className="text-xs text-[var(--text-muted)]">Last reward</p>
                <p className="font-semibold">{spinState?.lastRewardLabel || 'N/A'}</p>
              </article>
              <article className="rounded-xl border border-[var(--line)] p-3 text-sm">
                <p className="text-xs text-[var(--text-muted)]">Next eligible</p>
                <p className="font-semibold">
                  {spinState?.canSpinNow
                    ? 'Available now'
                    : spinState?.nextEligibleAt
                      ? formatDate(spinState.nextEligibleAt)
                      : '-'}
                </p>
              </article>
            </div>

            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/72 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                Segment Map
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {WHEEL_SEGMENTS.map((segment) => (
                  <span
                    key={segment.key}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] px-2 py-1 text-[11px] font-semibold"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: segment.color }}
                    />
                    {segment.label}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                20%+ rewards are ultra-rare and become less likely as discount value increases.
              </p>
            </div>

            {spinResult && (
              <article className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/70 p-3 text-sm">
                <p className="inline-flex items-center gap-1.5 font-semibold">
                  <TicketIcon className="h-4 w-4 text-[var(--accent)]" />
                  Latest result: {spinResult.rewardLabel}
                </p>
                {spinResult.coupon?.code ? (
                  <p className="mt-1 text-[var(--text-muted)]">
                    Coupon {spinResult.coupon.code} |{' '}
                    {spinResult.coupon.discountType === 'percent'
                      ? `${spinResult.coupon.value}% off`
                      : formatCurrency(spinResult.coupon.value)}{' '}
                    | Expires {formatDate(spinResult.coupon.expiresAt)}
                  </p>
                ) : (
                  <p className="mt-1 text-[var(--text-muted)]">No coupon this round. Try again after cooldown.</p>
                )}
              </article>
            )}
          </div>
        </div>
      </section>

      <section id="buyer-intelligence" className="app-card scroll-mt-28 p-5">
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

      <section id="buyer-network" className="grid scroll-mt-28 grid-cols-1 gap-4 xl:grid-cols-2">
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

      <section id="buyer-orders" className="app-card scroll-mt-28 p-5">
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
