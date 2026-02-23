import { LeafIcon } from './icons/AppIcons';

const LoadingSpinner = ({ fullScreen = false }) => (
  <div
    className={`flex items-center justify-center ${fullScreen ? 'min-h-screen' : 'py-10'}`}
    aria-label="Loading"
  >
    <div className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
      <span className="absolute inset-0 rounded-2xl border-2 border-transparent border-t-[var(--accent)] animate-spin" />
      <LeafIcon className="h-5 w-5 text-[var(--accent)]" />
    </div>
  </div>
);

export default LoadingSpinner;
