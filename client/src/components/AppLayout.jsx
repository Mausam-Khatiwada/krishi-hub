import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import CommandPalette from './CommandPalette';
import PwaInstallPrompt from './PwaInstallPrompt';

const AppLayout = () => {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const updateScrollProgress = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const progress = height > 0 ? Math.min((scrollTop / height) * 100, 100) : 0;
      setScrollProgress(progress);
    };

    updateScrollProgress();
    window.addEventListener('scroll', updateScrollProgress, { passive: true });

    return () => window.removeEventListener('scroll', updateScrollProgress);
  }, []);

  return (
    <div className="min-h-screen overflow-x-clip">
      <div className="top-progress" style={{ width: `${scrollProgress}%` }} />
      <Navbar />
      <main className="mx-auto max-w-[88rem] px-4 py-6 page-enter md:px-6 md:py-8">
        <Outlet />
      </main>
      <Footer />
      <CommandPalette />
      <PwaInstallPrompt />
    </div>
  );
};

export default AppLayout;

