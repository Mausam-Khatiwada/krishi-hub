const baseProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
};

export const HeartIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...baseProps} className={className}>
    <path d="M20.8 5.8a5 5 0 0 0-7.1 0L12 7.5l-1.7-1.7a5 5 0 1 0-7.1 7.1l1.7 1.7L12 21.7l7.1-7.1 1.7-1.7a5 5 0 0 0 0-7.1z" />
  </svg>
);

export const HeartFilledIcon = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      fill="currentColor"
      d="M20.8 5.8a5 5 0 0 0-7.1 0L12 7.5l-1.7-1.7a5 5 0 1 0-7.1 7.1l1.7 1.7L12 21.7l7.1-7.1 1.7-1.7a5 5 0 0 0 0-7.1z"
    />
  </svg>
);

export const MessageCircleIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...baseProps} className={className}>
    <path d="M20 12a8 8 0 0 1-8 8H5l-2 2v-7a8 8 0 1 1 17 0z" />
  </svg>
);

export const SendIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...baseProps} className={className}>
    <path d="m22 2-7 20-4-9-9-4z" />
    <path d="M22 2 11 13" />
  </svg>
);

export const SearchIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...baseProps} className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3-3" />
  </svg>
);

export const UserGroupIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...baseProps} className={className}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.9" />
    <path d="M16 3.1a4 4 0 0 1 0 7.8" />
  </svg>
);

export const SparkleIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...baseProps} className={className}>
    <path d="m12 3 1.8 4.8L18 9.6l-4.2 1.8L12 16l-1.8-4.6L6 9.6l4.2-1.8z" />
    <path d="M4 3v3" />
    <path d="M2.5 4.5h3" />
    <path d="M20 16v5" />
    <path d="M17.5 18.5h5" />
  </svg>
);

export const CartIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...baseProps} className={className}>
    <circle cx="9" cy="20" r="1.6" />
    <circle cx="18" cy="20" r="1.6" />
    <path d="M3 4h2l2.3 11.3a1 1 0 0 0 1 .8h9.8a1 1 0 0 0 1-.8L21 7H6" />
  </svg>
);

export const SettingsIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...baseProps} className={className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);

export const ClockIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...baseProps} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const BellIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...baseProps} className={className}>
    <path d="M15 18H6a2 2 0 0 1-2-2v-1a6 6 0 1 1 12 0v1a2 2 0 0 1-2 2H9" />
    <path d="M9.5 21a2.5 2.5 0 0 0 5 0" />
  </svg>
);

export const SunIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...baseProps} className={className}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.9 4.9 1.4 1.4" />
    <path d="m17.7 17.7 1.4 1.4" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m4.9 19.1 1.4-1.4" />
    <path d="m17.7 6.3 1.4-1.4" />
  </svg>
);

export const MoonIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...baseProps} className={className}>
    <path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z" />
  </svg>
);

export const GlobeIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...baseProps} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3.5 9h17" />
    <path d="M3.5 15h17" />
    <path d="M12 3c2.2 2.5 3.4 5.7 3.4 9S14.2 18.5 12 21" />
    <path d="M12 3c-2.2 2.5-3.4 5.7-3.4 9s1.2 6.5 3.4 9" />
  </svg>
);

export const LeafIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...baseProps} className={className}>
    <path d="M19 3c-7 1-12 5-13 12 0 4.4 3.6 8 8 8 7-1 12-5 13-12 0-4.4-3.6-8-8-8z" />
    <path d="M7 17c2-4 5.8-7.8 10-10" />
  </svg>
);

export const MapPinIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...baseProps} className={className}>
    <path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.4" />
  </svg>
);

export const ArrowRightIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...baseProps} className={className}>
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </svg>
);

export const HomeIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...baseProps} className={className}>
    <path d="m3 11 9-8 9 8" />
    <path d="M5 10v10h14V10" />
    <path d="M10 20v-5h4v5" />
  </svg>
);

export const CompassIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...baseProps} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2.2 6.2-6.2 2.2 2.2-6.2z" />
  </svg>
);

export const DashboardIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...baseProps} className={className}>
    <rect x="3" y="3" width="7" height="7" rx="1.8" />
    <rect x="14" y="3" width="7" height="11" rx="1.8" />
    <rect x="3" y="14" width="7" height="7" rx="1.8" />
    <rect x="14" y="17" width="7" height="4" rx="1.8" />
  </svg>
);

export const LogoutIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...baseProps} className={className}>
    <path d="M10 17v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M8 12h13" />
    <path d="m17 7 4 5-4 5" />
  </svg>
);

export const TrendUpIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...baseProps} className={className}>
    <path d="M3 17 10 10l4 4 7-8" />
    <path d="M16 6h5v5" />
  </svg>
);

export const ShieldCheckIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...baseProps} className={className}>
    <path d="m12 3 8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export const StoreIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...baseProps} className={className}>
    <path d="M3 10h18" />
    <path d="m4 10 1-5h14l1 5" />
    <path d="M5 10v9h14v-9" />
    <path d="M10 19v-5h4v5" />
  </svg>
);

export const UserIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...baseProps} className={className}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);

export const MailIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...baseProps} className={className}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);

export const LockIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...baseProps} className={className}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 1 1 8 0v3" />
  </svg>
);

export const PackageIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...baseProps} className={className}>
    <path d="m3 8 9-5 9 5-9 5z" />
    <path d="M3 8v8l9 5 9-5V8" />
    <path d="M12 13v8" />
  </svg>
);

export const TruckIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...baseProps} className={className}>
    <path d="M1 6h12v10H1z" />
    <path d="M13 9h5l3 3v4h-8z" />
    <circle cx="6" cy="18" r="2" />
    <circle cx="18" cy="18" r="2" />
  </svg>
);

export const TicketIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...baseProps} className={className}>
    <path d="M4 7h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4z" />
    <path d="M9 7v12" />
  </svg>
);

export const CreditCardIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...baseProps} className={className}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M2 10h20" />
    <path d="M7 15h3" />
  </svg>
);

export const ShoppingBagIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...baseProps} className={className}>
    <path d="M6 8h12l-1.2 12H7.2z" />
    <path d="M9 8V6a3 3 0 1 1 6 0v2" />
  </svg>
);

export const CheckCircleIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...baseProps} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12.5 2.4 2.4 4.6-4.8" />
  </svg>
);

export const ThermometerIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...baseProps} className={className}>
    <path d="M10 14.5V5a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0z" />
    <path d="M12 11v5" />
  </svg>
);

export const DropletIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...baseProps} className={className}>
    <path d="M12 3s6 6.6 6 10a6 6 0 1 1-12 0c0-3.4 6-10 6-10z" />
  </svg>
);
