import { Suspense } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Sidebar, { MobileNav } from '../components/Sidebar';
import Topbar from '../components/Topbar';
import LoadingSkeleton from '../components/LoadingSkeleton';
import './AppLayout.css';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const outlet = useOutlet();

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">Skip to content</a>
      <Sidebar user={user} onLogout={logout} />
      <div className="content-wrap">
        <Topbar user={user} />
        <main
          key={location.pathname}
          id="main"
          className="main-content"
        >
          <div className="page">
            <Suspense fallback={<LoadingSkeleton />}>{outlet}</Suspense>
          </div>
        </main>
      </div>
      <MobileNav user={user} />
    </div>
  );
}
