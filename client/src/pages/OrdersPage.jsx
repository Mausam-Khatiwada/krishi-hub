import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import api from '../api/client';
import { addToCart } from '../features/cart/cartSlice';
import {
  fetchAdminOrders,
  fetchFarmerOrders,
  fetchMyOrders,
  setFarmerDecision,
  setOrderStatus,
} from '../features/orders/ordersSlice';
import OrderStatusBadge from '../components/OrderStatusBadge';
import {
  CartIcon,
  CheckCircleIcon,
  CreditCardIcon,
  PackageIcon,
  StoreIcon,
  TicketIcon,
  TruckIcon,
} from '../components/icons/AppIcons';
import { formatCurrency, formatDate } from '../utils/format';
import usePageTitle from '../hooks/usePageTitle';

const OrdersPage = () => {
  usePageTitle('Orders');

  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { myOrders, farmerOrders, adminOrders } = useAppSelector((state) => state.orders);
  const [reviewDraft, setReviewDraft] = useState({});

  useEffect(() => {
    if (user?.role === 'buyer') dispatch(fetchMyOrders());
    if (user?.role === 'farmer') dispatch(fetchFarmerOrders());
    if (user?.role === 'admin') dispatch(fetchAdminOrders());
  }, [dispatch, user?.role]);

  const refreshRoleOrders = () => {
    if (user?.role === 'buyer') dispatch(fetchMyOrders());
    if (user?.role === 'farmer') dispatch(fetchFarmerOrders());
    if (user?.role === 'admin') dispatch(fetchAdminOrders());
  };

  const orders = user?.role === 'buyer' ? myOrders : user?.role === 'farmer' ? farmerOrders : adminOrders;

  const reorder = (order) => {
    order.items.forEach((item) => {
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
    toast.success('Order items added to cart');
  };

  const submitReview = async (orderId, item) => {
    const key = `${orderId}:${item.product?._id || item.product}`;
    const draft = reviewDraft[key];
    const rating = Number(draft?.rating || 0);
    const comment = draft?.comment || '';

    if (rating < 1 || rating > 5) {
      return toast.error('Rating must be between 1 and 5');
    }

    try {
      await api.post('/reviews', {
        productId: item.product?._id || item.product,
        orderId,
        rating,
        comment,
      });
      toast.success('Review submitted');
      setReviewDraft((prev) => ({ ...prev, [key]: { rating: '', comment: '' } }));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit review');
    }
  };

  if (!orders.length) {
    return (
      <div className="app-card p-8 text-center">
        <h1 className="inline-flex items-center gap-2 text-2xl font-bold">
          <PackageIcon className="h-6 w-6 text-[var(--accent)]" />
          No orders found
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Orders will appear here once transactions start.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="inline-flex items-center gap-2 text-2xl font-bold">
        <StoreIcon className="h-6 w-6 text-[var(--accent)]" />
        Order Operations
      </h1>

      {orders.map((order) => (
        <article key={order._id} className="app-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold">Order #{order._id.slice(-8)}</h2>
            <OrderStatusBadge status={order.status} />
            <span className="text-sm text-[var(--text-muted)]">{formatDate(order.createdAt)}</span>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
            <div>
              <p className="inline-flex items-center gap-1.5 font-semibold">
                <StoreIcon className="h-4 w-4 text-[var(--accent)]" />
                Buyer
              </p>
              <p className="text-[var(--text-muted)]">{order.buyer?.name || 'N/A'}</p>
            </div>
            <div>
              <p className="inline-flex items-center gap-1.5 font-semibold">
                <PackageIcon className="h-4 w-4 text-[var(--accent)]" />
                Items
              </p>
              <p className="text-[var(--text-muted)]">{order.items?.length || 0}</p>
            </div>
            <div>
              <p className="inline-flex items-center gap-1.5 font-semibold">
                <CreditCardIcon className="h-4 w-4 text-[var(--accent)]" />
                Total
              </p>
              <p className="text-[var(--text-muted)]">{formatCurrency(order.totalAmount)}</p>
            </div>
          </div>

          {!!order.tracking && (
            <div className="mt-3 rounded-xl border border-[var(--line)] p-3 text-sm">
              <p className="inline-flex items-center gap-1.5 font-semibold">
                <TruckIcon className="h-4 w-4 text-[var(--accent)]" />
                Delivery Tracking
              </p>
              <p className="text-[var(--text-muted)]">
                {order.tracking.partnerName || '-'} | {order.tracking.trackingId || '-'} | {order.tracking.status || '-'}
              </p>
              <p className="text-[var(--text-muted)]">Last location: {order.tracking.lastLocation || '-'}</p>
            </div>
          )}

          <div className="mt-3 rounded-xl border border-[var(--line)] p-3">
            {order.items?.map((item) => {
              const reviewKey = `${order._id}:${item.product?._id || item.product}`;
              return (
                <div
                  key={`${order._id}-${item.product}`}
                  className="mb-3 border-b border-[var(--line)] pb-3 text-sm last:mb-0 last:border-none last:pb-0"
                >
                  <div className="flex justify-between gap-2">
                    <p>{item.productName} x {item.quantity}</p>
                    <p>{formatCurrency(item.subtotal)}</p>
                  </div>

                  {user?.role === 'buyer' && ['delivered', 'paid'].includes(order.status) && (
                    <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[80px_1fr_auto]">
                      <input
                        type="number"
                        min="1"
                        max="5"
                        placeholder="Rating"
                        value={reviewDraft[reviewKey]?.rating || ''}
                        onChange={(event) =>
                          setReviewDraft((prev) => ({
                            ...prev,
                            [reviewKey]: { ...prev[reviewKey], rating: event.target.value },
                          }))
                        }
                        className="input"
                      />
                      <input
                        placeholder="Review comment"
                        value={reviewDraft[reviewKey]?.comment || ''}
                        onChange={(event) =>
                          setReviewDraft((prev) => ({
                            ...prev,
                            [reviewKey]: { ...prev[reviewKey], comment: event.target.value },
                          }))
                        }
                        className="input"
                      />
                      <button type="button" onClick={() => submitReview(order._id, item)} className="btn-secondary">
                        Submit review
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'}/orders/${order._id}/invoice`}
              className="btn-secondary"
            >
              <TicketIcon className="h-4 w-4" />
              Invoice PDF
            </a>

            {user?.role === 'buyer' && (
              <button type="button" className="btn-secondary" onClick={() => reorder(order)}>
                <CartIcon className="h-4 w-4" />
                Reorder
              </button>
            )}

            {user?.role === 'farmer' && order.status === 'placed' && (
              <>
                <button
                  type="button"
                  onClick={() => dispatch(setFarmerDecision({ id: order._id, decision: 'accepted' })).then(refreshRoleOrders)}
                  className="btn-primary"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => dispatch(setFarmerDecision({ id: order._id, decision: 'rejected' })).then(refreshRoleOrders)}
                  className="btn-danger"
                >
                  Reject
                </button>
              </>
            )}

            {user?.role === 'farmer' && ['accepted', 'paid'].includes(order.status) && (
              <button
                type="button"
                onClick={() => dispatch(setOrderStatus({ id: order._id, status: 'shipped' })).then(refreshRoleOrders)}
                className="btn-secondary"
              >
                <TruckIcon className="h-4 w-4" />
                Mark shipped
              </button>
            )}

            {user?.role === 'admin' && (
              <>
                <button
                  type="button"
                  onClick={() => dispatch(setOrderStatus({ id: order._id, status: 'shipped' })).then(refreshRoleOrders)}
                  className="btn-secondary"
                >
                  <TruckIcon className="h-4 w-4" />
                  Mark shipped
                </button>
                <button
                  type="button"
                  onClick={() => dispatch(setOrderStatus({ id: order._id, status: 'delivered' })).then(refreshRoleOrders)}
                  className="btn-primary"
                >
                  <CheckCircleIcon className="h-4 w-4" />
                  Mark delivered
                </button>
              </>
            )}
          </div>
        </article>
      ))}
    </div>
  );
};

export default OrdersPage;
