import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { addToCart } from '../features/cart/cartSlice';
import { toggleWishlistProduct } from '../features/products/productsSlice';
import { openChat } from '../features/chat/chatSlice';
import { fetchMe } from '../features/auth/authSlice';
import {
  ArrowRightIcon,
  CartIcon,
  HeartFilledIcon,
  HeartIcon,
  LeafIcon,
  MapPinIcon,
  MessageCircleIcon,
  ShieldCheckIcon,
} from './icons/AppIcons';
import { formatCurrency, truncate } from '../utils/format';

const normalizeWishlistIds = (wishlist = []) =>
  wishlist.map((item) => (typeof item === 'object' && item?._id ? item._id : item));

const ProductCard = ({ product }) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

  const wishlistedIds = useMemo(() => new Set(normalizeWishlistIds(user?.wishlist || [])), [user?.wishlist]);
  const isWishlisted = wishlistedIds.has(product._id);

  const handleAddToCart = () => {
    dispatch(
      addToCart({
        productId: product._id,
        name: product.name,
        pricePerUnit: product.pricePerUnit,
        farmerId: product.farmer?._id,
        image: product.images?.[0]?.url,
      }),
    );
    toast.success('Added to cart');
  };

  const handleWishlist = async () => {
    if (!user) {
      toast.error('Login to manage wishlist');
      return;
    }

    const action = await dispatch(toggleWishlistProduct(product._id));
    if (toggleWishlistProduct.fulfilled.match(action)) {
      dispatch(fetchMe());
      toast.success(action.payload.isWishlisted ? 'Saved to wishlist' : 'Removed from wishlist');
    } else {
      toast.error(action.payload || 'Wishlist update failed');
    }
  };

  const handleChatFarmer = async () => {
    if (!user) {
      toast.error('Login to start chat');
      return;
    }

    if (!product?.farmer?._id) {
      toast.error('Farmer account unavailable');
      return;
    }

    const action = await dispatch(openChat({ participantId: product.farmer._id, productId: product._id }));
    if (openChat.fulfilled.match(action)) {
      navigate(`/chat?chatId=${action.payload._id}`);
    } else {
      toast.error(action.payload || 'Failed to open chat');
    }
  };

  return (
    <article className="app-card group flex h-full flex-col overflow-hidden transition duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow)]">
      <div className="relative overflow-hidden">
        <img
          src={product.images?.[0]?.url || 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=900'}
          alt={product.name}
          className="h-44 w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          loading="lazy"
        />
        {product.organic && (
          <span className="absolute left-3 top-3 badge bg-emerald-100/90 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
            <LeafIcon className="h-3.5 w-3.5" />
            Organic
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="line-clamp-1 text-lg font-semibold">{product.name}</h3>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{product.category?.name || 'Uncategorized'}</p>
          </div>
          <div className="flex items-center gap-1">
            {product.farmer?.isFarmerVerified && (
              <span className="badge-verified">
                <ShieldCheckIcon className="h-3.5 w-3.5" />
                Verified
              </span>
            )}
            {user?.role === 'buyer' && (
              <button
                type="button"
                onClick={handleWishlist}
                className={`icon-button ${
                  isWishlisted ? '!border-[var(--accent)] !text-[var(--accent)] !bg-[var(--bg-soft)]' : ''
                }`}
                aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              >
                {isWishlisted ? (
                  <HeartFilledIcon className="h-4 w-4" />
                ) : (
                  <HeartIcon className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </div>

        <p className="text-sm text-[var(--text-muted)]">{truncate(product.description, 92)}</p>
        <p className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          <MapPinIcon className="h-3.5 w-3.5" />
          {product.location?.district || 'Unknown'}, {product.location?.province || 'Unknown'}
        </p>
        <p className="text-sm font-bold text-[var(--accent)]">{formatCurrency(product.pricePerUnit)}</p>

        <div className="mt-auto flex flex-wrap items-center gap-2">
          <Link to={`/products/${product._id}`} className="btn-secondary">
            Details
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
          {user?.role === 'buyer' && (
            <>
              <button type="button" onClick={handleAddToCart} className="btn-primary">
                <CartIcon className="h-4 w-4" />
                Add
              </button>
              <button type="button" onClick={handleChatFarmer} className="btn-secondary">
                <MessageCircleIcon className="h-4 w-4" />
                Chat
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
};

export default ProductCard;
