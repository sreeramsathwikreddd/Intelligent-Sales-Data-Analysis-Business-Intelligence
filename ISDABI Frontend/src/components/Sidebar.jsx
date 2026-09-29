import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import Icon from './Icon';

export const ROLE_NAV_ITEMS = {
  analyst: [
    { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
    { to: '/analyze', label: 'Call Analysis', icon: 'wave' },
    { to: '/history', label: 'Call History', icon: 'history' },
    { to: '/reports', label: 'Role Based Reports', icon: 'reports' },
    { to: '/settings', label: 'Settings', icon: 'settings' },
  ],
  sales_representative: [
    { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
    { to: '/analyze', label: 'Call Analysis', icon: 'wave' },
    { to: '/history', label: 'Call History', icon: 'history' },
    { to: '/upload-recording', label: 'Upload Recordings', icon: 'upload' },
    { to: '/settings', label: 'Settings', icon: 'settings' },
  ],
  head_analyst: [
    { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
    { to: '/analyze', label: 'Call Analysis', icon: 'wave' },
    { to: '/history', label: 'Call History', icon: 'history' },
    { to: '/analytics', label: 'Complete Analytics', icon: 'analytics' },
    { to: '/reports', label: 'Role Based Reports', icon: 'reports' },
    { to: '/manage-analysts', label: 'Manage Analysts', icon: 'history' },
    { to: '/manage-sales-representatives', label: 'Manage Sales Representatives', icon: 'analytics' },
    { to: '/settings', label: 'Settings', icon: 'settings' },
  ],
};
const spring = { type: 'spring', stiffness: 520, damping: 40 };

export function Brand() {
  return (
    <span className="brand">
      <span className="brand-logo" aria-hidden="true"><i /><i /><i /><i /></span>
      <span className="brand-text">
        <span className="brand-mark">ISDABI</span>
        <span className="brand-sub">Sales Intelligence</span>
      </span>
    </span>
  );
}

export default function Sidebar({ user, onLogout }) {
  const initial = (user?.name || 'U').trim().charAt(0).toUpperCase();
  return (
    <aside className="sidebar" aria-label="Primary">
      <NavLink to="/" className="sidebar-brand" aria-label="ISDABI Dashboard"><Brand /></NavLink>
      <nav className="sidebar-nav">
        {(ROLE_NAV_ITEMS[user?.role] || ROLE_NAV_ITEMS.analyst).map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className="nav-item" data-tip={item.label} data-tip-side="right">
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="nav-active" className="nav-active" transition={spring} />}
                <span className="nav-icon"><Icon name={item.icon} /></span>
                <span className="nav-label">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="user-chip">
          <span className="user-avatar" aria-hidden="true">{initial}</span>
          <span className="who">
            <span className="user-name truncate">{user?.name}</span>
            <span className="user-role truncate">{user?.role || user?.email}</span>
          </span>
        </div>
        <button type="button" className="logout-btn" onClick={onLogout} aria-label="Sign out" data-tip="Sign out" data-tip-side="right">
          <Icon name="logout" />
          <span className="logout-label">Sign out</span>
        </button>
      </div>
    </aside>
  );
}

export function MobileNav({ user }) {
  const items = (ROLE_NAV_ITEMS[user?.role] || ROLE_NAV_ITEMS.analyst).filter((i) => i.to !== '/settings');
  return (
    <nav className="mobile-nav" aria-label="Primary">
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className="mnav-item" aria-label={item.label}>
          {({ isActive }) => (
            <>
              {isActive && <motion.span layoutId="mnav-active" className="mnav-active" transition={spring} />}
              <span className="mnav-icon"><Icon name={item.icon} /></span>
              <span className="mnav-label">{item.label.replace('Call ', '')}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

