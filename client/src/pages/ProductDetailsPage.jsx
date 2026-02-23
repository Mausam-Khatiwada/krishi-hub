import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { fetchProductById, subscribeFarmer, toggleWishlistProduct } from '../features/products/productsSlice';
import { addToCart } from '../features/cart/cartSlice';
import { fetchMe } from '../features/auth/authSlice';
import { openChat } from '../features/chat/chatSlice';
import { formatCurrency, formatDate } from '../utils/format';
import usePageTitle from '../hooks/usePageTitle';
import LoadingSpinner from '../components/LoadingSpinner';
import { CartIcon, HeartFilledIcon, HeartIcon, MessageCircleIcon } from '../components/icons/AppIcons';

const ProductDetailsPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const dispatch = useAppDispatch();
  const { product } = useAppSelector((state) => state.products);
  const { user } = useAppSelector((state) => state.auth);

  usePageTitle(product?.name || 'Product');

  const wishlistIds = useMemo(
    () =>
      (user?.wishlist || []).map((item) => (typeof item === 'object' && item?._id ? item._id : item)),
    [user?.wishlist],
  );
  const isWishlisted = wishlistIds.includes(product?._id);

  useEffect(() => {
    dispatch(fetchProductById(id));
  }, [dispatch, id]);

  if (!product) {
    return <LoadingSpinner />;
  }

  const onAddCart = () => {
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

  const onWishlist = async () => {
    const action = await dispatch(toggleWishlistProduct(product._id));
    if (toggleWishlistProduct.fulfilled.match(action)) {
      dispatch(fetchMe());
      toast.success(action.payload.isWishlisted ? 'Saved to wishlist' : 'Removed from wishlist');
    } else {
      toast.error(action.payload || 'Failed to update wishlist');
    }
  };

  const onSubscribe = async () => {
    const action = await dispatch(subscribeFarmer(product.farmer?._id));
    if (subscribeFarmer.fulfilled.match(action)) {
      dispatch(fetchMe());
      toast.success('Farmer subscription updated');
    } else {
      toast.error(action.payload || 'Failed to update subscription');
    }
  };

  const onOpenChat = async () => {
    const action = await dispatch(
      openChat({ participantId: product.farmer?._id, productId: product._id }),
    );

    if (openChat.fulfilled.match(action)) {
      navigate(`/chat?chatId=${action.payload._id}`);
    } else {
      toast.error(action.payload || 'Failed to start chat');
    }
  };

  const mapSrc =
    product.location?.lat && product.location?.lng
      ? `https://www.google.com/maps?q=${product.location.lat},${product.location.lng}&z=13&output=embed`
      : `https://www.google.com/maps?q=${encodeURIComponent(
          `${product.location?.district || ''} ${product.location?.province || ''} Nepal`,
        )}&output=embed`;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <img
          src={product.images?.[0]?.url || 'https://images.unsplash.com/photo-1518843875459-f738682238a6?w=1200'}
          alt={product.name}
          className="app-card h-80 w-full object-cover"
        />

        {product.videos?.[0]?.url && (
          <video controls className="app-card h-64 w-full object-cover">
            <source src={product.videos[0].url} type={product.videos[0].mimeType || 'video/mp4'} />
          </video>
        )}
      </div>

      <div className="space-y-4">
        <div className="app-card p-5">
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">{product.description}</p>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <p>
              <span className="font-semibold">Category:</span> {product.category?.name}
            </p>
            <p>
              <span className="font-semibold">Price:</span> {formatCurrency(product.pricePerUnit)}
            </p>
            <p>
              <span className="font-semibold">Available:</span> {product.quantityAvailable}
            </p>
            <p>
              <span className="font-semibold">Harvest Date:</span> {formatDate(product.harvestDate)}
            </p>
            <p>
              <span className="font-semibold">Organic:</span> {product.organic ? 'Yes' : 'No'}
            </p>
            <p>
              <span className="font-semibold">Location:</span> {product.location?.district},{' '}
              {product.location?.province}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {user?.role === 'buyer' && (
              <>
                <button type="button" onClick={onAddCart} className="btn-primary inline-flex items-center gap-2">
                  <CartIcon className="h-4 w-4" />
                  Add to Cart
                </button>
                <button type="button" onClick={onWishlist} className="btn-secondary inline-flex items-center gap-2">
                  {isWishlisted ? (
                    <HeartFilledIcon className="h-4 w-4 text-[var(--accent)]" />
                  ) : (
                    <HeartIcon className="h-4 w-4" />
                  )}
                  {isWishlisted ? 'Wishlisted' : 'Wishlist'}
                </button>
                <button type="button" onClick={onSubscribe} className="btn-secondary">
                  Subscribe Farmer
                </button>
                <button type="button" onClick={onOpenChat} className="btn-secondary inline-flex items-center gap-2">
                  <MessageCircleIcon className="h-4 w-4" />
                  Chat with Farmer
                </button>
              </>
            )}

            {product.farmer?.isFarmerVerified && <span className="badge-verified">Verified Farmer</span>}
          </div>
        </div>

        <div className="app-card overflow-hidden p-3">
          <h2 className="mb-2 text-lg font-semibold">Farm Location</h2>
          <iframe
            title="Farm map"
            src={mapSrc}
            className="h-64 w-full rounded-xl border border-[var(--line)]"
            loading="lazy"
          />
        </div>
      </div>
    </div>
  );
};

export default ProductDetailsPage;
