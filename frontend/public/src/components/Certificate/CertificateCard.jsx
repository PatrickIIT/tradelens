// frontend/src/components/Certificate/CertificateCard.jsx
// Displays a single TradeLens certificate as a card.
// Used in: TraderDashboard (US-03), StandardsOfficer (US-04), CustomsVerify (US-05/06)
//
// Props:
//   certificate  — Certificate object from GET /api/certificates/:id or VerificationResult.certificate
//   role         — 'trader' | 'standards_officer' | 'customs_officer' | 'admin'
//   onDownload   — () => void  called when trader clicks Download PDF (US-03)
//   onAudit      — (certId: string) => void  called when officer clicks Audit Trail (BR-06)
//   onRevoke     — (certId: string) => void  called when standards_officer/admin clicks Revoke
//   verificationMeta — optional { verification_status, status_colour, status_message, response_ms }
//                      present when rendered from CustomsVerify

import { useState } from 'react';

// ── Country helpers ───────────────────────────────────────────────────────────
const COUNTRY_LABEL = { TZ: '🇹🇿 Tanzania', ZM: '🇿🇲 Zambia' };
const COUNTRY_SHORT = { TZ: 'TZ', ZM: 'ZM' };

// ── Certificate type label ────────────────────────────────────────────────────
const CERT_TYPE_LABEL = {
  TBS:  'Tanzania Bureau of Standards',
  ZABS: 'Zambia Bureau of Standards',
};

// ── Status config ─────────────────────────────────────────────────────────────
const CERT_STATUS_CONFIG = {
  active:  { label: 'Active',  bg: '#dcfce7', text: '#15803d', dot: '#22c55e' },
  revoked: { label: 'Revoked', bg: '#fee2e2', text: '#b91c1c', dot: '#ef4444' },
  expired: { label: 'Expired', bg: '#fef9c3', text: '#854d0e', dot: '#eab308' },
};

// Verification status config (customs portal overlay)
const VERIFY_STATUS_CONFIG = {
  valid:     { label: 'Valid',      bg: '#dcfce7', text: '#15803d', border: '#86efac' },
  expired:   { label: 'Expired',   bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
  revoked:   { label: 'Revoked',   bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' },
  invalid:   { label: 'Invalid',   bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' },
  not_found: { label: 'Not Found', bg: '#f3f4f6', text: '#374151', border: '#d1d5db' },
};

// ── Utility: format date ──────────────────────────────────────────────────────
const formatDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

// ── Utility: truncate SHA-256 hash ────────────────────────────────────────────
const truncateHash = (hash) => {
  if (!hash) return '—';
  return `${hash.slice(0, 8)}…${hash.slice(-8)}`;
};

// ── Sub-component: status badge ───────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const cfg = CERT_STATUS_CONFIG[status] ?? CERT_STATUS_CONFIG.expired;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 10px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        background: cfg.bg,
        color: cfg.text,
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: cfg.dot,
          flexShrink: 0,
        }}
      />
      {cfg.label}
    </span>
  );
};

// ── Sub-component: info row ───────────────────────────────────────────────────
const InfoRow = ({ label, value, mono = false, fullWidth = false }) => (
  <div style={{ gridColumn: fullWidth ? '1 / -1' : undefined }}>
    <p style={{ margin: 0, fontSize: '10px', fontWeight: 600, color: '#9ca3af',
                textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>
      {label}
    </p>
    <p style={{
      margin: 0,
      fontSize: '13px',
      color: '#111827',
      fontFamily: mono ? "'Courier New', monospace" : 'inherit',
      wordBreak: mono ? 'break-all' : 'normal',
    }}>
      {value ?? '—'}
    </p>
  </div>
);

// ── Sub-component: icon button ────────────────────────────────────────────────
const IconButton = ({ onClick, disabled, loading, children, variant = 'default', title }) => {
  const styles = {
    default: {
      background: '#111827',
      color: '#fff',
      border: 'none',
    },
    outline: {
      background: '#fff',
      color: '#374151',
      border: '1px solid #d1d5db',
    },
    danger: {
      background: '#fff',
      color: '#b91c1c',
      border: '1px solid #fca5a5',
    },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 14px',
        borderRadius: '8px',
        fontSize: '12px',
        fontWeight: 600,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.45 : 1,
        transition: 'opacity 0.15s, background 0.15s',
        ...styles[variant],
      }}
    >
      {loading ? (
        <span style={{
          width: '12px', height: '12px',
          border: '2px solid currentColor',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          display: 'inline-block',
          animation: 'spin 0.7s linear infinite',
        }} />
      ) : children}
    </button>
  );
};

// ── Sub-component: copy button for hash ───────────────────────────────────────
const CopyHashButton = ({ hash }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API not available (e.g. HTTP)
    }
  };

  return (
    <button
      onClick={handleCopy}
      title="Copy full SHA-256 hash"
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '11px',
        color: copied ? '#15803d' : '#6b7280',
        fontWeight: 600,
        transition: 'color 0.2s',
      }}
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const CertificateCard = ({
  certificate,
  role,
  onDownload,
  onAudit,
  onRevoke,
  verificationMeta,
}) => {
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (!certificate) return null;

  const {
    id,
    certificate_number,
    product_name,
    certificate_type,
    issuing_country,
    destination_country,
    valid_until,
    status,
    sha256_hash,
    created_at,
    revocation_reason,
    revoked_at,
    trader,
    issued_by,
  } = certificate;

  // ── Roles allowed to see audit trail and revoke ───────────────────────────
  const canAudit   = ['standards_officer', 'customs_officer', 'admin'].includes(role);
  const canRevoke  = ['standards_officer', 'admin'].includes(role) && status === 'active';
  const canDownload = role === 'trader' && status === 'active';

  // ── Handle PDF download ───────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!onDownload) return;
    setDownloadLoading(true);
    try {
      await onDownload(id, certificate_number);
    } finally {
      setDownloadLoading(false);
    }
  };

  // ── Verification overlay config ───────────────────────────────────────────
  const verifyCfg = verificationMeta
    ? VERIFY_STATUS_CONFIG[verificationMeta.verification_status] ?? VERIFY_STATUS_CONFIG.invalid
    : null;

  return (
    <>
      {/* CSS keyframes injected once */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .cert-card-action-btn:hover { opacity: 0.8; }
      `}</style>

      <div
        style={{
          background: '#fff',
          border: `1.5px solid ${verifyCfg ? verifyCfg.border : '#e5e7eb'}`,
          borderRadius: '16px',
          overflow: 'hidden',
          fontFamily: "'Inter', system-ui, sans-serif",
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          transition: 'border-color 0.2s',
        }}
      >

        {/* ── Verification result banner (CustomsVerify only) ────────────── */}
        {verificationMeta && verifyCfg && (
          <div
            style={{
              padding: '10px 20px',
              background: verifyCfg.bg,
              borderBottom: `1px solid ${verifyCfg.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 700, color: verifyCfg.text }}>
              {verifyCfg.label} — {verificationMeta.status_message}
            </span>
            {verificationMeta.response_ms != null && (
              <span style={{ fontSize: '11px', color: verifyCfg.text, opacity: 0.7 }}>
                {verificationMeta.response_ms} ms
              </span>
            )}
          </div>
        )}

        {/* ── Card header ───────────────────────────────────────────────── */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #f3f4f6',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {/* Certificate number */}
            <p style={{
              margin: 0,
              fontSize: '15px',
              fontWeight: 700,
              color: '#111827',
              letterSpacing: '0.02em',
              fontFamily: "'Courier New', monospace",
            }}>
              {certificate_number ?? id}
            </p>

            {/* Product + type */}
            <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
              {product_name ?? 'Unknown product'}
              <span style={{
                marginLeft: '8px',
                padding: '1px 7px',
                background: '#f3f4f6',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#374151',
              }}>
                {certificate_type}
              </span>
            </p>
          </div>

          <StatusBadge status={status} />
        </div>

        {/* ── Core info grid ─────────────────────────────────────────────── */}
        <div
          style={{
            padding: '16px 20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: '14px 20px',
          }}
        >
          <InfoRow label="Issuing Authority" value={CERT_TYPE_LABEL[certificate_type]} />
          <InfoRow label="Issuing Country"   value={COUNTRY_LABEL[issuing_country]} />
          <InfoRow label="Destination"       value={COUNTRY_LABEL[destination_country]} />
          <InfoRow label="Valid Until"       value={formatDate(valid_until)} />
          <InfoRow label="Issued On"         value={formatDate(created_at)} />

          {/* Trader name — visible to officers */}
          {trader?.full_name && canAudit && (
            <InfoRow label="Trader" value={trader.full_name} />
          )}

          {/* Issued by — visible to all */}
          {issued_by?.full_name && (
            <InfoRow label="Issued By" value={issued_by.full_name} />
          )}
        </div>

        {/* ── SHA-256 tamper-check row (BR-01) ───────────────────────────── */}
        {sha256_hash && (
          <div
            style={{
              margin: '0 20px',
              marginBottom: '4px',
              padding: '10px 14px',
              background: '#f9fafb',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600,
                             textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
                SHA-256
              </span>
              <span style={{
                fontSize: '12px',
                fontFamily: "'Courier New', monospace",
                color: '#374151',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {truncateHash(sha256_hash)}
              </span>
            </div>
            <CopyHashButton hash={sha256_hash} />
          </div>
        )}

        {/* ── Revocation info (if revoked) ───────────────────────────────── */}
        {status === 'revoked' && revocation_reason && (
          <div
            style={{
              margin: '8px 20px',
              padding: '10px 14px',
              background: '#fff1f2',
              borderRadius: '8px',
              border: '1px solid #fecdd3',
            }}
          >
            <p style={{ margin: 0, fontSize: '11px', fontWeight: 600, color: '#be123c',
                        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>
              Revocation Reason
            </p>
            <p style={{ margin: 0, fontSize: '13px', color: '#9f1239' }}>
              {revocation_reason}
            </p>
            {revoked_at && (
              <p style={{ margin: 0, fontSize: '11px', color: '#be123c', marginTop: '4px' }}>
                Revoked on {formatDate(revoked_at)}
              </p>
            )}
          </div>
        )}

        {/* ── Expandable: QR code preview ────────────────────────────────── */}
        {certificate.qr_code_url && (
          <div style={{ padding: '0 20px 4px' }}>
            <button
              onClick={() => setExpanded((v) => !v)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px 0',
                fontSize: '12px',
                color: '#6b7280',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span style={{
                display: 'inline-block',
                transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
              }}>▶</span>
              {expanded ? 'Hide QR Code' : 'Show QR Code'}
            </button>

            {expanded && (
              <div
                style={{
                  marginTop: '8px',
                  marginBottom: '8px',
                  padding: '16px',
                  background: '#f9fafb',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <img
                  src={certificate.qr_code_url}
                  alt={`QR code for certificate ${certificate_number}`}
                  style={{
                    width: '160px',
                    height: '160px',
                    imageRendering: 'pixelated',
                    borderRadius: '8px',
                  }}
                />
                <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af', textAlign: 'center' }}>
                  {certificate_number} · Scan to verify at border (BR-03)
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Action footer ──────────────────────────────────────────────── */}
        {(canDownload || canAudit || canRevoke) && (
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid #f3f4f6',
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            {/* Download PDF — trader only, active certs only (US-03) */}
            {canDownload && (
              <IconButton
                onClick={handleDownload}
                loading={downloadLoading}
                variant="default"
                title="Download certificate as PDF (US-03)"
              >
                ↓ Download PDF
              </IconButton>
            )}

            {/* Audit Trail — officers + admin (BR-06) */}
            {canAudit && onAudit && (
              <IconButton
                onClick={() => onAudit(id)}
                variant="outline"
                title="View immutable audit trail (BR-06)"
              >
                🔍 Audit Trail
              </IconButton>
            )}

            {/* Revoke — standards_officer + admin, active certs only */}
            {canRevoke && onRevoke && (
              <IconButton
                onClick={() => onRevoke(id)}
                variant="danger"
                title="Revoke this certificate"
              >
                ✕ Revoke
              </IconButton>
            )}
          </div>
        )}

      </div>
    </>
  );
};

export default CertificateCard;
