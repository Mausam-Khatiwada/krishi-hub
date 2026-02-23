import { useMemo } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { logoutUser } from '../features/auth/authSlice';
import { formatCurrency } from '../utils/format';
import {
  CartIcon,
  CompassIcon,
  DashboardIcon,
  HeartIcon,
  HomeIcon,
  LeafIcon,
  LogoutIcon,
  MessageCircleIcon,
  SettingsIcon,
  ShieldCheckIcon,
  StoreIcon,
} from './icons/AppIcons';
import ThemeToggle from './ThemeToggle';
import LanguageToggle from './LanguageToggle';
import NotificationPanel from './NotificationPanel';

const Navbar = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const cartCount = useAppSelector((state) => state.cart.items.length);
  const wishlistCount = user?.wishlist?.length || 0;

  const dashboardPath = useMemo(() => {
    if (user?.role === 'farmer') return '/farmer/dashboard';
    if (user?.role === 'admin') return '/admin/dashboard';
    if (user?.role === 'buyer') return '/buyer/dashboard';
    return '/';
  }, [user?.role]);

  const linkClass = ({ isActive }) => `nav-pill ${isActive ? 'active' : ''}`;

  const onLogout = async () => {
    await dispatch(logoutUser());
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 px-3 pt-3">
      <div className="mx-auto max-w-7xl glass-strip px-3 py-3 md:px-4">
        <div className="flex flex-wrap items-center gap-2.5 md:gap-3">
          <Link to="/" className="mr-1 inline-flex items-center gap-2.5 rounded-2xl px-1 py-1 transition hover:bg-[var(--bg-soft)]/60">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-white shadow-lg">
              <LeafIcon className="h-5 w-5" />
            </span>
            <span>
              <p className="font-['Sora'] text-base font-bold tracking-tight text-[var(--accent-3)]">{t('brand')}</p>
              <p className="-mt-0.5 text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">Direct Farm Connect</p>
            </span>
          </Link>

          <nav className="flex flex-wrap items-center gap-1">
            <NavLink to="/" className={linkClass}>
              <HomeIcon className="h-4 w-4" />
              {t('home')}
            </NavLink>
            <NavLink to="/forum" className={linkClass}>
              <CompassIcon className="h-4 w-4" />
              {t('forum')}
            </NavLink>
            {user && (
              <NavLink to="/chat" className={linkClass}>
                <MessageCircleIcon className="h-4 w-4" />
                {t('chat')}
              </NavLink>
            )}
            {user?.role === 'buyer' && (
              <NavLink to="/cart" className={linkClass}>
                <CartIcon className="h-4 w-4" />
                {t('cart')}
                <span className="badge">{cartCount}</span>
              </NavLink>
            )}
            {user?.role === 'buyer' && (
              <NavLink to="/wishlist" className={linkClass}>
                <HeartIcon className="h-4 w-4" />
                Wishlist
                <span className="badge">{wishlistCount}</span>
              </NavLink>
            )}
          </nav>

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <LanguageToggle />
            <ThemeToggle />
            {user && <NotificationPanel />}

            {user ? (
              <>
                <NavLink to={dashboardPath} className={linkClass}>
                  <DashboardIcon className="h-4 w-4" />
                  {t('dashboard')}
                </NavLink>
                <NavLink to="/orders" className={linkClass}>
                  <StoreIcon className="h-4 w-4" />
                  {t('orders')}
                </NavLink>
                <NavLink to="/settings" className={linkClass}>
                  <SettingsIcon className="h-4 w-4" />
                  Settings
                </NavLink>
                <button type="button" onClick={onLogout} className="btn-secondary">
                  <LogoutIcon className="h-4 w-4" />
                  {t('logout')}
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={linkClass}>
                  {t('login')}
                </NavLink>
                <NavLink to="/register" className={linkClass}>
                  {t('register')}
                </NavLink>
              </>
            )}
          </div>
        </div>

        {user && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)]/76 px-3 py-2 text-xs text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--text)]">{user.name}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-soft)] px-2 py-0.5 uppercase tracking-[0.08em] text-[10px] font-bold text-[var(--text-muted)]">
              <ShieldCheckIcon className="h-3.5 w-3.5" />
              {user.role}
            </span>
            <span>
              Wallet:{' '}
              <strong className="text-[var(--accent)]">{formatCurrency(user.walletBalance)}</strong>
            </span>
            {user?.isFarmerVerified && <span className="badge-verified">Verified Farmer</span>}
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
