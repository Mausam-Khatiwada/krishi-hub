import { Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { removeFromCart, updateCartQty } from '../features/cart/cartSlice';
import { formatCurrency } from '../utils/format';
import usePageTitle from '../hooks/usePageTitle';

const CartPage = () => {
  usePageTitle('Cart');

  const dispatch = useAppDispatch();
  const items = useAppSelector((state) => state.cart.items);

  const total = items.reduce((sum, item) => sum + item.pricePerUnit * item.quantity, 0);

  if (!items.length) {
    return (
      <div className="app-card p-8 text-center">
        <h1 className="text-2xl font-bold">Your cart is empty</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Browse products and add your favorites.</p>
        <Link to="/" className="mt-4 inline-block rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">
          Go to marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
      <section className="app-card p-4">
        <h1 className="text-2xl font-bold">Shopping Cart</h1>

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
              <input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(event) =>
                  dispatch(updateCartQty({ productId: item.productId, quantity: Number(event.target.value) }))
                }
                className="w-20 rounded-lg border border-[var(--line)] px-2 py-1"
              />
              <button
                type="button"
                onClick={() => dispatch(removeFromCart(item.productId))}
                className="rounded-lg border border-red-200 px-3 py-1 text-sm text-red-700"
              >
                Remove
              </button>
            </article>
          ))}
        </div>
      </section>

      <aside className="app-card h-fit p-4">
        <h2 className="text-lg font-bold">Summary</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Subtotal</p>
        <p className="text-2xl font-bold text-[var(--accent)]">{formatCurrency(total)}</p>
        <Link to="/checkout" className="mt-4 inline-block w-full rounded-xl bg-[var(--accent)] px-4 py-2 text-center text-sm font-semibold text-white">
          Proceed to checkout
        </Link>
      </aside>
    </div>
  );
};

export default CartPage;
