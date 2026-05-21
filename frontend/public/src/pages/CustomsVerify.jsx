// frontend/src/pages/CustomsVerify.jsx
// US-05: QR scan verification | US-06: Manual ID search + trader compliance view
// BR-03: Under 30 seconds | BR-06: Immutable audit trail

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'https://tradelens-api.onrender.com';

// ─── Country badge helper ─────────────────────────────────────────────────────
const CountryBadge = ({ code }) => (
  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border
    ${code === 'TZ'
      ? 'bg-sky-50 text-sky-700 border-sky-200'
      : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
    {code === 'TZ' ? '🇹🇿' : '🇿🇲'} {code}
  </span>
);

// ─── Verification status badge ────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    valid:     { cls: 'bg-emerald-100 text-emerald-800 border-emerald-300', label: '✓ VALID',     dot: 'bg-emerald-500' },
    expired:   { cls: 'bg-amber-100  text-amber-800  border-amber-300',  label: '⏱ EXPIRED',   dot: 'bg-amber-500'  },
    revoked:   { cls: 'bg-red-100    text-red-800    border-red-300',    label: '✕ REVOKED',   dot: 'bg-red-500'    },
    invalid:   { cls: 'bg-red-100    text-red-800    border-red-300',    label: '✕ INVALID',   dot: 'bg-red-500'    },
    not_found: { cls: 'bg-gray-100   text-gray-700   border-gray-300',   label: '? NOT FOUND', dot: 'bg-gray-400'   },
    active:    { cls: 'bg-emerald-100 text-emerald-800 border-emerald-300', label: 'ACTIVE',    dot: 'bg-emerald-500' },
  };
  const cfg = map[status] || map.invalid;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border tracking-wide ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

// ─── Certificate detail card ──────────────────────────────────────────────────
const CertCard = ({ result, onAudit }) => {
  const cert = result?.certificate;
  if (!cert) return null;

  const isValid = result.verification_status === 'valid';
  const borderColor = isValid ? 'border-l-emerald-500' : 'border-l-red-400';

  return (
    <div className={`bg-white rounded-2xl border border-gray-200 border-l-4 ${borderColor} shadow-sm overflow-hidden`}>
      {/* Header */}
      <div className={`px-5 py-4 flex items-start justify-between gap-3
        ${isValid ? 'bg-emerald-50' : 'bg-red-50'}`}>
        <div>
          <p className="text-xs font-mono text-gray-500 mb-0.5">{cert.certificate_number}</p>
          <h3 className="text-base font-semibold text-gray-900">{cert.product_name}</h3>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <StatusBadge status={result.verification_status} />
          <span className="text-[10px] text-gray-400 font-mono">{result.response_ms}ms</span>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <Field label="Certificate Type" value={cert.certificate_type} />
        <Field label="Status" value={<StatusBadge status={cert.status} />} raw />
        <Field label="Issuing Country" value={<CountryBadge code={cert.issuing_country} />} raw />
        <Field label="Destination" value={<CountryBadge code={cert.destination_country} />} raw />
        <Field label="Valid Until" value={cert.valid_until
          ? new Date(cert.valid_until).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          : '—'} />
        <Field label="Issued" value={cert.issued_at
          ? new Date(cert.issued_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          : '—'} />

        {cert.trader && (
          <div className="col-span-2 border-t border-gray-100 pt-3 mt-1">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Trader</p>
            <p className="font-medium text-gray-900">{cert.trader.full_name}</p>
            <p className="text-xs text-gray-500">{cert.trader.email}</p>
          </div>
        )}

        {cert.issued_by && (
          <div className="col-span-2 border-t border-gray-100 pt-3">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Issued By</p>
            <p className="font-medium text-gray-900">{cert.issued_by.full_name}</p>
            <p className="text-xs text-gray-500">{cert.issued_by.role?.replace(/_/g, ' ')}</p>
          </div>
        )}

        {result.verification_status === 'revoked' && cert.revocation_reason && (
          <div className="col-span-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
            <span className="font-semibold">Revocation reason: </span>{cert.revocation_reason}
          </div>
        )}

        {result.status_message && (
          <div className={`col-span-2 rounded-lg px-3 py-2 text-xs
            ${isValid ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {result.status_message}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
        <button
          onClick={() => onAudit(cert.id)}
          className="text-xs text-gray-500 hover:text-gray-800 underline underline-offset-2 transition-colors"
        >
          View audit trail →
        </button>
      </div>
    </div>
  );
};

const Field = ({ label, value, raw }) => (
  <div>
    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
    {raw ? value : <p className="text-sm font-medium text-gray-800">{value || '—'}</p>}
  </div>
);

// ─── Audit trail modal ────────────────────────────────────────────────────────
const AuditModal = ({ certId, token, onClose }) => {
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!certId) return;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/verify/certificate/${certId}/audit`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.message || 'Failed to load audit');
        setAudit(data.data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [certId, token]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Audit Trail</h3>
            {audit && (
              <p className="text-xs text-gray-500 font-mono">{audit.certificate?.certificate_number}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && <p className="text-sm text-gray-400 text-center py-8">Loading audit trail…</p>}
          {error && <p className="text-sm text-red-500 text-center py-8">{error}</p>}
          {audit && (
            <ol className="relative border-l border-gray-200 ml-3 space-y-5">
              {audit.audit_trail?.map((log) => (
                <li key={log.id} className="ml-6">
                  <span className="absolute -left-1.5 w-3 h-3 rounded-full border border-white bg-gray-400 mt-1" />
                  <p className="text-xs font-mono text-gray-500">
                    {new Date(log.created_at).toLocaleString('en-GB')}
                  </p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">
                    {log.action.replace(/_/g, ' ')}
                  </p>
                  {log.performed_by_user && (
                    <p className="text-xs text-gray-500">
                      by {log.performed_by_user.full_name} ({log.role?.replace(/_/g, ' ')})
                      {log.country && ` · ${log.country}`}
                    </p>
                  )}
                </li>
              ))}
              {(!audit.audit_trail || audit.audit_trail.length === 0) && (
                <p className="text-sm text-gray-400">No audit events found.</p>
              )}
            </ol>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 text-right">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800 px-4 py-2">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Trader compliance view (US-06) ──────────────────────────────────────────
const TraderCompliance = ({ data }) => {
  if (!data) return null;
  const { trader, summary, certificates } = data;

  return (
    <div className="space-y-5">
      {/* Trader header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">Trader</p>
            <h3 className="text-lg font-semibold text-gray-900">{trader.full_name}</h3>
            <p className="text-sm text-gray-500">{trader.email}</p>
            {trader.phone && <p className="text-sm text-gray-500">{trader.phone}</p>}
          </div>
          <CountryBadge code={trader.country} />
        </div>

        {/* Summary counters */}
        <div className="grid grid-cols-4 gap-3 mt-5">
          {[
            { label: 'Total',   value: summary.total_certificates, color: 'text-gray-900' },
            { label: 'Active',  value: summary.active,  color: 'text-emerald-600' },
            { label: 'Expired', value: summary.expired, color: 'text-amber-600'  },
            { label: 'Revoked', value: summary.revoked, color: 'text-red-600'    },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Certificates list */}
      {certificates?.length > 0 ? (
        <div className="space-y-3">
          {certificates.map((cert) => (
            <div key={cert.id} className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-mono text-gray-400">{cert.certificate_number}</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{cert.product_name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {cert.certificate_type} · Valid until {new Date(cert.valid_until).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <StatusBadge status={cert.status} />
                <div className="flex gap-1">
                  <CountryBadge code={cert.issuing_country} />
                  <span className="text-gray-300 text-xs self-center">→</span>
                  <CountryBadge code={cert.destination_country} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-sm text-gray-400 py-8">No certificates found for this trader.</p>
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const CustomsVerify = () => {
  const navigate = useNavigate();
  const { user, token, isCustomsOfficer, isAdmin } = useAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState('qr'); // 'qr' | 'search' | 'trader'

  // QR Verify (US-05)
  const [qrPayload, setQrPayload] = useState('');
  const [qrResult, setQrResult] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState(null);

  // Manual Search (US-05)
  const [searchQuery, setSearchQuery] = useState({ certificate_id: '', certificate_number: '', trader_id: '' });
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);

  // Trader Compliance (US-06)
  const [traderId, setTraderId] = useState('');
  const [traderData, setTraderData] = useState(null);
  const [traderLoading, setTraderLoading] = useState(false);
  const [traderError, setTraderError] = useState(null);

  // Audit modal
  const [auditCertId, setAuditCertId] = useState(null);

  // Role guard
  useEffect(() => {
    if (user && !isCustomsOfficer && !isAdmin) {
      navigate('/dashboard');
    }
  }, [user, isCustomsOfficer, isAdmin, navigate]);

  // ── QR Verify ──────────────────────────────────────────────────────────────
  const handleQRVerify = useCallback(async () => {
    if (!qrPayload.trim()) return;
    setQrLoading(true);
    setQrError(null);
    setQrResult(null);
    try {
      const r = await fetch(`${API_BASE}/api/verify/qr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ qr_payload: qrPayload.trim() }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || 'Verification failed');
      setQrResult(data.data);
    } catch (e) {
      setQrError(e.message);
    } finally {
      setQrLoading(false);
    }
  }, [qrPayload, token]);

  // ── Manual Search ──────────────────────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    const params = new URLSearchParams();
    if (searchQuery.certificate_id.trim())     params.append('certificate_id',     searchQuery.certificate_id.trim());
    if (searchQuery.certificate_number.trim()) params.append('certificate_number', searchQuery.certificate_number.trim());
    if (searchQuery.trader_id.trim())          params.append('trader_id',          searchQuery.trader_id.trim());

    if (!params.toString()) {
      setSearchError('Enter at least one search field.');
      return;
    }

    setSearchLoading(true);
    setSearchError(null);
    setSearchResults(null);
    try {
      const r = await fetch(`${API_BASE}/api/verify/search?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || 'Search failed');
      setSearchResults(data);
    } catch (e) {
      setSearchError(e.message);
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery, token]);

  // ── Trader Compliance ──────────────────────────────────────────────────────
  const handleTraderLookup = useCallback(async () => {
    if (!traderId.trim()) return;
    setTraderLoading(true);
    setTraderError(null);
    setTraderData(null);
    try {
      const r = await fetch(`${API_BASE}/api/verify/trader/${traderId.trim()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || 'Lookup failed');
      setTraderData(data.data);
    } catch (e) {
      setTraderError(e.message);
    } finally {
      setTraderLoading(false);
    }
  }, [traderId, token]);

  const tabs = [
    { id: 'qr',     label: 'QR Scan',          icon: '⬛' },
    { id: 'search', label: 'ID / Number Search', icon: '🔍' },
    { id: 'trader', label: 'Trader Compliance',  icon: '👤' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center">
            <span className="text-white text-sm font-bold">TL</span>
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900 leading-none">Customs Verification</h1>
            <p className="text-xs text-gray-400 mt-0.5">Tanzania–Zambia Corridor · BR-03</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{user.full_name}</p>
              <p className="text-xs text-gray-400">{user.role?.replace(/_/g, ' ')} · {user.country}</p>
            </div>
          )}
          <button
            onClick={() => navigate('/dashboard')}
            className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-400 px-3 py-1.5 rounded-lg transition-colors"
          >
            ← Dashboard
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Tab bar */}
        <div className="flex bg-white border border-gray-200 rounded-xl p-1 mb-6 gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2.5 rounded-lg transition-all
                ${activeTab === tab.id
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
            >
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        {/* ── QR SCAN TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'qr' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-1">QR Code Verification</h2>
              <p className="text-xs text-gray-400 mb-5">
                Paste the QR payload or scan with your device camera. Verification completes in under 30 seconds (BR-03).
              </p>

              <label className="block text-xs font-medium text-gray-600 mb-1.5">QR Payload</label>
              <textarea
                rows={4}
                value={qrPayload}
                onChange={(e) => setQrPayload(e.target.value)}
                placeholder="Paste QR code payload here…"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:bg-white resize-none transition-colors"
              />

              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleQRVerify}
                  disabled={qrLoading || !qrPayload.trim()}
                  className="flex-1 bg-gray-900 text-white text-sm font-semibold py-3 rounded-xl hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {qrLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Verifying…
                    </span>
                  ) : 'Verify Certificate'}
                </button>
                {qrPayload && (
                  <button
                    onClick={() => { setQrPayload(''); setQrResult(null); setQrError(null); }}
                    className="px-4 text-gray-400 hover:text-gray-700 border border-gray-200 rounded-xl transition-colors text-sm"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {qrError && <ErrorBanner message={qrError} />}
            {qrResult && <CertCard result={qrResult} onAudit={setAuditCertId} />}
          </div>
        )}

        {/* ── MANUAL SEARCH TAB ───────────────────────────────────────────── */}
        {activeTab === 'search' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-1">Manual Certificate Search</h2>
              <p className="text-xs text-gray-400 mb-5">
                Search by certificate number, UUID, or trader ID. Fill at least one field.
              </p>

              <div className="space-y-4">
                <SearchField
                  label="Certificate Number"
                  placeholder="e.g. TL-TZ-TBS-LK3M9A"
                  value={searchQuery.certificate_number}
                  onChange={(v) => setSearchQuery((q) => ({ ...q, certificate_number: v }))}
                />
                <SearchField
                  label="Certificate ID (UUID)"
                  placeholder="e.g. 3f8a2c1d-…"
                  value={searchQuery.certificate_id}
                  onChange={(v) => setSearchQuery((q) => ({ ...q, certificate_id: v }))}
                  mono
                />
                <SearchField
                  label="Trader ID (UUID)"
                  placeholder="e.g. 9b4e7f2a-…"
                  value={searchQuery.trader_id}
                  onChange={(v) => setSearchQuery((q) => ({ ...q, trader_id: v }))}
                  mono
                />
              </div>

              <div className="flex gap-3 mt-5">
                <button
                  onClick={handleSearch}
                  disabled={searchLoading}
                  className="flex-1 bg-gray-900 text-white text-sm font-semibold py-3 rounded-xl hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {searchLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Searching…
                    </span>
                  ) : 'Search'}
                </button>
                <button
                  onClick={() => { setSearchQuery({ certificate_id: '', certificate_number: '', trader_id: '' }); setSearchResults(null); setSearchError(null); }}
                  className="px-4 text-gray-400 hover:text-gray-700 border border-gray-200 rounded-xl text-sm transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>

            {searchError && <ErrorBanner message={searchError} />}

            {searchResults && (
              <div className="space-y-3">
                <p className="text-xs text-gray-400 font-medium">
                  {searchResults.total} result{searchResults.total !== 1 ? 's' : ''} · {searchResults.response_ms}ms
                </p>
                {searchResults.data?.length > 0
                  ? searchResults.data.map((r, i) => (
                      <CertCard key={r.certificate?.id || i} result={r} onAudit={setAuditCertId} />
                    ))
                  : <p className="text-center text-sm text-gray-400 py-8">No certificates found.</p>
                }
              </div>
            )}
          </div>
        )}

        {/* ── TRADER COMPLIANCE TAB ────────────────────────────────────────── */}
        {activeTab === 'trader' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-1">Trader Compliance Overview</h2>
              <p className="text-xs text-gray-400 mb-5">
                Enter a trader's UUID to see their full compliance picture — all certificates, status, and summary.
              </p>

              <SearchField
                label="Trader ID (UUID)"
                placeholder="e.g. 9b4e7f2a-…"
                value={traderId}
                onChange={setTraderId}
                mono
              />

              <div className="flex gap-3 mt-5">
                <button
                  onClick={handleTraderLookup}
                  disabled={traderLoading || !traderId.trim()}
                  className="flex-1 bg-gray-900 text-white text-sm font-semibold py-3 rounded-xl hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {traderLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Loading…
                    </span>
                  ) : 'Load Compliance Profile'}
                </button>
                <button
                  onClick={() => { setTraderId(''); setTraderData(null); setTraderError(null); }}
                  className="px-4 text-gray-400 hover:text-gray-700 border border-gray-200 rounded-xl text-sm transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>

            {traderError && <ErrorBanner message={traderError} />}
            {traderData && <TraderCompliance data={traderData} />}
          </div>
        )}
      </div>

      {/* Audit Modal */}
      {auditCertId && (
        <AuditModal
          certId={auditCertId}
          token={token}
          onClose={() => setAuditCertId(null)}
        />
      )}
    </div>
  );
};

// ─── Small helpers ────────────────────────────────────────────────────────────
const SearchField = ({ label, placeholder, value, onChange, mono }) => (
  <div>
    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:bg-white transition-colors
        ${mono ? 'font-mono' : ''}`}
    />
  </div>
);

const ErrorBanner = ({ message }) => (
  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-start gap-2">
    <span className="shrink-0 mt-0.5">⚠</span>
    <span>{message}</span>
  </div>
);

export default CustomsVerify;
