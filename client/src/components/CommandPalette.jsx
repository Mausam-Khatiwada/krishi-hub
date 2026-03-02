import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../app/hooks';
import {
  BoltIcon,
  CartIcon,
  CommandIcon,
  CompassIcon,
  DashboardIcon,
  HeartIcon,
  HomeIcon,
  MessageCircleIcon,
  SettingsIcon,
  ShoppingBagIcon,
  StoreIcon,
} from './icons/AppIcons';

const OPEN_EVENT = 'krishihub:open-command-palette';

const CommandPalette = () => {
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const actions = useMemo(() => {
    const baseActions = [
      {
        id: 'home',
        label: 'Go to Home',
        hint: 'H',
        icon: HomeIcon,
        keywords: 'landing products marketplace',
        to: '/',
      },
      {
        id: 'forum',
        label: 'Open Forum',
        hint: 'F',
        icon: CompassIcon,
        keywords: 'community discussion',
        to: '/forum',
      },
      {
        id: 'products',
        label: 'Browse Marketplace',
        hint: 'M',
        icon: StoreIcon,
        keywords: 'shop products buy',
        to: '/',
      },
    ];

    if (!user) {
      return [
        ...baseActions,
        {
          id: 'login',
          label: 'Sign In',
          hint: 'L',
          icon: BoltIcon,
          keywords: 'auth access account',
          to: '/login',
        },
        {
          id: 'register',
          label: 'Create Account',
          hint: 'R',
          icon: ShoppingBagIcon,
          keywords: 'signup farmer buyer',
          to: '/register',
        },
      ];
    }

    const authenticated = [
      {
        id: 'orders',
        label: 'Open Orders',
        hint: 'O',
        icon: ShoppingBagIcon,
        keywords: 'purchase history',
        to: '/orders',
      },
      {
        id: 'settings',
        label: 'Account Settings',
        hint: 'S',
        icon: SettingsIcon,
        keywords: 'profile preferences security',
        to: '/settings',
      },
    ];

    if (user.role === 'buyer') {
      authenticated.push(
        {
          id: 'buyer-dashboard',
          label: 'Buyer Dashboard',
          hint: 'D',
          icon: DashboardIcon,
          keywords: 'analytics buyer',
          to: '/buyer/dashboard',
        },
        {
          id: 'cart',
          label: 'Open Cart',
          hint: 'C',
          icon: CartIcon,
          keywords: 'checkout basket',
          to: '/cart',
        },
        {
          id: 'wishlist',
          label: 'Open Wishlist',
          hint: 'W',
          icon: HeartIcon,
          keywords: 'favorites saved',
          to: '/wishlist',
        },
      );
    }

    if (user.role === 'farmer') {
      authenticated.push(
        {
          id: 'farmer-dashboard',
          label: 'Farmer Dashboard',
          hint: 'D',
          icon: DashboardIcon,
          keywords: 'farm sales products',
          to: '/farmer/dashboard',
        },
        {
          id: 'chat',
          label: 'Open Farmer Chat',
          hint: 'C',
          icon: MessageCircleIcon,
          keywords: 'messages buyers',
          to: '/chat',
        },
      );
    }

    if (user.role === 'admin') {
      authenticated.push({
        id: 'admin-dashboard',
        label: 'Admin Dashboard',
        hint: 'D',
        icon: CommandIcon,
        keywords: 'moderation reports',
        to: '/admin/dashboard',
      });
    }

    if (user.role === 'buyer' || user.role === 'farmer') {
      authenticated.push({
        id: 'chat',
        label: 'Open Chat',
        hint: 'C',
        icon: MessageCircleIcon,
        keywords: 'messages support farmers buyers',
        to: '/chat',
      });
    }

    return [...baseActions, ...authenticated];
  }, [user]);

  const filteredActions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return actions;

    return actions.filter((action) =>
      `${action.label} ${action.keywords}`.toLowerCase().includes(normalized),
    );
  }, [actions, query]);

  useEffect(() => {
    if (activeIndex >= filteredActions.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, filteredActions.length]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const isShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
      if (isShortcut) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }

      if (!open) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((prev) =>
          filteredActions.length ? (prev + 1) % filteredActions.length : 0,
        );
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((prev) =>
          filteredActions.length ? (prev - 1 + filteredActions.length) % filteredActions.length : 0,
        );
      }

      if (event.key === 'Enter' && filteredActions[activeIndex]) {
        event.preventDefault();
        navigate(filteredActions[activeIndex].to);
        setOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, filteredActions, navigate, open]);

  useEffect(() => {
    const handleOpenEvent = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, handleOpenEvent);
    return () => window.removeEventListener(OPEN_EVENT, handleOpenEvent);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close command palette"
        className="command-backdrop"
        onClick={() => setOpen(false)}
      />
      <section className="command-panel">
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Type a command, route, or feature..."
          className="command-input"
        />
        <div className="command-list">
          {!filteredActions.length && (
            <p className="px-3 py-5 text-sm text-[var(--text-muted)]">No results for your query.</p>
          )}
          {filteredActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => {
                  navigate(action.to);
                  setOpen(false);
                }}
                className={`command-item w-full text-left ${index === activeIndex ? 'active' : ''}`}
              >
                <span className="inline-flex items-center gap-2.5">
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{action.label}</span>
                </span>
                <span className="command-hint">{action.hint}</span>
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
};

export default CommandPalette;
