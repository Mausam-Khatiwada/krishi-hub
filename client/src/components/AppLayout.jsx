import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

const AppLayout = () => (
  <div className="min-h-screen overflow-x-clip">
    <Navbar />
    <main className="mx-auto max-w-7xl px-4 py-6 page-enter md:px-5 md:py-7">
      <Outlet />
    </main>
    <Footer />
  </div>
);

export default AppLayout;
