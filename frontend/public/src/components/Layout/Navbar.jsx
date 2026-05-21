// frontend/src/components/Layout/Navbar.jsx
//
// Top navigation bar — rendered on every protected page.
// Reads all state from useAuth(); accepts no props.
//
// Contains:
//   • TradeLens logo/wordmark → links to role home (ROLE_HOME map)
//   • Authenticated user name + role badge
//   • Country flag indicator (🇹🇿 TZ | 🇿🇲 ZM)
//   • Logout button → POST /api/auth/logout via AuthContext, redirect to /login
//   • Mobile hamburger toggle → opens/closes Sidebar via onMenuToggle callback
//
// Usage:
//   <Navbar onMenuToggle={() => setSidebarOpen((v) => !v)} />

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// ── Role home routes ──────────────────────────────────────────────────────────
const ROLE_HOME = {
  trader:            '/dashboard',
  standards_officer: '/standards',
  customs_officer:   '/verify',
  admin:             '/admin',
};

// ── Role display labels ───────────────────────────────────────────────────────
const ROLE_LABEL = {
  trader:            'Trader',
  standards_officer: 'Standards Officer',
  customs_officer:   'Customs Officer',
  admin:             'Admin',
};

// ── Role badge colour configs ─────────────────────────────────────────────────
const ROLE_BADGE = {
  trader:            { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  standards_officer: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  customs_officer:   { bg: '#fefce8', text: '#854d0e', border: '#fde68a' },
  admin:             { bg: '#fdf4ff', text: '#7e22ce', border: '#e9d5ff' },
};

// ── Country display ───────────────────────────────────────────────────────────
const COUNTRY_DISPLAY = {
  TZ: { flag: '🇹🇿', label: 'Tanzania' },
  ZM: { flag: '🇿🇲', label: 'Zambia' },
};

// ── Sub-component: Role badge ─────────────────────────────────────────────────
const RoleBadge = ({ role }) => {
  const cfg = ROLE_BADGE[role] ?? { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 9px',
        borderRadius: '999px',
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        background: cfg.bg,
        color: cfg.text,
        border: `1px solid ${cfg.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {ROLE_LABEL[role] ?? role}
    </span>
  );
};

// ── Sub-component: Country chip ───────────────────────────────────────────────
const CountryChip = ({ country }) => {
  const c = COUNTRY_DISPLAY[country];
  if (!c) return null;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 600,
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        color: '#374151',
        whiteSpace: 'nowrap',
      }}
    >
      {c.flag} {c.label}
    </span>
  );
};

// ── Sub-component: Hamburger icon ─────────────────────────────────────────────
const HamburgerIcon = ({ open }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={{ display: 'block', transition: 'transform 0.2s' }}
  >
    {open ? (
      // × close icon
      <>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </>
    ) : (
      // ≡ menu icon
      <>
        <line x1="3" y1="6"  x2="21" y2="6"  />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </>
    )}
  </svg>
);

// ── Main component ────────────────────────────────────────────────────────────
const Navbar = ({ onMenuToggle }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [menuOpen, setMenuOpen]     = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const homeRoute = ROLE_HOME[user?.role] ?? '/dashboard';

  // ── Logout handler ────────────────────────────────────────────────────────
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  // ── Hamburger toggle (syncs internal state + lifts to parent) ─────────────
  const handleMenuToggle = () => {
    setMenuOpen((v) => !v);
    onMenuToggle?.();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Keyframes for logout spinner */}
      <style>{`
        @keyframes nb-spin { to { transform: rotate(360deg); } }
      `}</style>

      <header
        role="banner"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          width: '100%',
          background: '#fff',
          borderBottom: '1px solid #e5e7eb',
          /* Subtle shadow to lift it above page content */
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '0 20px',
            height: '58px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >

          {/* ── Left: Logo + wordmark ─────────────────────────────────────── */}
          <Link
            to={homeRoute}
            aria-label="TradeLens — go to home"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              textDecoration: 'none',
              flexShrink: 0,
            }}
          >
            {/* Logomark */}
            <div
              aria-hidden="true"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                background: '#111827',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 900,
                  letterSpacing: '-0.5px',
                  lineHeight: 1,
                  fontFamily: 'Georgia, serif',
                }}
              >
                TL
              </span>
            </div>

            {/* Wordmark — hidden on very small screens */}
            <div
              style={{
                display: 'none',
                flexDirection: 'column',
              }}
              className="nb-wordmark"  // toggled visible via media-query style block below
            >
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 800,
                  color: '#111827',
                  letterSpacing: '-0.3px',
                  lineHeight: 1,
                }}
              >
                TradeLens
              </span>
              <span
                style={{
                  fontSize: '10px',
                  color: '#9ca3af',
                  fontWeight: 500,
                  marginTop: '2px',
                  letterSpacing: '0.02em',
                }}
              >
                Tanzania – Zambia Corridor
              </span>
            </div>
          </Link>

          {/* ── Right: user info + actions ────────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              minWidth: 0,
            }}
          >
            {/* User identity block — hidden on small screens */}
            {user && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: '3px',
                  minWidth: 0,
                }}
                className="nb-user-identity"  // hidden on mobile via style block below
              >
                {/* Name */}
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#111827',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '200px',
                    lineHeight: 1,
                  }}
                >
                  {user.full_name}
                </span>

                {/* Role badge + country chip */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    flexWrap: 'nowrap',
                  }}
                >
                  <RoleBadge role={user.role} />
                  <CountryChip country={user.country} />
                </div>
              </div>
            )}

            {/* ── Logout button — text label on md+, icon-only on mobile ─── */}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              aria-label="Sign out"
              title="Sign out"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: loggingOut ? 'not-allowed' : 'pointer',
                opacity: loggingOut ? 0.5 : 1,
                background: '#fff',
                color: '#374151',
                border: '1px solid #d1d5db',
                transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (!loggingOut) {
                  e.currentTarget.style.background = '#fef2f2';
                  e.currentTarget.style.borderColor = '#fca5a5';
                  e.currentTarget.style.color = '#b91c1c';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#fff';
                e.currentTarget.style.borderColor = '#d1d5db';
                e.currentTarget.style.color = '#374151';
              }}
            >
              {loggingOut ? (
                <span
                  style={{
                    width: '12px',
                    height: '12px',
                    border: '2px solid currentColor',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'nb-spin 0.7s linear infinite',
                  }}
                />
              ) : (
                /* Logout icon */
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              )}
              {/* Label — hidden on very small screens */}
              <span className="nb-logout-label">
                {loggingOut ? 'Signing out…' : 'Sign out'}
              </span>
            </button>

            {/* ── Hamburger — mobile only ─────────────────────────────────── */}
            <button
              onClick={handleMenuToggle}
              aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={menuOpen}
              aria-controls="sidebar-nav"
              className="nb-hamburger"
              style={{
                display: 'none',          /* shown on mobile via style block */
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: menuOpen ? '#f3f4f6' : 'transparent',
                border: '1px solid #e5e7eb',
                cursor: 'pointer',
                color: '#374151',
                flexShrink: 0,
                transition: 'background 0.15s',
              }}
            >
              <HamburgerIcon open={menuOpen} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Responsive style overrides (no external CSS file needed) ──────────── */}
      <style>{`
        /* Show wordmark on sm+ (≥ 480px) */
        @media (min-width: 480px) {
          .nb-wordmark {
            display: flex !important;
          }
        }

        /* Show user identity block on md+ (≥ 768px) */
        @media (min-width: 768px) {
          .nb-user-identity {
            display: flex !important;
          }
        }

        /* Hide logout text label on xs (< 480px) — icon only */
        @media (max-width: 479px) {
          .nb-logout-label {
            display: none;
          }
        }

        /* Show hamburger on sm and below (< 768px) */
        @media (max-width: 767px) {
          .nb-hamburger {
            display: inline-flex !important;
          }
        }
      `}</style>
    </>
  );
};

export default Navbar;
