import { motion } from 'framer-motion';
import DeleteAccountCard from '../components/DeleteAccountCard';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/Button';
import PageHeader from '../components/PageHeader';

export default function Settings() {
  const { user, logout } = useAuth();

  return (
    <>
      <PageHeader title="Settings" subtitle="Your account information" />

      <div className="settings-grid">
        <motion.section
          className="card"
          initial={false}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="card-title">
            <h3>Account</h3>
          </div>

          <dl className="setting-list">
            <div className="setting-row">
              <dt>Name</dt>
              <dd>{user?.name || 'â€”'}</dd>
            </div>

            <div className="setting-row">
              <dt>Email</dt>
              <dd>{user?.email || 'â€”'}</dd>
            </div>

            <div className="setting-row">
              <dt>Role</dt>
              <dd>{user?.role || 'â€”'}</dd>
            </div>
          </dl>

          <div className="settings-signout">
            <Button
              variant="danger"
              icon="logout"
              onClick={logout}
              className="settings-signout-button"
            >
              Sign out
            </Button>

      <DeleteAccountCard />
          </div>
        </motion.section>
      </div>
    </>
  );
}

