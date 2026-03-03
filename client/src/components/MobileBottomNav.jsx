import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { useAppSelector } from '../app/hooks';
import {
  BoltIcon,
  CartIcon,
  CompassIcon,
  DashboardIcon,
  HomeIcon,
  MessageCircleIcon,
  SearchIcon,
  SettingsIcon,
  StoreIcon,
} from './icons/AppIcons';

const OPEN_COMMAND_PALETTE_EVENT = 'krishihub:open-command-palette';

const MobileBottomNav = () => {
  const { user } = useAppSelector((state) => state.auth);
  const cartCount = useAppSelector((state) => state.cart.items.length);

  const dashboardPath = useMemo(() => {
    if (user?.role === 'farmer') return '/farmer/dashboard';
    if (user?.role === 'admin') return '/admin/dashboard';
    if (user?.role === 'buyer') return '/buyer/dashboard';
    return '/';
  }, [user?.role]);

  const navItems = useMemo(() => {
    if (!user) {
      return [
        { key: 'home', type: 'link', to: '/', label: 'Home', icon: HomeIcon },
        { key: 'forum', type: 'link', to: '/forum', label: 'Forum', icon: CompassIcon },
        { key: 'search', type: 'action', label: 'Search', icon: SearchIcon },
        { key: 'login', type: 'link', to: '/login', label: 'Login', icon: BoltIcon },
        { key: 'register', type: 'link', to: '/register', label: 'Join', icon: DashboardIcon },
      ];
    }

    if (user.role === 'buyer') {
      return [
        { key: 'home', type: 'link', to: '/', label: 'Home', icon: HomeIcon },
        { key: 'chat', type: 'link', to: '/chat', label: 'Chat', icon: MessageCircleIcon },
        { key: 'cart', type: 'link', to: '/cart', label: 'Cart', icon: CartIcon, badge: cartCount },
        { key: 'orders', type: 'link', to: '/orders', label: 'Orders', icon: StoreIcon },
        { key: 'dashboard', type: 'link', to: dashboardPath, label: 'Dashboard', icon: DashboardIcon },
      ];
    }

    return [
      { key: 'home', type: 'link', to: '/', label: 'Home', icon: HomeIcon },
      { key: 'chat', type: 'link', to: '/chat', label: 'Chat', icon: MessageCircleIcon },
      { key: 'orders', type: 'link', to: '/orders', label: 'Orders', icon: StoreIcon },
      { key: 'dashboard', type: 'link', to: dashboardPath, label: 'Dashboard', icon: DashboardIcon },
      { key: 'settings', type: 'link', to: '/settings', label: 'Settings', icon: SettingsIcon },
    ];
  }, [cartCount, dashboardPath, user]);

  const openCommandPalette = () => {
    window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT));
  };

  return (
    <nav className="mobile-bottom-nav lg:hidden" aria-label="Mobile bottom navigation">
      {navItems.map((item) => {
        const Icon = item.icon;

        if (item.type === 'action') {
          return (
            <button key={item.key} type="button" onClick={openCommandPalette} className="mobile-bottom-action">
              <span className="mobile-bottom-icon-wrap">
                <Icon className="h-4 w-4" />
              </span>
              <span className="mobile-bottom-label">{item.label}</span>
            </button>
          );
        }

        return (
          <NavLink
            key={item.key}
            to={item.to}
            className={({ isActive }) => `mobile-bottom-link ${isActive ? 'active' : ''}`}
          >
            <span className="mobile-bottom-icon-wrap">
              <Icon className="h-4 w-4" />
              {typeof item.badge === 'number' && item.badge > 0 ? (
                <span className="mobile-bottom-badge">{Math.min(item.badge, 99)}</span>
              ) : null}
            </span>
            <span className="mobile-bottom-label">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};

export default MobileBottomNav;
