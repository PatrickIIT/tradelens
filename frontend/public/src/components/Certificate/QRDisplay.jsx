// frontend/src/components/Certificate/QRDisplay.jsx
//
// Renders the QR code for a TradeLens certificate.
// Used inside CertificateCard (expanded QR section) and the trader's
// certificate detail view (TraderDashboard / StandardsOfficer).
//
// Props:
//   qrCodeUrl        — string | null  base64 data URL from POST /api/certificates/issue
//                      (stored in certificates.qr_code_url)
//   qrPayload        — string | null  raw base64-encoded JSON payload (fallback display)
//   certificateNumber — string        e.g. "TL-TZ-TBS-LK3M9A" — used in alt text,
//                       filename, and caption

import { useState, useRef } from 'react';

// ── Utility: copy text to clipboard ──────────────────────────────────────────
const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for HTTP / older browsers
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  }
};

// ── Utility: download a data URL as a PNG file ────────────────────────────────
const downloadPNG = (dataUrl, filename) => {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

// ── Sub-component: small action button ───────────────────────────────────────
const ActionButton = ({ onClick, children, title, active = false }) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: '6px 12px',
      borderRadius: '7px',
      fontSize: '11px',
      fontWeight: 600,
      cursor: 'pointer',
      border: '1px solid',
      transition: 'background 0.15s, color 0.15s, border-color 0.15s',
      background: active ? '#dcfce7' : '#fff',
      color: active ? '#15803d' : '#374151',
      borderColor: active ? '#86efac' : '#d1d5db',
      letterSpacing: '0.02em',
    }}
  >
    {children}
  </button>
);

// ── Main component ────────────────────────────────────────────────────────────
const QRDisplay = ({ qrCodeUrl, qrPayload, certificateNumber }) => {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const imgRef = useRef(null);

  // ── Nothing to render ──────────────────────────────────────────────────────
  if (!qrCodeUrl && !qrPayload) {
    return (
      <div
        style={{
          padding: '20px 16px',
          background: '#f9fafb',
          borderRadius: '12px',
          textAlign: 'center',
        }}
      >
        <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af' }}>
          QR code not available for this certificate.
        </p>
      </div>
    );
  }

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleCopy = async () => {
    const text = qrPayload ?? qrCodeUrl ?? '';
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleDownload = () => {
    if (!qrCodeUrl) return;
    setDownloading(true);
    const filename = certificateNumber
      ? `TradeLens_QR_${certificateNumber}.png`
      : 'TradeLens_QR.png';
    downloadPNG(qrCodeUrl, filename);
    // brief visual feedback
    setTimeout(() => setDownloading(false), 800);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: '14px',
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
        width: '100%',
      }}
    >
      {/* ── Header strip ──────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '10px 16px',
          background: '#f9fafb',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          {/* QR icon */}
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#6b7280"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <path d="M14 14h.01M18 14h.01M14 18h.01M18 18h.01M14 22h.01M18 22h.01M22 14h.01M22 18h.01M22 22h.01" />
          </svg>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#374151',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
            }}
          >
            QR Code
          </span>
        </div>

        {certificateNumber && (
          <span
            style={{
              fontSize: '11px',
              fontFamily: "'Courier New', monospace",
              color: '#9ca3af',
            }}
          >
            {certificateNumber}
          </span>
        )}
      </div>

      {/* ── QR image OR fallback payload ──────────────────────────────────── */}
      <div
        style={{
          padding: '20px 16px 14px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        {qrCodeUrl ? (
          <>
            {/* QR image */}
            <div
              style={{
                padding: '12px',
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '10px',
                display: 'inline-block',
                boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
              }}
            >
              <img
                ref={imgRef}
                src={qrCodeUrl}
                alt={
                  certificateNumber
                    ? `QR code for TradeLens certificate ${certificateNumber}`
                    : 'TradeLens certificate QR code'
                }
                style={{
                  display: 'block',
                  width: '172px',
                  height: '172px',
                  imageRendering: 'pixelated',
                  borderRadius: '4px',
                }}
              />
            </div>

            {/* Caption */}
            <p
              style={{
                margin: 0,
                fontSize: '11px',
                color: '#9ca3af',
                textAlign: 'center',
                lineHeight: 1.5,
              }}
            >
              Scan at border checkpoint to verify in under 30&thinsp;s
            </p>
          </>
        ) : (
          /* ── Fallback: raw payload in styled mono box ─────────────────── */
          <div
            style={{
              width: '100%',
              padding: '12px 14px',
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
          >
            <p
              style={{
                margin: '0 0 6px',
                fontSize: '10px',
                fontWeight: 700,
                color: '#9ca3af',
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
              }}
            >
              Raw QR Payload
            </p>
            <p
              style={{
                margin: 0,
                fontSize: '11px',
                fontFamily: "'Courier New', monospace",
                color: '#374151',
                wordBreak: 'break-all',
                lineHeight: 1.6,
              }}
            >
              {qrPayload}
            </p>
          </div>
        )}

        {/* ── Action buttons ─────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {/* Copy payload */}
          {(qrPayload || qrCodeUrl) && (
            <ActionButton
              onClick={handleCopy}
              title="Copy QR payload to clipboard"
              active={copied}
            >
              {copied ? (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copy Payload
                </>
              )}
            </ActionButton>
          )}

          {/* Download PNG — only when we have an actual image URL */}
          {qrCodeUrl && (
            <ActionButton
              onClick={handleDownload}
              title={
                certificateNumber
                  ? `Download QR as TradeLens_QR_${certificateNumber}.png`
                  : 'Download QR as PNG'
              }
              active={downloading}
            >
              {downloading ? (
                <>
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      border: '2px solid currentColor',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      display: 'inline-block',
                      animation: 'qr-spin 0.7s linear infinite',
                    }}
                  />
                  Saving…
                </>
              ) : (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download PNG
                </>
              )}
            </ActionButton>
          )}
        </div>
      </div>

      {/* ── Spinner keyframe (inline style tag) ───────────────────────────── */}
      <style>{`
        @keyframes qr-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default QRDisplay;
