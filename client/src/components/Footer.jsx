import { Link } from 'react-router-dom';
import {
  BoltIcon,
  CandleChartIcon,
  CompassIcon,
  LeafIcon,
  MailIcon,
  MessageCircleIcon,
  PhoneIcon,
  ShieldCheckIcon,
  StoreIcon,
} from './icons/AppIcons';

const Footer = () => (
  <footer className="footer-shell">
    <div className="footer-hero">
      <div className="footer-brand">
        <p className="footer-logo">
          <span className="footer-logo-icon">
            <LeafIcon className="h-4.5 w-4.5" />
          </span>
          Krishihub
        </p>
        <p className="footer-copy">
          Modern farm-to-market commerce with verified sellers, AI signals, and real-time buyer-farmer collaboration.
        </p>
        <div className="footer-badges">
          <span className="footer-pill">
            <ShieldCheckIcon className="h-3.5 w-3.5" />
            Verified supply network
          </span>
          <span className="footer-pill">
            <BoltIcon className="h-3.5 w-3.5" />
            Production-grade UX
          </span>
          <span className="footer-pill">
            <CandleChartIcon className="h-3.5 w-3.5" />
            Live price intelligence
          </span>
        </div>
      </div>
      <div className="footer-cta">
        <p className="footer-cta-title">Weekly market pulse</p>
        <p className="footer-cta-subtitle">
          Get crop insights, demand spikes, and new harvest alerts straight to your inbox.
        </p>
        <div className="footer-input-row">
          <input className="input" placeholder="Enter your email" type="email" />
          <button type="button" className="btn-primary">Subscribe</button>
        </div>
        <div className="footer-contact">
          <span>
            <MailIcon className="h-3.5 w-3.5" />
            support@krishihub.com
          </span>
          <span>
            <PhoneIcon className="h-3.5 w-3.5" />
            +977 01-555-0112
          </span>
        </div>
      </div>
    </div>

    <div className="footer-grid">
      <div>
        <p className="footer-heading">Marketplace</p>
        <div className="footer-links">
          <Link to="/" className="footer-link">
            <StoreIcon className="h-3.5 w-3.5" />
            Explore products
          </Link>
          <Link to="/forum" className="footer-link">
            <CompassIcon className="h-3.5 w-3.5" />
            Community forum
          </Link>
          <Link to="/chat" className="footer-link">
            <MessageCircleIcon className="h-3.5 w-3.5" />
            Live chat hub
          </Link>
        </div>
      </div>

      <div>
        <p className="footer-heading">Intelligence</p>
        <div className="footer-links">
          <p className="footer-text">Demand forecasting</p>
          <p className="footer-text">Dynamic pricing</p>
          <p className="footer-text">Smart restock signals</p>
        </div>
      </div>

      <div>
        <p className="footer-heading">Support</p>
        <div className="footer-links">
          <p className="footer-text">Buyer protection</p>
          <p className="footer-text">Farmer onboarding</p>
          <p className="footer-text">Dispute resolution</p>
        </div>
      </div>

      <div>
        <p className="footer-heading">Region</p>
        <p className="footer-text">
          Built for farmers, buyers, and sustainable agriculture networks in Nepal.
        </p>
        <p className="footer-small">Krishihub © {new Date().getFullYear()}</p>
      </div>
    </div>
  </footer>
);

export default Footer;
