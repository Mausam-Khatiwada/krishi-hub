import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { addToCart } from '../features/cart/cartSlice';
import { clearWishlist, fetchWishlist, toggleWishlistProduct } from '../features/products/productsSlice';
import { fetchMe } from '../features/auth/authSlice';
import { formatCurrency } from '../utils/format';
import usePageTitle from '../hooks/usePageTitle';
import LoadingSpinner from '../components/LoadingSpinner';
import { CartIcon, HeartFilledIcon } from '../components/icons/AppIcons';

const WishlistPage = () => {
  usePageTitle('Wishlist');

  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { wishlist, wishlistLoading } = useAppSelector((state) => state.products);

  useEffect(() => {
    dispatch(fetchWishlist());
  }, [dispatch]);

  const stats = useMemo(() => {
    const organicCount = wishlist.filter((item) => item.organic).length;
    const availableCount = wishlist.filter((item) => Number(item.quantityAvailable || 0) > 0).length;
    return {
      total: wishlist.length,
      organic: organicCount,
      available: availableCount,
    };
  }, [wishlist]);

  const removeFromWishlist = async (productId) => {
    const action = await dispatch(toggleWishlistProduct(productId));
    if (toggleWishlistProduct.fulfilled.match(action)) {
      toast.success('Removed from wishlist');
      dispatch(fetchMe());
    } else {
      toast.error(action.payload || 'Failed to update wishlist');
    }
  };

  const clearAll = async () => {
    if (!wishlist.length) return;

    const action = await dispatch(clearWishlist());
    if (clearWishlist.fulfilled.match(action)) {
      toast.success('Wishlist cleared');
      dispatch(fetchMe());
    } else {
      toast.error(action.payload || 'Failed to clear wishlist');
    }
  };

  const addWishlistItemToCart = (item) => {
    dispatch(
      addToCart({
        productId: item._id,
        name: item.name,
        pricePerUnit: item.pricePerUnit,
        farmerId: item.farmer?._id,
        image: item.images?.[0]?.url,
      }),
    );
    toast.success('Added to cart');
  };

  if (wishlistLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-5">
      <section className="hero-panel bg-gradient-to-r from-[#2f6030] via-[#2d7f43] to-[#78a944] p-6 text-white">
        <h1 className="text-3xl font-bold">My Wishlist</h1>
        <p className="mt-2 text-sm text-white/90">
          Save and compare products before checkout. Items update in real-time with availability and pricing.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-white/25 bg-white/10 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-white/80">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-white/25 bg-white/10 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-white/80">Organic</p>
            <p className="text-2xl font-bold">{stats.organic}</p>
          </div>
          <div className="rounded-xl border border-white/25 bg-white/10 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-white/80">In Stock</p>
            <p className="text-2xl font-bold">{stats.available}</p>
          </div>
          <div className="rounded-xl border border-white/25 bg-white/10 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-white/80">Role</p>
            <p className="text-2xl font-bold uppercase">{user?.role || '-'}</p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--text-muted)]">
          {wishlist.length ? `${wishlist.length} products saved` : 'No saved products yet'}
        </p>
        <div className="flex gap-2">
          <Link to="/" className="btn-secondary">
            Explore products
          </Link>
          <button type="button" className="btn-danger" onClick={clearAll} disabled={!wishlist.length}>
            Clear wishlist
          </button>
        </div>
      </div>

      {!wishlist.length && (
        <section className="app-card p-6 text-center">
          <HeartFilledIcon className="mx-auto h-9 w-9 text-[var(--accent)]" />
          <h2 className="mt-2 text-lg font-bold">Wishlist is empty</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Tap the heart icon on any product card to save it here.
          </p>
        </section>
      )}

      {wishlist.length > 0 && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {wishlist.map((item) => (
            <article key={item._id} className="app-card overflow-hidden">
              <img
                src={
                  item.images?.[0]?.url ||
                  'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=900'
                }
                alt={item.name}
                className="h-44 w-full object-cover"
                loading="lazy"
              />

              <div className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="line-clamp-2 text-lg font-semibold">{item.name}</h3>
                  {item.organic && <span className="badge">Organic</span>}
                </div>
                <p className="text-sm text-[var(--text-muted)]">{item.category?.name || 'Category'}</p>
                <p className="text-sm text-[var(--text-muted)]">
                  {item.location?.district || '-'}, {item.location?.province || '-'}
                </p>
                <p className="text-base font-bold text-[var(--accent)]">{formatCurrency(item.pricePerUnit)}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  Stock: {item.quantityAvailable ?? 0}
                </p>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Link to={`/products/${item._id}`} className="btn-secondary">
                    View details
                  </Link>
                  <button
                    type="button"
                    onClick={() => addWishlistItemToCart(item)}
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    <CartIcon className="h-4 w-4" />
                    Add to cart
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFromWishlist(item._id)}
                    className="btn-danger inline-flex items-center gap-2"
                  >
                    <HeartFilledIcon className="h-4 w-4" />
                    Remove
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
};

export default WishlistPage;
