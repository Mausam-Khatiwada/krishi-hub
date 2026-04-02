import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../app/hooks';
import {
  BellIcon,
  CartIcon,
  CommandIcon,
  MessageCircleIcon,
  SparkleIcon,
} from './icons/AppIcons';
import { OPEN_COMMAND_PALETTE_EVENT, OPEN_NOTIFICATIONS_EVENT } from '../constants/events';

const FloatingActions = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const shellRef = useRef(null);

  const { user } = useAppSelector((state) => state.auth);
  const cartCount = useAppSelector((state) => state.cart.items.length);
  const unreadCount = useAppSelector(
    (state) => state.notifications.notifications.filter((item) => !item.isRead).length,
  );

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    const onPointerDown = (event) => {
      if (!shellRef.current || shellRef.current.contains(event.target)) return;
      setOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);

  const actions = useMemo(() => {
    const list = [
      {
        key: 'search',
        label: 'Quick search',
        icon: CommandIcon,
        badge: 0,
        onClick: () => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT)),
      },
      user && {
        key: 'alerts',
        label: 'Alerts',
        icon: BellIcon,
        badge: unreadCount,
        onClick: () => window.dispatchEvent(new Event(OPEN_NOTIFICATIONS_EVENT)),
      },
      user && {
        key: 'chat',
        label: 'Chat',
        icon: MessageCircleIcon,
        badge: 0,
        onClick: () => navigate('/chat'),
      },
      user?.role === 'buyer' && {
        key: 'cart',
        label: 'Cart',
        icon: CartIcon,
        badge: cartCount,
        onClick: () => navigate('/cart'),
      },
    ].filter(Boolean);

    return list;
  }, [cartCount, navigate, unreadCount, user]);

  return (
    <div ref={shellRef} className="floating-actions" aria-label="Quick actions dock">
      <button
        type="button"
        className={`floating-trigger ${open ? 'active' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label="Open quick actions"
      >
        <span className="floating-trigger-icon">
          <SparkleIcon className="h-4 w-4" />
        </span>
        <span className="floating-trigger-text">Quick actions</span>
      </button>
      <div className={`floating-menu ${open ? 'open' : ''}`}>
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.key}
              type="button"
              className="floating-item"
              onClick={() => {
                action.onClick();
                setOpen(false);
              }}
              aria-label={action.label}
            >
              <Icon className="h-4 w-4" />
              <span className="floating-item-label">{action.label}</span>
              {!!action.badge && <span className="floating-badge">{Math.min(action.badge, 99)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default FloatingActions;
