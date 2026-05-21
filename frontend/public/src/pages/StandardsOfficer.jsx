// frontend/src/pages/StandardsOfficer.jsx
// US-04 — Review documents (approve / reject) · Issue digital certificates (BR-01)
// Standards Officers scoped to documents destined for their corridor country (TZ / ZM)

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'https://tradelens-api.onrender.com';

// ─── Constants ─────────────────────────────────────────────────────────────────
const DOC_TYPE_LABELS = {
  phytosanitary_certificate:  'Phytosanitary Certificate',
  certificate_of_origin:      'Certificate of Origin',
  packing_list:               'Packing List',
  commercial_invoice:         'Commercial Invoice',
  import_permit:              'Import Permit',
  quality_inspection_report:  'Quality Inspection Report',
};

const CERT_TYPE_BY_COUNTRY = { TZ: 'TBS', ZM: 'ZABS' };

// ─── Helpers ────────────────────────────────────────────────────────────────────
const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

const fmtDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '—';

// ─── Sub-components ─────────────────────────────────────────────────────────────

const CountryBadge = ({ code }) => (
  <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border
    ${code === 'TZ'
      ? 'bg-sky-50 text-sky-700 border-sky-200'
      : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
    {code === 'TZ' ? '🇹🇿' : '🇿🇲'} {code}
  </span>
);

const StatusPill = ({ status }) => {
  const map = {
    pending:  'bg-amber-100  text-amber-800  border-amber-300',
    approved: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    rejected: 'bg-red-100    text-red-800    border-red-300',
    active:   'bg-emerald-100 text-emerald-800 border-emerald-300',
    revoked:  'bg-red-100    text-red-800    border-red-300',
    expired:  'bg-gray-100   text-gray-600   border-gray-300',
  };
  const icons = { pending: '⏳', approved: '✓', rejected: '✕', active: '✓', revoked: '✕', expired: '⏱' };
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${map[status] || map.pending}`}>
      {icons[status]} {status.toUpperCase()}
    </span>
  );
};

const Alert = ({ type, message }) => {
  const s = {
    error:   'bg-red-50 border-red-200 text-red-700',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    info:    'bg-sky-50 border-sky-200 text-sky-700',
  };
  const ic = { error: '✕', success: '✓', info: 'ℹ' };
  return (
    <div className={`flex items-start gap-2 border rounded-xl px-4 py-3 text-sm ${s[type]}`}>
      <span className="font-bold shrink-0 mt-0.5">{ic[type]}</span>
      <span>{message}</span>
    </div>
  );
};

const Spinner = ({ size = 'sm' }) => (
  <span className={`inline-block border-2 border-current/30 border-t-current rounded-full animate-spin
    ${size === 'sm' ? 'w-4 h-4' : 'w-6 h-6'}`} />
);

// ─── Issue Certificate Modal ────────────────────────────────────────────────────
const IssueCertModal = ({ doc, user, token, onClose, onIssued }) => {
  const certType = CERT_TYPE_BY_COUNTRY[user?.country] || 'TBS';

  const [form, setForm] = useState({
    product_name:     doc.product?.name || '',
    certificate_type: certType,
    valid_until:      '',
  });
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState(null);
  const [success, setSuccess]   = useState(null);

  const handleSubmit = async () => {
    if (!form.product_name.trim() || !form.valid_until) {
      setError('Product name and expiry date are required.');
      return;
    }
    if (new Date(form.valid_until) <= new Date()) {
      setError('Expiry date must be in the future.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API_BASE}/api/certificates/issue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          document_id:      doc.id,
          trader_id:        doc.trader?.id || doc.trader_id,
          product_name:     form.product_name.trim(),
          certificate_type: form.certificate_type,
          valid_until:      form.valid_until,
          issuing_country:  user?.country,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || 'Certificate issuance failed.');
      setSuccess(`Certificate ${data.data.certificate_number} issued successfully.`);
      setTimeout(() => { onIssued(data.data); onClose(); }, 1800);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Issue Digital Certificate</h3>
            <p className="text-xs text-gray-400 mt-0.5">BR-01 · {certType} · {user?.country}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {/* Document summary */}
        <div className="mx-6 mt-5 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Document being certified</p>
          <p className="font-semibold text-gray-800">{DOC_TYPE_LABELS[doc.document_type] || doc.document_type}</p>
          <p className="text-gray-500 text-xs mt-0.5">
            Trader: {doc.trader?.full_name} · Uploaded {fmtDate(doc.uploaded_at)}
          </p>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4">
          {error   && <Alert type="error"   message={error}   />}
          {success && <Alert type="success" message={success} />}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Product Name
            </label>
            <input
              type="text"
              value={form.product_name}
              onChange={(e) => setForm((f) => ({ ...f, product_name: e.target.value }))}
              placeholder="e.g. Dried Cassava"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50
                focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Certificate Type
              </label>
              <div className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-100 text-gray-500 font-mono">
                {form.certificate_type}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Auto-set for {user?.country === 'TZ' ? 'Tanzania' : 'Zambia'}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Valid Until
              </label>
              <input
                type="date"
                value={form.valid_until}
                min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50
                  focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-800 px-4 py-2 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !!success}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold
              px-5 py-2.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading && <Spinner />}
            {loading ? 'Issuing…' : success ? '✓ Issued' : 'Issue Certificate'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Review Modal (Approve / Reject) ───────────────────────────────────────────
const ReviewModal = ({ doc, token, onClose, onReviewed }) => {
  const [decision, setDecision]   = useState('approved'); // 'approved' | 'rejected'
  const [notes,    setNotes]      = useState('');
  const [loading,  setLoading]    = useState(false);
  const [error,    setError]      = useState(null);
  const [success,  setSuccess]    = useState(null);

  const handleReview = async () => {
    if (decision === 'rejected' && notes.trim().length < 10) {
      setError('Reviewer notes must be at least 10 characters when rejecting.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const body = { status: decision };
      if (notes.trim()) body.reviewer_notes = notes.trim();

      const r = await fetch(`${API_BASE}/api/documents/${doc.id}/review`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || 'Review failed.');
      setSuccess(`Document ${decision} successfully.`);
      setTimeout(() => { onReviewed(data.data); onClose(); }, 1500);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Review Document</h3>
            <p className="text-xs text-gray-400 mt-0.5">{DOC_TYPE_LABELS[doc.document_type] || doc.document_type}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {error   && <Alert type="error"   message={error}   />}
          {success && <Alert type="success" message={success} />}

          {/* Trader info */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Submission</p>
            <p className="font-semibold text-gray-800">{doc.trader?.full_name}</p>
            <p className="text-gray-500 text-xs">{doc.trader?.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <CountryBadge code={doc.destination_country} />
              <span className="text-gray-400 text-xs">· Uploaded {fmtDate(doc.uploaded_at)}</span>
            </div>
            {doc.description && (
              <p className="text-gray-500 text-xs mt-2 italic">"{doc.description}"</p>
            )}
            {doc.file_url && (
              <a
                href={doc.file_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-800 text-xs font-medium mt-2 underline underline-offset-2"
              >
                📄 View document file ↗
              </a>
            )}
          </div>

          {/* Decision toggle */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Decision</p>
            <div className="flex gap-2">
              {['approved', 'rejected'].map((d) => (
                <button
                  key={d}
                  onClick={() => { setDecision(d); setError(null); }}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-xl border-2 transition-all
                    ${decision === d
                      ? d === 'approved'
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'bg-red-600 border-red-600 text-white'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'}`}
                >
                  {d === 'approved' ? '✓ Approve' : '✕ Reject'}
                </button>
              ))}
            </div>
          </div>

          {/* Reviewer notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Reviewer Notes
              {decision === 'rejected' && <span className="text-red-500 ml-1">* required</span>}
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                decision === 'rejected'
                  ? 'Explain why the document is being rejected (min 10 characters)…'
                  : 'Optional feedback for the trader…'
              }
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50
                focus:outline-none focus:ring-2 focus:ring-gray-400 focus:bg-white transition-colors resize-none"
            />
            {decision === 'rejected' && (
              <p className={`text-[11px] mt-1 ${notes.trim().length < 10 ? 'text-red-400' : 'text-emerald-500'}`}>
                {notes.trim().length}/10 min characters
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-800 px-4 py-2 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleReview}
            disabled={loading || !!success}
            className={`flex items-center gap-2 text-white text-sm font-semibold
              px-5 py-2.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors
              ${decision === 'approved'
                ? 'bg-emerald-600 hover:bg-emerald-500'
                : 'bg-red-600 hover:bg-red-500'}`}
          >
            {loading && <Spinner />}
            {loading
              ? 'Submitting…'
              : success
                ? '✓ Done'
                : decision === 'approved'
                  ? 'Approve Document'
                  : 'Reject Document'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Document Row ───────────────────────────────────────────────────────────────
const DocRow = ({ doc, onReview, onIssue, issuedCertIds }) => {
  const canIssue = doc.status === 'approved' && !issuedCertIds.has(doc.id);

  return (
    <tr className="hover:bg-gray-50 transition-colors group">
      <td className="px-5 py-4">
        <p className="text-sm font-semibold text-gray-900">
          {DOC_TYPE_LABELS[doc.document_type] || doc.document_type}
        </p>
        <p className="text-xs text-gray-400 mt-0.5 font-mono">{doc.id?.slice(0, 8)}…</p>
      </td>
      <td className="px-5 py-4">
        <p className="text-sm font-medium text-gray-800">{doc.trader?.full_name || '—'}</p>
        <p className="text-xs text-gray-400">{doc.trader?.email}</p>
      </td>
      <td className="px-5 py-4">
        <CountryBadge code={doc.destination_country} />
      </td>
      <td className="px-5 py-4">
        <p className="text-xs text-gray-500">{fmtDateTime(doc.uploaded_at)}</p>
      </td>
      <td className="px-5 py-4">
        <StatusPill status={doc.status} />
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {doc.status === 'pending' && (
            <button
              onClick={() => onReview(doc)}
              className="text-xs font-semibold text-gray-700 hover:text-white bg-gray-100 hover:bg-gray-800
                px-3 py-1.5 rounded-lg transition-all"
            >
              Review
            </button>
          )}
          {canIssue && (
            <button
              onClick={() => onIssue(doc)}
              className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500
                px-3 py-1.5 rounded-lg transition-colors"
            >
              Issue Cert
            </button>
          )}
          {issuedCertIds.has(doc.id) && (
            <span className="text-xs text-emerald-600 font-medium">✓ Cert issued</span>
          )}
          {doc.file_url && (
            <a
              href={doc.file_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-sky-600 hover:text-sky-800 underline underline-offset-2"
            >
              View
            </a>
          )}
        </div>
      </td>
    </tr>
  );
};

// ─── Certificates Tab ────────────────────────────────────────────────────────────
const CertificatesTab = ({ token, user }) => {
  const [certs,   setCerts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [page,    setPage]    = useState(1);
  const [pagination, setPagination] = useState(null);

  const [revokeId,     setRevokeId]     = useState(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [revokeError,   setRevokeError]   = useState(null);

  const fetchCerts = useCallback(async (p = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: p, limit: 10 });
      const r = await fetch(`${API_BASE}/api/certificates?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || 'Failed to load certificates.');
      setCerts(data.data);
      setPagination(data.pagination);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchCerts(page); }, [fetchCerts, page]);

  const handleRevoke = async () => {
    if (!revokeReason.trim() || revokeReason.trim().length < 5) {
      setRevokeError('Revocation reason must be at least 5 characters.');
      return;
    }
    setRevokeLoading(true);
    setRevokeError(null);
    try {
      const r = await fetch(`${API_BASE}/api/certificates/${revokeId}/revoke`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: revokeReason.trim() }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || 'Revocation failed.');
      setCerts((prev) => prev.map((c) => (c.id === revokeId ? { ...c, status: 'revoked' } : c)));
      setRevokeId(null);
      setRevokeReason('');
    } catch (e) {
      setRevokeError(e.message);
    } finally {
      setRevokeLoading(false);
    }
  };

  return (
    <div>
      {loading && (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      )}
      {error && <Alert type="error" message={error} />}

      {!loading && !error && (
        <>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Certificate', 'Product', 'Trader', 'Countries', 'Valid Until', 'Status', ''].map((h) => (
                    <th key={h} className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-5 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {certs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-sm text-gray-400 py-12">
                      No certificates found.
                    </td>
                  </tr>
                ) : (
                  certs.map((cert) => (
                    <tr key={cert.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-5 py-4">
                        <p className="text-xs font-mono font-semibold text-gray-800">{cert.certificate_number}</p>
                        <p className="text-[10px] text-gray-400">{cert.certificate_type}</p>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700 max-w-[140px] truncate">
                        {cert.product_name}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm text-gray-700">{cert.trader?.full_name || '—'}</p>
                        <p className="text-xs text-gray-400">{cert.trader?.email}</p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          <CountryBadge code={cert.issuing_country} />
                          <span className="text-gray-300">→</span>
                          <CountryBadge code={cert.destination_country} />
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-500">{fmtDate(cert.valid_until)}</td>
                      <td className="px-5 py-4"><StatusPill status={cert.status} /></td>
                      <td className="px-5 py-4">
                        {cert.status === 'active' && (
                          <button
                            onClick={() => { setRevokeId(cert.id); setRevokeError(null); setRevokeReason(''); }}
                            className="text-xs text-red-500 hover:text-red-700 underline underline-offset-2
                              opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.total_pages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <p className="text-gray-400 text-xs">
                Page {pagination.page} of {pagination.total_pages} · {pagination.total} total
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50
                    disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs font-medium"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
                  disabled={page === pagination.total_pages}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50
                    disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs font-medium"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Revoke Modal */}
      {revokeId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Revoke Certificate</h3>
            {revokeError && <Alert type="error" message={revokeError} />}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Revocation Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="State the reason for revocation (min 5 characters)…"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50
                  focus:outline-none focus:ring-2 focus:ring-red-400 focus:bg-white transition-colors resize-none"
              />
            </div>
            <div className="flex gap-3 justify-end pt-1">
              <button
                onClick={() => { setRevokeId(null); setRevokeError(null); }}
                className="text-sm text-gray-500 hover:text-gray-800 px-4 py-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRevoke}
                disabled={revokeLoading}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold
                  px-5 py-2.5 rounded-xl disabled:opacity-50 transition-colors"
              >
                {revokeLoading && <Spinner />}
                {revokeLoading ? 'Revoking…' : 'Confirm Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────
const StandardsOfficer = () => {
  const navigate = useNavigate();
  const { user, getToken, isStandardsOfficer, isAdmin } = useAuth();
  const token = getToken();

  const [activeTab, setActiveTab] = useState('documents'); // 'documents' | 'certificates'

  // Documents state
  const [docs,       setDocs]       = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docsError,   setDocsError]   = useState(null);
  const [page,       setPage]       = useState(1);
  const [pagination, setPagination] = useState(null);
  const [statusFilter, setStatusFilter] = useState('pending'); // default: show pending queue

  // Modals
  const [reviewDoc,  setReviewDoc]  = useState(null);
  const [issueDoc,   setIssueDoc]   = useState(null);

  // Track which doc IDs have had certificates issued this session
  const [issuedCertIds, setIssuedCertIds] = useState(new Set());

  // Stats
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });

  // Role guard
  useEffect(() => {
    if (user && !isStandardsOfficer && !isAdmin) {
      navigate('/dashboard');
    }
  }, [user, isStandardsOfficer, isAdmin, navigate]);

  // ── Fetch documents ─────────────────────────────────────────────────────────
  const fetchDocs = useCallback(async (p = 1, status = statusFilter) => {
    setDocsLoading(true);
    setDocsError(null);
    try {
      const params = new URLSearchParams({ page: p, limit: 12 });
      if (status) params.append('status', status);

      const r = await fetch(`${API_BASE}/api/documents?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || 'Failed to load documents.');
      setDocs(data.data);
      setPagination(data.pagination);
    } catch (e) {
      setDocsError(e.message);
    } finally {
      setDocsLoading(false);
    }
  }, [token, statusFilter]);

  // ── Fetch counts for the three status buckets ───────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const [pendingR, approvedR, rejectedR] = await Promise.all([
        fetch(`${API_BASE}/api/documents?status=pending&limit=1`,  { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/documents?status=approved&limit=1`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/documents?status=rejected&limit=1`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [p, a, r] = await Promise.all([pendingR.json(), approvedR.json(), rejectedR.json()]);
      setStats({
        pending:  p.pagination?.total  ?? 0,
        approved: a.pagination?.total  ?? 0,
        rejected: r.pagination?.total  ?? 0,
      });
    } catch (_) { /* stats are non-critical */ }
  }, [token]);

  useEffect(() => {
    fetchDocs(1, statusFilter);
    fetchStats();
  }, [fetchDocs, fetchStats, statusFilter]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleReviewed = (updatedDoc) => {
    setDocs((prev) => prev.map((d) => (d.id === updatedDoc.id ? { ...d, ...updatedDoc } : d)));
    fetchStats();
  };

  const handleIssued = (cert) => {
    // Mark this document's ID so the "Issue Cert" button disappears
    setIssuedCertIds((prev) => new Set([...prev, cert.document_id]));
  };

  const handleFilterChange = (status) => {
    setStatusFilter(status);
    setPage(1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchDocs(newPage, statusFilter);
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 font-sans">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center">
            <span className="text-white text-sm font-black">TL</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 leading-none">Standards Officer Portal</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-xs text-gray-400">
                {user?.country === 'TZ' ? 'TBS — Tanzania Bureau of Standards' : 'ZABS — Zambia Bureau of Standards'}
              </p>
              <CountryBadge code={user?.country} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-gray-900">{user?.full_name}</p>
            <p className="text-xs text-gray-400">Standards Officer</p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-400
              px-3 py-1.5 rounded-lg transition-colors"
          >
            ← Dashboard
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* ── Stats row ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Pending Review', value: stats.pending,  color: 'text-amber-600',   bg: 'bg-amber-50  border-amber-200',  filter: 'pending'  },
            { label: 'Approved',       value: stats.approved, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', filter: 'approved' },
            { label: 'Rejected',       value: stats.rejected, color: 'text-red-600',     bg: 'bg-red-50    border-red-200',    filter: 'rejected' },
          ].map(({ label, value, color, bg, filter }) => (
            <button
              key={label}
              onClick={() => { setActiveTab('documents'); handleFilterChange(filter); }}
              className={`rounded-2xl border p-5 text-left transition-all hover:shadow-sm ${bg}`}
            >
              <p className={`text-3xl font-black ${color}`}>{value}</p>
              <p className="text-xs font-semibold text-gray-600 mt-1">{label}</p>
            </button>
          ))}
        </div>

        {/* ── Tab bar ─────────────────────────────────────────────────────── */}
        <div className="flex bg-white border border-gray-200 rounded-xl p-1 gap-1 w-fit">
          {[
            { id: 'documents',    label: 'Documents',    icon: '📄' },
            { id: 'certificates', label: 'Certificates', icon: '🏅' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 text-sm font-semibold px-5 py-2.5 rounded-lg transition-all
                ${activeTab === tab.id
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ── Documents Tab ────────────────────────────────────────────────── */}
        {activeTab === 'documents' && (
          <div className="space-y-4">
            {/* Filter bar */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-1">Filter:</span>
              {[
                { value: '',         label: 'All'      },
                { value: 'pending',  label: 'Pending'  },
                { value: 'approved', label: 'Approved' },
                { value: 'rejected', label: 'Rejected' },
              ].map(({ value, label }) => (
                <button
                  key={label}
                  onClick={() => handleFilterChange(value)}
                  className={`text-xs font-semibold px-3.5 py-1.5 rounded-lg border transition-all
                    ${statusFilter === value
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {docsLoading && (
              <div className="flex justify-center py-16">
                <Spinner size="lg" />
              </div>
            )}

            {docsError && <Alert type="error" message={docsError} />}

            {!docsLoading && !docsError && (
              <>
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {['Document Type', 'Trader', 'Destination', 'Uploaded', 'Status', 'Actions'].map((h) => (
                          <th key={h} className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-5 py-3">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {docs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center text-sm text-gray-400 py-16">
                            {statusFilter
                              ? `No ${statusFilter} documents found for your country.`
                              : 'No documents found.'}
                          </td>
                        </tr>
                      ) : (
                        docs.map((doc) => (
                          <DocRow
                            key={doc.id}
                            doc={doc}
                            onReview={setReviewDoc}
                            onIssue={setIssueDoc}
                            issuedCertIds={issuedCertIds}
                          />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {pagination && pagination.total_pages > 1 && (
                  <div className="flex items-center justify-between text-sm">
                    <p className="text-gray-400 text-xs">
                      Page {pagination.page} of {pagination.total_pages} · {pagination.total} documents
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page === 1}
                        className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50
                          disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs font-medium"
                      >
                        ← Prev
                      </button>
                      <button
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page === pagination.total_pages}
                        className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50
                          disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs font-medium"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Certificates Tab ──────────────────────────────────────────────── */}
        {activeTab === 'certificates' && (
          <CertificatesTab token={token} user={user} />
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {reviewDoc && (
        <ReviewModal
          doc={reviewDoc}
          token={token}
          onClose={() => setReviewDoc(null)}
          onReviewed={(updated) => { handleReviewed(updated); setReviewDoc(null); }}
        />
      )}

      {issueDoc && (
        <IssueCertModal
          doc={issueDoc}
          user={user}
          token={token}
          onClose={() => setIssueDoc(null)}
          onIssued={(cert) => { handleIssued(cert); setIssueDoc(null); }}
        />
      )}
    </div>
  );
};

export default StandardsOfficer;
