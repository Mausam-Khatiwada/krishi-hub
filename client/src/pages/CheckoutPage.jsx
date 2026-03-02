import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { clearCart, setCouponCode } from '../features/cart/cartSlice';
import { clearCheckoutUrl, confirmPayment, createOrder } from '../features/orders/ordersSlice';
import usePageTitle from '../hooks/usePageTitle';
import { formatCurrency } from '../utils/format';
import {
  CheckCircleIcon,
  CreditCardIcon,
  LockIcon,
  MapPinIcon,
  PackageIcon,
  PhoneIcon,
  TicketIcon,
  TruckIcon,
  UserIcon,
} from '../components/icons/AppIcons';

const fallbackValues = {
  fullName: '',
  phone: '',
  district: '',
  province: '',
  addressLine: '',
  paymentMethod: 'stripe',
};

const deriveCheckoutDefaults = (user) => {
  if (!user) return fallbackValues;

  const defaultAddress = user.addresses?.find((item) => item.isDefault) || user.addresses?.[0];
  return {
    fullName: defaultAddress?.fullName || user.name || '',
    phone: defaultAddress?.phone || user.phone || '',
    district: defaultAddress?.district || user.location?.district || '',
    province: defaultAddress?.province || user.location?.province || '',
    addressLine: defaultAddress?.addressLine || '',
    paymentMethod: user?.buyerProfile?.preferredPaymentMethod === 'cod' ? 'cod' : 'stripe',
  };
};

const formatShortDate = (value) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(value);

const CheckoutPage = () => {
  usePageTitle('Checkout');

  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAppSelector((state) => state.auth);
  const items = useAppSelector((state) => state.cart.items);
  const couponCode = useAppSelector((state) => state.cart.couponCode);
  const { checkoutUrl, loading } = useAppSelector((state) => state.orders);

  const [couponInput, setCouponInput] = useState(couponCode || '');
  const checkoutDefaults = useMemo(() => deriveCheckoutDefaults(user), [user]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: checkoutDefaults,
  });

  const paymentMethod = watch('paymentMethod');

  const subtotal = items.reduce((sum, item) => sum + item.pricePerUnit * item.quantity, 0);
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  const uniqueFarmers = useMemo(
    () => new Set(items.map((item) => item.farmerId).filter(Boolean)).size,
    [items],
  );

  const deliveryWindow = useMemo(() => {
    const from = new Date();
    from.setDate(from.getDate() + 2);
    const to = new Date();
    to.setDate(to.getDate() + 5);
    return `${formatShortDate(from)} - ${formatShortDate(to)}`;
  }, []);

  useEffect(() => {
    setValue('fullName', checkoutDefaults.fullName || '');
    setValue('phone', checkoutDefaults.phone || '');
    setValue('district', checkoutDefaults.district || '');
    setValue('province', checkoutDefaults.province || '');
    setValue('addressLine', checkoutDefaults.addressLine || '');
    setValue('paymentMethod', checkoutDefaults.paymentMethod || 'stripe');
  }, [checkoutDefaults, setValue]);

  useEffect(() => {
    setCouponInput(couponCode || '');
  }, [couponCode]);

  useEffect(() => {
    const paymentState = searchParams.get('payment');
    const orderId = searchParams.get('orderId');

    if (paymentState === 'cancelled') {
      toast.error('Payment cancelled. You can retry anytime.');
      navigate('/checkout', { replace: true });
      return;
    }

    if (paymentState === 'success' && orderId) {
      const sessionId = searchParams.get('session_id');
      if (sessionId) {
        dispatch(confirmPayment(sessionId));
      }
      dispatch(clearCart());
      toast.success('Payment successful');
      navigate('/orders', { replace: true });
    }
  }, [dispatch, navigate, searchParams]);

  useEffect(() => {
    if (checkoutUrl) {
      window.location.href = checkoutUrl;
      dispatch(clearCheckoutUrl());
    }
  }, [checkoutUrl, dispatch]);

  const applyCoupon = () => {
    const normalized = couponInput.trim().toUpperCase();
    dispatch(setCouponCode(normalized));
    if (normalized) {
      toast.success('Coupon saved and will be validated at checkout');
    } else {
      toast.success('Coupon removed');
    }
  };

  const onSubmit = async (values) => {
    if (!items.length) {
      toast.error('Cart is empty');
      return;
    }

    const normalizedCoupon = couponInput.trim().toUpperCase();
    dispatch(setCouponCode(normalizedCoupon));

    const payload = {
      items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      shippingAddress: {
        fullName: values.fullName,
        phone: values.phone,
        district: values.district,
        province: values.province,
        country: 'Nepal',
        addressLine: values.addressLine,
      },
      paymentMethod: values.paymentMethod,
      couponCode: normalizedCoupon || undefined,
    };

    const action = await dispatch(createOrder(payload));
    if (createOrder.fulfilled.match(action)) {
      if (!action.payload.checkoutUrl) {
        dispatch(clearCart());
        toast.success('Order placed successfully');
        navigate('/orders');
      }
      return;
    }

    toast.error(action.payload || 'Order failed');
  };

  if (!items.length) {
    return (
      <section className="app-card p-8 text-center">
        <h1 className="inline-flex items-center gap-2 text-2xl font-bold">
          <PackageIcon className="h-6 w-6 text-[var(--accent)]" />
          Your cart is empty
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Add products to your cart to continue checkout.
        </p>
        <Link to="/" className="btn-primary mt-4">
          Browse marketplace
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="hero-panel border-none bg-gradient-to-r from-[#134a2d] via-[#207040] to-[#77b54f] p-6 text-white">
        <div className="grid gap-4 md:grid-cols-[1.5fr_1fr] md:items-end">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em]">
              <LockIcon className="h-3.5 w-3.5" />
              Secure Checkout
            </p>
            <h1 className="mt-3 font-['Sora'] text-3xl font-bold leading-tight md:text-4xl">
              Complete your order
            </h1>
            <p className="mt-2 text-sm text-white/90">
              Review shipping details, choose payment, and confirm your farm-fresh delivery.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-white/20 bg-white/12 p-3 text-center">
              <p className="text-[10px] uppercase tracking-[0.08em] text-white/75">Items</p>
              <p className="text-xl font-bold">{totalUnits}</p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/12 p-3 text-center">
              <p className="text-[10px] uppercase tracking-[0.08em] text-white/75">Farmers</p>
              <p className="text-xl font-bold">{uniqueFarmers}</p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/12 p-3 text-center">
              <p className="text-[10px] uppercase tracking-[0.08em] text-white/75">Total</p>
              <p className="text-xl font-bold">{formatCurrency(subtotal)}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.65fr_1fr]">
        <section className="app-card p-5 md:p-6">
          <h2 className="panel-title inline-flex items-center gap-2">
            <MapPinIcon className="h-5 w-5 text-[var(--accent)]" />
            Shipping Information
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label>
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                Full name
              </span>
              <span className="relative mt-1 block">
                <UserIcon className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--text-muted)]" />
                <input
                  {...register('fullName', {
                    required: 'Full name is required',
                    minLength: { value: 2, message: 'Please enter a valid name' },
                  })}
                  placeholder="Full name"
                  className="input pl-9"
                />
              </span>
              {errors.fullName && (
                <p className="mt-1 text-xs font-medium text-[var(--danger)]">{errors.fullName.message}</p>
              )}
            </label>

            <label>
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                Phone number
              </span>
              <span className="relative mt-1 block">
                <PhoneIcon className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--text-muted)]" />
                <input
                  {...register('phone', {
                    required: 'Phone number is required',
                    minLength: { value: 6, message: 'Phone number is too short' },
                  })}
                  placeholder="98XXXXXXXX"
                  className="input pl-9"
                />
              </span>
              {errors.phone && (
                <p className="mt-1 text-xs font-medium text-[var(--danger)]">{errors.phone.message}</p>
              )}
            </label>

            <label>
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                District
              </span>
              <span className="relative mt-1 block">
                <MapPinIcon className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--text-muted)]" />
                <input
                  {...register('district', { required: 'District is required' })}
                  placeholder="District"
                  className="input pl-9"
                />
              </span>
              {errors.district && (
                <p className="mt-1 text-xs font-medium text-[var(--danger)]">{errors.district.message}</p>
              )}
            </label>

            <label>
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                Province
              </span>
              <span className="relative mt-1 block">
                <MapPinIcon className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--text-muted)]" />
                <input
                  {...register('province', { required: 'Province is required' })}
                  placeholder="Province"
                  className="input pl-9"
                />
              </span>
              {errors.province && (
                <p className="mt-1 text-xs font-medium text-[var(--danger)]">{errors.province.message}</p>
              )}
            </label>

            <label className="md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                Address line
              </span>
              <textarea
                {...register('addressLine', {
                  required: 'Address line is required',
                  minLength: { value: 8, message: 'Please add a complete address' },
                })}
                placeholder="Ward, street and delivery details"
                rows="3"
                className="textarea mt-1 resize-none"
              />
              {errors.addressLine && (
                <p className="mt-1 text-xs font-medium text-[var(--danger)]">{errors.addressLine.message}</p>
              )}
            </label>

            <div className="md:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                Payment method
              </p>
              <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                <label
                  className={`cursor-pointer rounded-xl border p-3 transition ${
                    paymentMethod === 'stripe'
                      ? 'border-[var(--accent)] bg-[var(--bg-soft)]'
                      : 'border-[var(--line)] bg-[var(--surface)]'
                  }`}
                >
                  <input
                    type="radio"
                    value="stripe"
                    {...register('paymentMethod')}
                    className="sr-only"
                  />
                  <p className="inline-flex items-center gap-2 text-sm font-semibold">
                    <CreditCardIcon className="h-4 w-4 text-[var(--accent)]" />
                    Card payment (Stripe)
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Secure hosted checkout page for card payments.
                  </p>
                </label>

                <label
                  className={`cursor-pointer rounded-xl border p-3 transition ${
                    paymentMethod === 'cod'
                      ? 'border-[var(--accent)] bg-[var(--bg-soft)]'
                      : 'border-[var(--line)] bg-[var(--surface)]'
                  }`}
                >
                  <input type="radio" value="cod" {...register('paymentMethod')} className="sr-only" />
                  <p className="inline-flex items-center gap-2 text-sm font-semibold">
                    <TruckIcon className="h-4 w-4 text-[var(--accent)]" />
                    Cash on delivery
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Pay in cash when your order arrives.
                  </p>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 md:col-span-2">
              <button type="submit" disabled={loading} className="btn-primary">
                <CheckCircleIcon className="h-4 w-4" />
                {loading ? 'Processing...' : paymentMethod === 'stripe' ? 'Continue to payment' : 'Place order'}
              </button>
              <Link to="/cart" className="btn-secondary">
                Back to cart
              </Link>
            </div>
          </form>
        </section>

        <aside className="app-card h-fit p-5">
          <h2 className="panel-title inline-flex items-center gap-2">
            <PackageIcon className="h-5 w-5 text-[var(--accent)]" />
            Order Summary
          </h2>

          <div className="mt-3 space-y-2">
            {items.map((item) => (
              <div
                key={item.productId}
                className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)]/78 px-2.5 py-2"
              >
                <img
                  src={
                    item.image ||
                    'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=300'
                  }
                  alt={item.name}
                  className="h-11 w-11 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-semibold">{item.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">Qty {item.quantity}</p>
                </div>
                <p className="text-sm font-semibold">
                  {formatCurrency(item.pricePerUnit * item.quantity)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/70 p-3">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              <TicketIcon className="h-3.5 w-3.5 text-[var(--accent)]" />
              Coupon
            </p>
            <div className="mt-2 flex items-center gap-2">
              <div className="relative flex-1">
                <TicketIcon className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--text-muted)]" />
                <input
                  value={couponInput}
                  onChange={(event) => setCouponInput(event.target.value.toUpperCase())}
                  placeholder="e.g. FRESH10"
                  className="input pl-9 uppercase"
                />
              </div>
              <button type="button" onClick={applyCoupon} className="btn-secondary !px-3">
                Apply
              </button>
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              Discount is validated during order creation.
            </p>
          </div>

          <div className="mt-4 space-y-2 text-sm">
            <p className="flex items-center justify-between text-[var(--text-muted)]">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </p>
            <p className="flex items-center justify-between text-[var(--text-muted)]">
              <span>Coupon</span>
              <span>{couponCode || 'Not applied'}</span>
            </p>
            <p className="flex items-center justify-between border-t border-[var(--line)] pt-2 text-base font-bold">
              <span>Total payable</span>
              <span className="text-[var(--accent)]">{formatCurrency(subtotal)}</span>
            </p>
          </div>

          <div className="mt-4 space-y-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/70 p-3 text-xs text-[var(--text-muted)]">
            <p className="inline-flex items-center gap-1.5">
              <TruckIcon className="h-3.5 w-3.5 text-[var(--accent)]" />
              Estimated delivery: {deliveryWindow}
            </p>
            <p className="inline-flex items-center gap-1.5">
              <LockIcon className="h-3.5 w-3.5 text-[var(--accent)]" />
              Checkout is protected with encrypted payment processing.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default CheckoutPage;
