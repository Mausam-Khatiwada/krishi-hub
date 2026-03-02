import { Link } from 'react-router-dom';
import { BoltIcon, CandleChartIcon, CompassIcon, LeafIcon, MessageCircleIcon, StoreIcon } from './icons/AppIcons';

const Footer = () => (
  <footer className="mt-14 border-t border-[var(--line)] bg-[var(--surface)]/84 backdrop-blur-md">
    <div className="mx-auto grid max-w-[88rem] gap-6 px-4 py-8 text-sm md:grid-cols-[1.4fr_1fr_1fr_1fr] md:items-start md:px-6">
      <div>
        <p className="inline-flex items-center gap-2 font-display text-base font-bold text-[var(--accent-3)]">
          <LeafIcon className="h-4.5 w-4.5 text-[var(--accent)]" />
          Krishihub
        </p>
        <p className="mt-2 max-w-md text-[var(--text-muted)]">
          Modern farm-to-market commerce platform with intelligent discovery, verified sellers, and real-time buyer-farmer collaboration.
        </p>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          <BoltIcon className="h-3.5 w-3.5" />
          Production Ready UX
        </p>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Platform</p>
        <div className="space-y-1.5 text-[var(--text-muted)]">
          <Link to="/" className="inline-flex items-center gap-1.5 transition hover:text-[var(--accent)]">
            <StoreIcon className="h-3.5 w-3.5" />
            Marketplace
          </Link>
          <Link to="/forum" className="inline-flex items-center gap-1.5 transition hover:text-[var(--accent)]">
            <CompassIcon className="h-3.5 w-3.5" />
            Community
          </Link>
          <Link to="/chat" className="inline-flex items-center gap-1.5 transition hover:text-[var(--accent)]">
            <MessageCircleIcon className="h-3.5 w-3.5" />
            Real-time Chat
          </Link>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Insights</p>
        <div className="space-y-1.5 text-[var(--text-muted)]">
          <p className="inline-flex items-center gap-1.5">
            <CandleChartIcon className="h-3.5 w-3.5" />
            Crop trend analytics
          </p>
          <p className="inline-flex items-center gap-1.5">
            <BoltIcon className="h-3.5 w-3.5" />
            AI suggestions
          </p>
          <p className="inline-flex items-center gap-1.5">
            <LeafIcon className="h-3.5 w-3.5" />
            Organic-first discovery
          </p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Region</p>
        <p className="text-[var(--text-muted)]">Built for farmers, buyers, and sustainable agriculture networks in Nepal.</p>
        <p className="mt-2 text-xs text-[var(--text-muted)]/85">Krishihub © {new Date().getFullYear()}</p>
      </div>
    </div>
  </footer>
);

export default Footer;

