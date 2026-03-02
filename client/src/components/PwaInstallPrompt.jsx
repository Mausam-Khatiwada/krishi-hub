import { useEffect, useState } from 'react';
import { BoltIcon, CheckCircleIcon } from './icons/AppIcons';

const PwaInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setHidden(false);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setHidden(true);
    };

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setHidden(true);
  };

  if (hidden || (!deferredPrompt && isOnline)) return null;

  return (
    <aside className="fixed bottom-4 right-4 z-50 w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-[var(--line)] bg-[var(--surface)]/94 p-3 shadow-[var(--shadow)] backdrop-blur-md">
      {!isOnline ? (
        <div className="flex items-start gap-2 text-sm">
          <CheckCircleIcon className="mt-0.5 h-4 w-4 text-[var(--warning)]" />
          <div>
            <p className="font-semibold">Offline mode active</p>
            <p className="text-xs text-[var(--text-muted)]">
              Cached pages remain available. Live data will sync when connection returns.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Install Krishihub App</p>
          <p className="text-xs text-[var(--text-muted)]">
            Get faster launch, home-screen access, and resilient offline behavior.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={installApp} className="btn-primary !py-2 !text-xs">
              <BoltIcon className="h-4 w-4" />
              Install
            </button>
            <button type="button" onClick={() => setHidden(true)} className="btn-ghost !py-2 !text-xs">
              Dismiss
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};

export default PwaInstallPrompt;
