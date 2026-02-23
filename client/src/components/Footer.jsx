import { Link } from 'react-router-dom';
import { CompassIcon, LeafIcon, MessageCircleIcon, StoreIcon } from './icons/AppIcons';

const Footer = () => (
  <footer className="mt-12 border-t border-[var(--line)] bg-[var(--surface)]/82 backdrop-blur-md">
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 text-sm md:grid-cols-[1.5fr_1fr_1fr] md:items-start">
      <div>
        <p className="inline-flex items-center gap-2 font-['Sora'] text-base font-bold text-[var(--accent-3)]">
          <LeafIcon className="h-4.5 w-4.5 text-[var(--accent)]" />
          Krishihub
        </p>
        <p className="mt-2 max-w-md text-[var(--text-muted)]">
          Direct farm-to-buyer marketplace with transparent pricing, verified farmers, and modern agricultural commerce.
        </p>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Explore</p>
        <div className="space-y-1.5 text-[var(--text-muted)]">
          <Link to="/" className="inline-flex items-center gap-1.5 transition hover:text-[var(--accent)]">
            <StoreIcon className="h-3.5 w-3.5" />
            Marketplace
          </Link>
          <Link to="/forum" className="inline-flex items-center gap-1.5 transition hover:text-[var(--accent)]">
            <CompassIcon className="h-3.5 w-3.5" />
            Community Forum
          </Link>
          <Link to="/chat" className="inline-flex items-center gap-1.5 transition hover:text-[var(--accent)]">
            <MessageCircleIcon className="h-3.5 w-3.5" />
            Farm Chat
          </Link>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Platform</p>
        <p className="text-[var(--text-muted)]">Built for farmers, buyers, and sustainable agriculture in Nepal.</p>
        <p className="mt-2 text-xs text-[var(--text-muted)]/85">Krishihub © {new Date().getFullYear()}</p>
      </div>
    </div>
  </footer>
);

export default Footer;
