import { Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { clearCart, removeFromCart, updateCartQty } from '../features/cart/cartSlice';
import { formatCurrency } from '../utils/format';
import usePageTitle from '../hooks/usePageTitle';
import { CartIcon, CheckCircleIcon, PackageIcon, TruckIcon } from '../components/icons/AppIcons';

const CartPage = () => {
  usePageTitle('Cart');

  const dispatch = useAppDispatch();
  const items = useAppSelector((state) => state.cart.items);

  const total = items.reduce((sum, item) => sum + item.pricePerUnit * item.quantity, 0);
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);

  const increaseQty = (productId, currentQty) => {
    dispatch(updateCartQty({ productId, quantity: currentQty + 1 }));
  };

  const decreaseQty = (productId, currentQty) => {
    dispatch(updateCartQty({ productId, quantity: Math.max(1, currentQty - 1) }));
  };

  if (!items.length) {
    return (
      <div className="app-card p-8 text-center">
        <h1 className="inline-flex items-center gap-2 text-2xl font-bold">
          <CartIcon className="h-6 w-6 text-[var(--accent)]" />
          Your cart is empty
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Browse products and add your favorites.</p>
        <Link to="/" className="btn-primary mt-4">
          Go to marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
      <section className="app-card p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="inline-flex items-center gap-2 text-2xl font-bold">
            <CartIcon className="h-6 w-6 text-[var(--accent)]" />
            Shopping Cart
          </h1>
          <button type="button" onClick={() => dispatch(clearCart())} className="btn-danger">
            Clear cart
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <article key={item.productId} className="flex flex-col gap-3 rounded-xl border border-[var(--line)] p-3 md:flex-row md:items-center">
              <img
                src={item.image || 'https://images.unsplash.com/photo-1471193945509-9ad0617afabf?w=500'}
                alt={item.name}
                className="h-20 w-full rounded-lg object-cover md:w-24"
              />
              <div className="flex-1">
                <h2 className="font-semibold">{item.name}</h2>
                <p className="text-sm text-[var(--text-muted)]">{formatCurrency(item.pricePerUnit)}</p>
              </div>
              <div className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] p-1">
                <button type="button" className="icon-button !h-7 !w-7 !rounded-md" onClick={() => decreaseQty(item.productId, item.quantity)}>
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(event) =>
                    dispatch(updateCartQty({ productId: item.productId, quantity: Number(event.target.value) }))
                  }
                  className="w-14 bg-transparent text-center text-sm font-semibold"
                />
                <button type="button" className="icon-button !h-7 !w-7 !rounded-md" onClick={() => increaseQty(item.productId, item.quantity)}>
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={() => dispatch(removeFromCart(item.productId))}
                className="btn-danger"
              >
                Remove
              </button>
            </article>
          ))}
        </div>
      </section>

      <aside className="app-card h-fit p-4 md:p-5">
        <h2 className="inline-flex items-center gap-2 text-lg font-bold">
          <PackageIcon className="h-5 w-5 text-[var(--accent)]" />
          Summary
        </h2>
        <div className="mt-3 space-y-2 text-sm text-[var(--text-muted)]">
          <p className="flex items-center justify-between">
            <span>Items</span>
            <strong className="text-[var(--text)]">{items.length}</strong>
          </p>
          <p className="flex items-center justify-between">
            <span>Total units</span>
            <strong className="text-[var(--text)]">{totalUnits}</strong>
          </p>
          <p className="flex items-center justify-between">
            <span>Estimated delivery</span>
            <strong className="inline-flex items-center gap-1 text-[var(--text)]">
              <TruckIcon className="h-4 w-4" />
              2-4 days
            </strong>
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/60 p-3">
          <p className="text-sm text-[var(--text-muted)]">Subtotal</p>
          <p className="text-2xl font-bold text-[var(--accent)]">{formatCurrency(total)}</p>
        </div>

        <Link to="/checkout" className="btn-primary mt-4 w-full justify-center">
          <CheckCircleIcon className="h-4 w-4" />
          Proceed to checkout
        </Link>
      </aside>
    </div>
  );
};

export default CartPage;
