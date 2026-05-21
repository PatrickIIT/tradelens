// frontend/src/App.jsx
// TradeLens — Tanzania–Zambia corridor
// Role-based routing: trader → TraderDashboard, standards_officer → StandardsOfficer,
//                     customs_officer → CustomsVerify, admin → AdminPanel
// Auth: Supabase JWT via AuthContext

import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// ── Lazy-load pages (code-split per role) ────────────────────────────────────
const Login              = lazy(() => import('./pages/Login'));
const TraderDashboard    = lazy(() => import('./pages/TraderDashboard'));
const StandardsOfficer   = lazy(() => import('./pages/StandardsOfficer'));
const CustomsVerify      = lazy(() => import('./pages/CustomsVerify'));
const AdminPanel         = lazy(() => import('./pages/AdminPanel'));

// ── Role → page mapping ───────────────────────────────────────────────────────
const ROLE_HOME = {
  trader:            '/dashboard',
  standards_officer: '/standards',
  customs_officer:   '/verify',
  admin:             '/admin',
};

// ── Full-screen loader ────────────────────────────────────────────────────────
const PageLoader = () => (
  <div
    style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f9f9f7',
      gap: '16px',
    }}
  >
    {/* Animated logo mark */}
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="10" fill="#111" />
      <path d="M10 20 L20 10 L30 20 L20 30 Z" fill="none" stroke="#fff" strokeWidth="2" />
      <circle cx="20" cy="20" r="3" fill="#4ade80" />
    </svg>
    <div
      style={{
        width: '120px',
        height: '3px',
        background: '#e5e7eb',
        borderRadius: '999px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '100%',
          width: '40%',
          background: '#111',
          borderRadius: '999px',
          animation: 'slide 1.2s ease-in-out infinite',
        }}
      />
    </div>
    <style>{`
      @keyframes slide {
        0%   { transform: translateX(-100%); }
        50%  { transform: translateX(200%); }
        100% { transform: translateX(200%); }
      }
    `}</style>
  </div>
);

// ── Guard: redirect unauthenticated users to /login ───────────────────────────
const RequireAuth = () => {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!user)   return <Navigate to="/login" replace />;

  return <Outlet />;
};

// ── Guard: redirect authenticated users away from /login ─────────────────────
const RequireGuest = () => {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (user)    return <Navigate to={ROLE_HOME[user.role] ?? '/login'} replace />;

  return <Outlet />;
};

// ── Guard: enforce single allowed role, redirect others to their home ─────────
const RequireRole = ({ role }) => {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!user)   return <Navigate to="/login" replace />;

  if (user.role !== role) {
    return <Navigate to={ROLE_HOME[user.role] ?? '/login'} replace />;
  }

  return <Outlet />;
};

// ── Root redirect: /  →  role home or /login ─────────────────────────────────
const RootRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!user)   return <Navigate to="/login" replace />;

  return <Navigate to={ROLE_HOME[user.role] ?? '/login'} replace />;
};

// ── 404 ───────────────────────────────────────────────────────────────────────
const NotFound = () => (
  <div
    style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f9f9f7',
      fontFamily: 'system-ui, sans-serif',
      gap: '12px',
      color: '#111',
    }}
  >
    <p style={{ fontSize: '72px', fontWeight: 800, lineHeight: 1, margin: 0 }}>404</p>
    <p style={{ color: '#6b7280', margin: 0 }}>Page not found.</p>
    <a
      href="/"
      style={{
        marginTop: '8px',
        padding: '10px 24px',
        background: '#111',
        color: '#fff',
        borderRadius: '8px',
        textDecoration: 'none',
        fontSize: '14px',
        fontWeight: 600,
      }}
    >
      Go home
    </a>
  </div>
);

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>

            {/* ── Root ─────────────────────────────────────────────────────── */}
            <Route path="/" element={<RootRedirect />} />

            {/* ── Guest-only (login page) ───────────────────────────────────── */}
            <Route element={<RequireGuest />}>
              <Route path="/login" element={<Login />} />
            </Route>

            {/* ── Protected: any authenticated user ────────────────────────── */}
            <Route element={<RequireAuth />}>

              {/* Trader portal ─ US-01, US-02, US-03 */}
              <Route element={<RequireRole role="trader" />}>
                <Route path="/dashboard" element={<TraderDashboard />} />
              </Route>

              {/* Standards officer portal ─ US-04 */}
              <Route element={<RequireRole role="standards_officer" />}>
                <Route path="/standards" element={<StandardsOfficer />} />
              </Route>

              {/* Customs officer portal ─ US-05, US-06 */}
              <Route element={<RequireRole role="customs_officer" />}>
                <Route path="/verify" element={<CustomsVerify />} />
              </Route>

              {/* Admin panel ─ US-07 */}
              <Route element={<RequireRole role="admin" />}>
                <Route path="/admin" element={<AdminPanel />} />
              </Route>

            </Route>

            {/* ── 404 ──────────────────────────────────────────────────────── */}
            <Route path="*" element={<NotFound />} />

          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
