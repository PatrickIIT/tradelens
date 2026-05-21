// frontend/src/components/Layout/Footer.jsx
//
// Application footer — rendered at the bottom of every protected page.
// Lightweight: branding, corridor info, role-aware support link, and legal line.
// Reads auth state from useAuth() — no props required.
//
// Usage:
//   <Footer />

import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// ── Role → support / help route ───────────────────────────────────────────────
const ROLE_HELP = {
  trader:            '/dashboard/compliance',
  standards_officer: '/standards',
  customs_officer:   '/verify',
  admin:             '/admin',
};

// ── Role label (mirrors Navbar) ───────────────────────────────────────────────
const ROLE_LABEL = {
  trader:            'Trader',
  standards_officer: 'Standards Officer',
  customs_officer:   'Customs Officer',
  admin:             'Admin',
};

// ── Role badge colour config (mirrors Navbar / Sidebar) ──────────────────────
const ROLE_BADGE = {
  trader:            { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  standards_officer: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  customs_officer:   { bg: '#fefce8', text: '#854d0e', border: '#fde68a' },
  admin:             { bg: '#fdf4ff', text: '#7e22ce', border: '#e9d5ff' },
};

// ── Divider dot ───────────────────────────────────────────────────────────────
const Dot = () => (
  <span aria-hidden="true" style={{ color: '#d1d5db', fontSize: '12px', userSelect: 'none' }}>
    ·
  </span>
);

// ── Main component ────────────────────────────────────────────────────────────
const Footer = () => {
  const { user } = useAuth();

  const role     = user?.role;
  const badgeCfg = ROLE_BADGE[role] ?? null;
  const helpPath = ROLE_HELP[role] ?? '/dashboard';
  const year     = new Date().getFullYear();

  return (
    <>
      <footer
        role="contentinfo"
        style={{
          width: '100%',
          borderTop: '1px solid #e5e7eb',
          background: '#fff',
          padding: '18px 20px',
          marginTop: 'auto',            // pushes footer to bottom in flex layouts
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {/* ── Top row: logo + corridor tag + nav links ────────────────── */}
          <div
            className="ft-top"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            {/* Logomark + wordmark */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <div
                aria-hidden="true"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
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
                    fontSize: '11px',
                    fontWeight: 900,
                    letterSpacing: '-0.5px',
                    lineHeight: 1,
                    fontFamily: 'Georgia, serif',
                  }}
                >
                  TL
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <span
                  style={{
                    fontSize: '13px',
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
                    letterSpacing: '0.02em',
                  }}
                >
                  Tanzania – Zambia Corridor
                </span>
              </div>
            </div>

            {/* Nav links — role-aware */}
            <nav
              aria-label="Footer navigation"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                flexWrap: 'wrap',
              }}
            >
              {role && (
                <>
                  <Link to={helpPath} style={linkStyle}>
                    {ROLE_LABEL[role] ?? 'Portal'}
                  </Link>
                  <Dot />
                </>
              )}

              {/* Contact — opens default mail client */}
              
                href="mailto:zda24m007@iitmz.ac.in"
                style={linkStyle}
              >
                Support
              </a>
              <Dot />
              
                href="mailto:zda24b027@iitmz.ac.in"
                style={linkStyle}
              >
                UX Team
              </a>
            </nav>
          </div>

          {/* ── Bottom row: legal line + role badge + institution ───────── */}
          <div
            className="ft-bottom"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            {/* Copyright + institution */}
            <p
              style={{
                fontSize: '11px',
                color: '#9ca3af',
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              © {year} TradeLens — IIT Madras Zanzibar Campus. Academic MVP. All rights reserved.
            </p>

            {/* Right side: active role badge + BR-06 note */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Immutable audit trail indicator (BR-06) */}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '10px',
                  color: '#6b7280',
                  fontWeight: 500,
                }}
              >
                {/* Shield icon */}
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Immutable audit trail (BR-06)
              </span>

              {/* Active session role badge — only when logged in */}
              {role && badgeCfg && (
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 9px',
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
                  {ROLE_LABEL[role]}
                </span>
              )}
            </div>
          </div>
        </div>
      </footer>

      {/* ── Responsive: stack rows on small screens ──────────────────────── */}
      <style>{`
        @media (max-width: 600px) {
          .ft-top, .ft-bottom {
            flex-direction: column;
            align-items: flex-start !important;
          }
        }
      `}</style>
    </>
  );
};

// ── Shared link style ─────────────────────────────────────────────────────────
const linkStyle = {
  fontSize: '12px',
  fontWeight: 500,
  color: '#6b7280',
  textDecoration: 'none',
  padding: '2px 4px',
  borderRadius: '4px',
  transition: 'color 0.12s',
};

export default Footer;
