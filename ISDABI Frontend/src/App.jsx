import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ToastProvider } from './components/Toast';
import AppLayout from './layouts/AppLayout';
import './styles/components.css';
import './styles/pages.css';
import './styles/luxury.css';

// Route chunks load on demand; they are also warmed while the browser is idle after sign-in.
const loaders = {
  Login: () => import('./pages/Login'),
  Register: () => import('./pages/Register'),
  Dashboard: () => import('./pages/Dashboard'),
  Analyze: () => import('./pages/Analyze'),
  History: () => import('./pages/History'),
  CallDetail: () => import('./pages/CallDetail'),
  AnalyticsPage: () => import('./pages/AnalyticsPage'),
  Reports: () => import('./pages/Reports'),
  Settings: () => import('./pages/Settings'),
  UploadRecording: () => import('./pages/UploadRecording'),
  RoleBasedReports: () => import('./pages/RoleBasedReports'),
  CompleteAnalytics: () => import('./pages/CompleteAnalytics'),
  ManageUsers: () => import('./pages/ManageUsers'),
};
const Login = lazy(loaders.Login);
const Register = lazy(loaders.Register);
const Dashboard = lazy(loaders.Dashboard);
const Analyze = lazy(loaders.Analyze);
const History = lazy(loaders.History);
const CallDetail = lazy(loaders.CallDetail);
const AnalyticsPage = lazy(loaders.AnalyticsPage);
const Reports = lazy(loaders.Reports);
const Settings = lazy(loaders.Settings);
const UploadRecording = lazy(loaders.UploadRecording);
const RoleBasedReports = lazy(loaders.RoleBasedReports);
const CompleteAnalytics = lazy(loaders.CompleteAnalytics);
const ManageUsers = lazy(loaders.ManageUsers);

function Splash() {
  return <div className="splash" role="status" aria-label="Loading ISDABI"><span className="splash-mark" /></div>;
}

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <Splash />;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function HeadAnalystRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return <Splash />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return user?.role === "head_analyst"
    ? children
    : <Navigate to="/" replace />;
}
function RoleReportsRoute({ children }) { const { user, isAuthenticated, loading } = useAuth(); if(loading)return <Splash />; if(!isAuthenticated)return <Navigate to="/login" replace />; return ['analyst','head_analyst'].includes(user?.role)?children:<Navigate to="/" replace />; }
function SalesRepresentativeRoute({ children }) { const { user, isAuthenticated, loading } = useAuth(); if(loading)return <Splash />; if(!isAuthenticated)return <Navigate to="/login" replace />; return user?.role==='sales_representative'?children:<Navigate to="/" replace />; }
function PublicOnly({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <Splash />;
  return isAuthenticated ? <Navigate to="/" replace /> : children;
}

function Prefetch() {
  const { isAuthenticated } = useAuth();
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const run = () => Object.values(loaders).forEach((load) => load());
    const id = window.requestIdleCallback ? window.requestIdleCallback(run) : setTimeout(run, 1000);
    return () => (window.cancelIdleCallback ? window.cancelIdleCallback(id) : clearTimeout(id));
  }, [isAuthenticated]);
  return null;
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <ToastProvider>
          <Prefetch />
          <Suspense fallback={<Splash />}>
            <Routes>
              <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
              <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
              <Route element={<PrivateRoute><AppLayout /></PrivateRoute>}>
                <Route index element={<Dashboard />} />
                <Route path="analyze" element={<Analyze />} />
                <Route path="history" element={<History />} />
                <Route path="history/:id" element={<CallDetail />} />
                <Route path="analytics" element={<HeadAnalystRoute><CompleteAnalytics /></HeadAnalystRoute>} />
                <Route path="reports" element={<RoleReportsRoute><RoleBasedReports /></RoleReportsRoute>} />
                                <Route path="upload-recording" element={<SalesRepresentativeRoute><UploadRecording /></SalesRepresentativeRoute>} /><Route path="settings" element={<Settings />} />
                <Route
                  path="manage-analysts"
                  element={
                    <HeadAnalystRoute>
                      <ManageUsers role="analyst" />
                    </HeadAnalystRoute>
                  }
                />
                <Route
                  path="manage-sales-representatives"
                  element={
                    <HeadAnalystRoute>
                      <ManageUsers role="sales_representative" />
                    </HeadAnalystRoute>
                  }
                />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </MotionConfig>
  );
}

