import { useCallback, useEffect, useMemo, useState } from 'react';
import { userManagement } from '../services/api';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingSkeleton from '../components/LoadingSkeleton';
import PageHeader from '../components/PageHeader';
import Icon from '../components/Icon';
import { useToast } from '../components/Toast';
import './Step2Pages.css';

const CONFIG = {
  analyst: {
    title: 'Manage Analysts',
    subtitle: 'View and manage analyst accounts.',
    empty: 'No analyst accounts found.'
  },
  sales_representative: {
    title: 'Manage Sales Representatives',
    subtitle: 'View and manage sales representative accounts.',
    empty: 'No sales representative accounts found.'
  }
};

function dateText(value) {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'â€”' : date.toLocaleString();
}

export default function ManageUsers({ role }) {
  const config = CONFIG[role] || CONFIG.analyst;
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [working, setWorking] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await userManagement.list(role);
      setUsers(Array.isArray(response?.data?.users) ? response.data.users : []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) => `${user.name || ''} ${user.email || ''}`.toLowerCase().includes(query));
  }, [users, search]);

  const setStatus = async (user) => {
    setWorking(user.id);
    try {
      await userManagement.setStatus(user.id, !user.isActive);
      toast.success(user.isActive ? 'User disabled' : 'User enabled');
      await loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to update user status');
    } finally {
      setWorking('');
    }
  };

  const deleteUser = async (user) => {
    if (!window.confirm(`Delete ${user.name || user.email}? This cannot be undone.`)) return;
    setWorking(user.id);
    try {
      await userManagement.delete(user.id);
      toast.success('User deleted');
      await loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to delete user');
    } finally {
      setWorking('');
    }
  };

  const header = <PageHeader title={config.title} subtitle={config.subtitle} />;

  if (loading && !users.length) return <>{header}<LoadingSkeleton variant="list" rows={4} /></>;
  if (error && !users.length) return <>{header}<ErrorState title="Unable to load users" message={error.response?.data?.message || 'The user-management service could not be reached.'} onRetry={loadUsers} /></>;

  return (
    <>
      {header}
      <div className="step2-shell">
        <div className="step2-toolbar">
          <div className="step2-search">
            <input className="input" type="search" placeholder="Search name or email" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <button className="btn btn-ghost" type="button" onClick={loadUsers} disabled={loading}>Refresh</button>
        </div>

        {!filtered.length ? (
          <EmptyState icon="search" title={search ? 'No users match' : config.empty}>{search ? 'Try a different name or email.' : 'Accounts will appear here when they are registered.'}</EmptyState>
        ) : (
          <div className="step2-table-wrap">
            <table className="step2-table">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Provider</th><th>Status</th><th>Last Login</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id}>
                    <td><strong>{user.name || 'Unnamed user'}</strong></td>
                    <td>{user.email}</td>
                    <td>{user.authProvider || 'local'}</td>
                    <td><span
  className={`step2-status ${
    user.isActive ? 'active' : 'disabled'
  }`}
>
  {user.isActive ? 'Active' : 'Disabled'}
</span></td>
                    <td>{dateText(user.lastLoginAt)}</td>
                    <td>
                      <div className="step2-actions">
                        <button className="btn btn-ghost btn-sm" type="button" disabled={working === user.id} onClick={() => setStatus(user)}>{user.isActive ? 'Disable' : 'Enable'}</button>
                        <button className="btn btn-ghost btn-sm" type="button" disabled={working === user.id} onClick={() => deleteUser(user)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}