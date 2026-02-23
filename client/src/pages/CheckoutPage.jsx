import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { clearCart, setCouponCode } from '../features/cart/cartSlice';
import { clearCheckoutUrl, confirmPayment, createOrder } from '../features/orders/ordersSlice';
import { formatCurrency } from '../utils/format';
import usePageTitle from '../hooks/usePageTitle';

const CheckoutPage = () => {
  usePageTitle('Checkout');

  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const items = useAppSelector((state) => state.cart.items);
  const couponCode = useAppSelector((state) => state.cart.couponCode);
  const { checkoutUrl, loading } = useAppSelector((state) => state.orders);

  const { register, handleSubmit } = useForm({
    defaultValues: {
      fullName: '',
      phone: '',
      district: '',
      province: '',
      addressLine: '',
      paymentMethod: 'stripe',
    },
  });

  const total = items.reduce((sum, item) => sum + item.pricePerUnit * item.quantity, 0);

  useEffect(() => {
    const paymentState = searchParams.get('payment');
    const orderId = searchParams.get('orderId');

    if (paymentState === 'success' && orderId) {
      const sessionId = searchParams.get('session_id');

      if (sessionId) {
        dispatch(confirmPayment(sessionId));
      }

      dispatch(clearCart());
      toast.success('Payment successful');
      navigate('/orders');
    }
  }, [dispatch, navigate, searchParams]);

  useEffect(() => {
    if (checkoutUrl) {
      window.location.href = checkoutUrl;
      dispatch(clearCheckoutUrl());
    }
  }, [checkoutUrl, dispatch]);

  const onSubmit = async (values) => {
    if (!items.length) {
      toast.error('Cart is empty');
      return;
    }

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
      couponCode: couponCode || undefined,
    };

    const action = await dispatch(createOrder(payload));

    if (createOrder.fulfilled.match(action)) {
      if (!action.payload.checkoutUrl) {
        dispatch(clearCart());
        toast.success('Order placed successfully');
        navigate('/orders');
      }
    } else {
      toast.error(action.payload || 'Order failed');
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
      <section className="app-card p-5">
        <h1 className="text-2xl font-bold">Checkout</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <input {...register('fullName')} placeholder="Full name" className="rounded-xl border border-[var(--line)] px-3 py-2" />
          <input {...register('phone')} placeholder="Phone number" className="rounded-xl border border-[var(--line)] px-3 py-2" />
          <input {...register('district')} placeholder="District" className="rounded-xl border border-[var(--line)] px-3 py-2" />
          <input {...register('province')} placeholder="Province" className="rounded-xl border border-[var(--line)] px-3 py-2" />
          <input
            {...register('addressLine')}
            placeholder="Address line"
            className="rounded-xl border border-[var(--line)] px-3 py-2 md:col-span-2"
          />

          <select {...register('paymentMethod')} className="rounded-xl border border-[var(--line)] px-3 py-2 md:col-span-2">
            <option value="stripe">Stripe Card Payment</option>
            <option value="cod">Cash on Delivery</option>
          </select>

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-[var(--accent)] px-4 py-2 font-semibold text-white disabled:opacity-70 md:col-span-2"
          >
            {loading ? 'Processing...' : 'Place order'}
          </button>
        </form>
      </section>

      <aside className="app-card h-fit p-5">
        <h2 className="text-lg font-bold">Order Summary</h2>
        <div className="mt-3 space-y-2 text-sm">
          {items.map((item) => (
            <div key={item.productId} className="flex justify-between gap-3">
              <span className="line-clamp-1">{item.name} x {item.quantity}</span>
              <span>{formatCurrency(item.pricePerUnit * item.quantity)}</span>
            </div>
          ))}
        </div>

        <label htmlFor="coupon" className="mt-4 block text-sm font-medium">
          Coupon code
        </label>
        <input
          id="coupon"
          value={couponCode}
          onChange={(event) => dispatch(setCouponCode(event.target.value.trim().toUpperCase()))}
          placeholder="e.g. FRESH10"
          className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2"
        />

        <div className="mt-4 flex items-center justify-between text-lg font-bold">
          <span>Total</span>
          <span className="text-[var(--accent)]">{formatCurrency(total)}</span>
        </div>
      </aside>
    </div>
  );
};

export default CheckoutPage;
