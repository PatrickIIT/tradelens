// frontend/src/components/Layout/Sidebar.jsx
//
// Role-scoped side navigation panel.
// On desktop (≥ 768px): rendered as a fixed left rail.
// On mobile (< 768px): slides in as a drawer, toggled by Navbar's hamburger.
//
// Props:
//   isOpen  {boolean}  — controls mobile drawer visibility
//   onClose {function} — called when backdrop or a nav link is tapped on mobile
//
// Usage:
//   <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// ── Role → home route ─────────────────────────────────────────────────────────
const ROLE_HOME = {
  trader:            '/dashboard',
  standards_officer: '/standards',
  customs_officer:   '/verify',
  admin:             '/admin',
};

// ── Role badge colours (mirrors Navbar) ───────────────────────────────────────
const ROLE_BADGE = {
  trader:            { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  standards_officer: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  customs_officer:   { bg: '#fefce8', text: '#854d0e', border: '#fde68a' },
  admin:             { bg: '#fdf4ff', text: '#7e22ce', border: '#e9d5ff' },
};

const ROLE_LABEL = {
  trader:            'Trader',
  standards_officer: 'Standards Officer',
  customs_officer:   'Customs Officer',
  admin:             'Admin',
};

const COUNTRY_DISPLAY = {
  TZ: { flag: '🇹🇿', label: 'Tanzania' },
  ZM: { flag: '🇿🇲', label: 'Zambia' },
};

// ── Nav items per role ────────────────────────────────────────────────────────
const NAV_ITEMS = {
  trader: [
    {
      to: '/dashboard',
      label: 'Dashboard',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
        </svg>
      ),
    },
    {
      to: '/dashboard/documents',
      label: 'My Documents',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
    },
    {
      to: '/dashboard/certificates',
      label: 'My Certificates',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="6" />
          <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
        </svg>
      ),
    },
    {
      to: '/dashboard/compliance',
      label: 'Compliance Status',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 11 12 14 22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      ),
    },
  ],

  standards_officer: [
    {
      to: '/standards',
      label: 'Review Queue',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      ),
    },
    {
      to: '/standards/certificates',
      label: 'Issued Certificates',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="6" />
          <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
        </svg>
      ),
    },
  ],

  customs_officer: [
    {
      to: '/verify',
      label: 'Verify Certificate',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="5" height="5" /><rect x="16" y="3" width="5" height="5" />
          <rect x="3" y="16" width="5" height="5" />
          <line x1="21" y1="16" x2="16" y2="16" /><line x1="21" y1="21" x2="16" y2="21" />
          <line x1="21" y1="11" x2="21" y2="16" />
        </svg>
      ),
    },
    {
      to: '/verify/search',
      label: 'Search by ID',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      ),
    },
    {
      to: '/verify/audit',
      label: 'Audit Trail',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
    },
  ],

  admin: [
    {
      to: '/admin',
      label: 'Overview',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
        </svg>
      ),
    },
    {
      to: '/admin/users',
      label: 'Manage Users',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      to: '/admin/certificates',
      label: 'All Certificates',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="6" />
          <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
        </svg>
      ),
    },
    {
      to: '/admin/audit',
      label: 'Audit Log',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
    },
  ],
};

// ── Section divider label ─────────────────────────────────────────────────────
const SectionLabel = ({ children }) => (
  <p
    style={{
      fontSize: '10px',
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: '#9ca3af',
      padding: '0 12px',
      marginBottom: '4px',
      marginTop: '20px',
    }}
  >
    {children}
  </p>
);

// ── Single nav link ───────────────────────────────────────────────────────────
const NavItem = ({ to, label, icon, onClick }) => (
  <NavLink
    to={to}
    end={to === ROLE_HOME[to.split('/')[1]]}
    onClick={onClick}
    style={({ isActive }) => ({
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '8px 12px',
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: isActive ? 600 : 500,
      color: isActive ? '#111827' : '#6b7280',
      background: isActive ? '#f3f4f6' : 'transparent',
      textDecoration: 'none',
      transition: 'background 0.12s, color 0.12s',
      cursor: 'pointer',
    })}
    onMouseEnter={(e) => {
      if (!e.currentTarget.getAttribute('aria-current')) {
        e.currentTarget.style.background = '#f9fafb';
        e.currentTarget.style.color = '#374151';
      }
    }}
    onMouseLeave={(e) => {
      if (!e.currentTarget.getAttribute('aria-current')) {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = '#6b7280';
      }
    }}
  >
    <span style={{ flexShrink: 0, opacity: 0.75 }}>{icon}</span>
    {label}
  </NavLink>
);

// ── Main component ────────────────────────────────────────────────────────────
const Sidebar = ({ isOpen = false, onClose }) => {
  const navigate  = useNavigate();
  const { user, logout } = useAuth();

  const role     = user?.role ?? 'trader';
  const navItems = NAV_ITEMS[role] ?? [];
  const badgeCfg = ROLE_BADGE[role] ?? { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' };
  const country  = COUNTRY_DISPLAY[user?.country];

  const handleLogout = async () => {
    onClose?.();
    try { await logout(); } catch { /* ignore */ }
    navigate('/login', { replace: true });
  };

  // Shared inner panel (used by both desktop and mobile drawer)
  const panel = (
    <nav
      id="sidebar-nav"
      aria-label="Main navigation"
      style={{
        width: '220px',
        height: '100%',
        background: '#fff',
        borderRight: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 12px',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* ── User identity block ─────────────────────────────────────────── */}
      {user && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '10px',
            background: '#f9fafb',
            border: '1px solid #f3f4f6',
            marginBottom: '8px',
          }}
        >
          <p
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: '#111827',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.3,
            }}
          >
            {user.full_name}
          </p>
          <p
            style={{
              fontSize: '11px',
              color: '#9ca3af',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginTop: '2px',
            }}
          >
            {user.email}
          </p>
          {/* Role badge + country */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: '999px',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                background: badgeCfg.bg,
                color: badgeCfg.text,
                border: `1px solid ${badgeCfg.border}`,
                whiteSpace: 'nowrap',
              }}
            >
              {ROLE_LABEL[role] ?? role}
            </span>
            {country && (
              <span
                style={{
                  fontSize: '11px',
                  color: '#6b7280',
                  fontWeight: 500,
                }}
              >
                {country.flag} {country.label}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Navigation items ────────────────────────────────────────────── */}
      <SectionLabel>Navigation</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {navItems.map((item) => (
          <NavItem
            key={item.to}
            to={item.to}
            label={item.label}
            icon={item.icon}
            onClick={onClose}
          />
        ))}
      </div>

      {/* ── Spacer ──────────────────────────────────────────────────────── */}
      <div style={{ flex: 1 }} />

      {/* ── Corridor indicator ──────────────────────────────────────────── */}
      <div
        style={{
          margin: '0 0 8px',
          padding: '8px 12px',
          borderRadius: '8px',
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          fontSize: '11px',
          color: '#15803d',
          fontWeight: 500,
          textAlign: 'center',
          letterSpacing: '0.01em',
        }}
      >
        🇹🇿 Tanzania – Zambia 🇿🇲
      </div>

      {/* ── Sign out ────────────────────────────────────────────────────── */}
      <button
        onClick={handleLogout}
        aria-label="Sign out"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 500,
          color: '#6b7280',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background 0.12s, color 0.12s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#fef2f2';
          e.currentTarget.style.color = '#b91c1c';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = '#6b7280';
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        Sign out
      </button>
    </nav>
  );

  return (
    <>
      {/* ── Desktop: static left rail (≥ 768px) ─────────────────────────── */}
      <div className="sb-desktop" style={{ display: 'none', height: '100vh', position: 'sticky', top: '58px' }}>
        {panel}
      </div>

      {/* ── Mobile: slide-in drawer (< 768px) ──────────────────────────── */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            aria-hidden="true"
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 40,
              background: 'rgba(0,0,0,0.35)',
              backdropFilter: 'blur(2px)',
            }}
          />
          {/* Drawer */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              zIndex: 45,
              boxShadow: '4px 0 24px rgba(0,0,0,0.12)',
            }}
          >
            {panel}
          </div>
        </>
      )}

      {/* ── Responsive rule: show desktop rail on md+ ───────────────────── */}
      <style>{`
        @media (min-width: 768px) {
          .sb-desktop { display: block !important; }
        }
      `}</style>
    </>
  );
};

export default Sidebar;
