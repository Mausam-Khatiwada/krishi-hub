import { Link } from 'react-router-dom';
import usePageTitle from '../hooks/usePageTitle';

const NotFoundPage = () => {
  usePageTitle('Page Not Found');

  return (
    <div className="app-card mx-auto max-w-xl p-8 text-center">
      <h1 className="text-5xl font-bold text-[var(--accent)]">404</h1>
      <p className="mt-2 text-lg font-semibold">Page not found</p>
      <p className="mt-2 text-sm text-[var(--text-muted)]">The page you requested does not exist.</p>
      <Link to="/" className="mt-4 inline-block rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">
        Back to Home
      </Link>
    </div>
  );
};

export default NotFoundPage;
