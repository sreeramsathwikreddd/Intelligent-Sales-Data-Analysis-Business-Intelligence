import { Link } from 'react-router-dom';
import { Brand } from './Sidebar';

/** Mobile header: brand on the left, account shortcut on the right. */
export default function Topbar({ user }) {
  const initial = (user?.name || 'U').trim().charAt(0).toUpperCase();
  return (
    <header className="topbar">
      <Link to="/" aria-label="ISDABI Dashboard"><Brand /></Link>
      <Link to="/settings" className="user-avatar" aria-label="Settings and account">{initial}</Link>
    </header>
  );
}
