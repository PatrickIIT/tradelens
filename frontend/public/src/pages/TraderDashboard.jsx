// frontend/src/pages/TraderDashboard.jsx
// US-01 — Upload compliance documents (once, reused across both countries)
// US-02 — View compliance checklist with green / amber / red status
// US-03 — Download digital certificate PDF

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'https://tradelens-api.onrender.com';

// ─── Constants ─────────────────────────────────────────────────────────────────
const DOC_TYPES = [
  { value: 'phytosanitary_certificate',  label: 'Phytosanitary Certificate'  },
  { value: 'certificate_of_origin',      label: 'Certificate of Origin'      },
  { value: 'packing_list',               label: 'Packing List'               },
  { value: 'commercial_invoice',         label: 'Commercial Invoice'         },
  { value: 'import_permit',              label: 'Import Permit'              },
  { value: 'quality_inspection_report',  label: 'Quality Inspection Report'  },
];

const ACCEPTED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_MB   = 10;

// ─── Helpers ────────────────────────────────────────────────────────────────────
const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : '—';

const fmtDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '—';

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });

// ─── Small UI atoms ─────────────────────────────────────────────────────────────
const CountryBadge = ({ code }) => (
  <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border
    ${code === 'TZ'
      ? 'bg-sky-50 text-sky-700 border-sky-200'
      : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
    {code === 'TZ' ? '🇹🇿' : '🇿🇲'} {code}
  </span>
);

const Spinner = ({ size = 'sm' }) => (
  <span
    className={`inline-block rounded-full border-2 border-current/30 border-t-current animate-spin
      ${size === 'lg' ? 'w-8 h-8' : 'w-4 h-4'}`}
  />
);

const Alert = ({ type, message, onClose }) => {
  const styles = {
    error:   'bg-red-50 border-red-200 text-red-700',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    info:    'bg-sky-50 border-sky-200 text-sky-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
  };
  const icons = { error: '✕', success: '✓', info: 'ℹ', warning: '⚠' };
  return (
    <div className={`flex items-start gap-2.5 border rounded-xl px-4 py-3 text-sm ${styles[type]}`}>
      <span className="font-bold shrink-0 mt-0.5">{icons[type]}</span>
      <span className="flex-1">{message}</span>
      {onClose && (
        <button onClick={onClose} className="shrink-0 opacity-60 hover:opacity-100 font-bold">×</button>
      )}
    </div>
  );
};

// ─── Document status pill ────────────────────────────────────────────────────────
const StatusPill = ({ status }) => {
  const map = {
    pending:  { cls: 'bg-amber-100 text-amber-800 border-amber-300',      icon: '⏳', label: 'Pending'  },
    approved: { cls: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: '✓',  label: 'Approved' },
    rejected: { cls: 'bg-red-100 text-red-800 border-red-300',             icon: '✕',  label: 'Rejected' },
    missing:  { cls: 'bg-gray-100 text-gray-500 border-gray-300',          icon: '–',  label: 'Missing'  },
    active:   { cls: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: '✓',  label: 'Active'   },
    revoked:  { cls: 'bg-red-100 text-red-800 border-red-300',             icon: '✕',  label: 'Revoked'  },
    expired:  { cls: 'bg-gray-100 text-gray-600 border-gray-300',          icon: '⏱', label: 'Expired'  },
  };
  const cfg = map[status] || map.missing;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
};

// ─── Compliance traffic-light dot ────────────────────────────────────────────────
const ComplianceDot = ({ colour }) => {
  const map = {
    green: 'bg-emerald-500',
    amber: 'bg-amber-400',
    red:   'bg-red-500',
  };
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${map[colour] || 'bg-gray-300'}`} />;
};

// ─── Upload Document Modal (US-01) ───────────────────────────────────────────────
const UploadModal = ({ token, onClose, onUploaded }) => {
  const [form, setForm] = useState({
    document_type:       DOC_TYPES[0].value,
    destination_country: 'TZ',
    description:         '',
  });
  const [file,     setFile]     = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [success,  setSuccess]  = useState(null);
  const fileRef = useRef();

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ACCEPTED_MIME.includes(f.type)) {
      setError('Only PDF, JPEG, PNG, and WEBP files are accepted.');
      return;
    }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`File exceeds the ${MAX_FILE_MB} MB limit.`);
      return;
    }
    setFile(f);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!file) { setError('Please select a file.'); return; }
    setLoading(true);
    setError(null);
    try {
      const base64 = await fileToBase64(file);
      const body = {
        document_type:       form.document_type,
        destination_country: form.destination_country,
        description:         form.description.trim() || undefined,
        // product_id is required by the API — use a placeholder UUID if your
        // frontend doesn't yet have a product selector; swap in a real picker
        // from GET /api/products once that endpoint exists.
        product_id: '00000000-0000-0000-0000-000000000001',
        file: base64,
      };
      const r = await fetch(`${API_BASE}/api/documents/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || 'Upload failed.');
      setSuccess('Document uploaded. Awaiting review by a Standards Officer.');
      setTimeout(() => { onUploaded(data.data); onClose(); }, 2000);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Upload Document</h3>
            <p className="text-xs text-gray-400 mt-0.5">US-01 · BR-02 — upload once, reused across both countries</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error   && <Alert type="error"   message={error}   />}
          {success && <Alert type="success" message={success} />}

          {/* Document type */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Document Type
            </label>
            <select
              value={form.document_type}
              onChange={(e) => setForm((f) => ({ ...f, document_type: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50
                focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-white transition-colors"
            >
              {DOC_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Destination country */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Destination Country
            </label>
            <div className="flex gap-3">
              {[
                { code: 'TZ', label: '🇹🇿 Tanzania' },
                { code: 'ZM', label: '🇿🇲 Zambia'   },
              ].map(({ code, label }) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, destination_country: code }))}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-xl border-2 transition-all
                    ${form.destination_country === code
                      ? 'bg-gray-900 border-gray-900 text-white'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Description <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              maxLength={500}
              placeholder="Any notes for the reviewing officer…"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50
                focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-white transition-colors resize-none"
            />
          </div>

          {/* File picker */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              File <span className="font-normal text-gray-400">PDF, JPEG, PNG, WEBP · max {MAX_FILE_MB} MB</span>
            </label>
            <div
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl px-4 py-6 text-center cursor-pointer transition-colors
                ${file
                  ? 'border-teal-400 bg-teal-50'
                  : 'border-gray-200 hover:border-gray-400 bg-gray-50'}`}
            >
              {file ? (
                <div>
                  <p className="text-sm font-semibold text-teal-700">📎 {file.name}</p>
                  <p className="text-xs text-teal-600 mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-500">Click to select a file</p>
                  <p className="text-xs text-gray-400 mt-0.5">or drag and drop</p>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleFile}
              className="hidden"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800 px-4 py-2 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !!success || !file}
            className="flex items-center gap-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold
              px-5 py-2.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading && <Spinner />}
            {loading ? 'Uploading…' : success ? '✓ Uploaded' : 'Upload Document'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Compliance Checklist (US-02) ─────────────────────────────────────────────
const ChecklistPanel = ({ token, destinationCountry }) => {
  const PLACEHOLDER_PRODUCT_ID = '00000000-0000-0000-0000-000000000001';
  const [checklist, setChecklist] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const fetchChecklist = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        product_id:          PLACEHOLDER_PRODUCT_ID,
        destination_country: destinationCountry,
      });
      const r = await fetch(`${API_BASE}/api/documents/checklist?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || 'Failed to load checklist.');
      setChecklist(data.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, destinationCountry]);

  useEffect(() => { fetchChecklist(); }, [fetchChecklist]);

  const overallColour = checklist?.compliance_status || checklist?.overall_status;
  const colourLabel = { green: 'Fully compliant', amber: 'Partially compliant', red: 'Non-compliant' };
  const colourBg    = {
    green: 'bg-emerald-50 border-emerald-200',
    amber: 'bg-amber-50  border-amber-200',
    red:   'bg-red-50    border-red-200',
  };

  if (loading) return (
    <div className="flex justify-center py-10"><Spinner size="lg" /></div>
  );
  if (error)   return <Alert type="error" message={error} />;
  if (!checklist) return null;

  const items = checklist.checklist || [];
  const summary = checklist.summary || {};

  return (
    <div className="space-y-4">
      {/* Overall status banner */}
      <div className={`rounded-2xl border p-5 flex items-center justify-between ${colourBg[overallColour] || 'bg-gray-50 border-gray-200'}`}>
        <div className="flex items-center gap-3">
          <ComplianceDot colour={overallColour} />
          <div>
            <p className="text-sm font-bold text-gray-900">
              {colourLabel[overallColour] || 'Status unknown'} — {destinationCountry === 'TZ' ? '🇹🇿 Tanzania' : '🇿🇲 Zambia'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {summary.approved ?? 0} of {summary.total_required ?? items.length} documents approved
            </p>
          </div>
        </div>
        <div className="flex gap-4 text-center hidden sm:flex">
          {[
            { label: 'Approved', val: summary.approved, color: 'text-emerald-600' },
            { label: 'Pending',  val: summary.pending,  color: 'text-amber-600'   },
            { label: 'Rejected', val: summary.rejected, color: 'text-red-600'     },
            { label: 'Missing',  val: summary.missing,  color: 'text-gray-500'    },
          ].map(({ label, val, color }) => (
            <div key={label}>
              <p className={`text-xl font-black ${color}`}>{val ?? 0}</p>
              <p className="text-[10px] text-gray-400">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Checklist items */}
      <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
        {items.map((item) => {
          const docType = DOC_TYPES.find((d) => d.value === item.document_type);
          return (
            <div key={item.document_type} className="flex items-center justify-between px-5 py-4 gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <ComplianceDot
                  colour={
                    item.status === 'approved' ? 'green'
                    : item.status === 'pending' ? 'amber'
                    : item.status === 'rejected' ? 'red'
                    : 'red'
                  }
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {docType?.label || item.document_type}
                  </p>
                  {item.uploaded_at && (
                    <p className="text-xs text-gray-400 mt-0.5">Uploaded {fmtDate(item.uploaded_at)}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <StatusPill status={item.status === 'missing' ? 'missing' : item.status} />
                {item.file_url && (
                  <a
                    href={item.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-sky-600 hover:text-sky-800 underline underline-offset-2 hidden sm:inline"
                  >
                    View
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── My Documents tab ────────────────────────────────────────────────────────────
const DocumentsTab = ({ token, onUpload, refreshKey }) => {
  const [docs,    setDocs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [page,    setPage]    = useState(1);
  const [pagination, setPagination] = useState(null);

  const fetchDocs = useCallback(async (p = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: p, limit: 10 });
      const r = await fetch(`${API_BASE}/api/documents?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || 'Failed to load documents.');
      setDocs(data.data);
      setPagination(data.pagination);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchDocs(page); }, [fetchDocs, page, refreshKey]);

  if (loading) return <div className="flex justify-center py-14"><Spinner size="lg" /></div>;
  if (error)   return <Alert type="error" message={error} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs text-gray-400">
          {pagination?.total ?? docs.length} document{docs.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={onUpload}
          className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-700 text-white text-xs font-semibold
            px-4 py-2 rounded-lg transition-colors"
        >
          + Upload Document
        </button>
      </div>

      {docs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 py-16 text-center">
          <p className="text-4xl mb-3">📂</p>
          <p className="text-sm font-semibold text-gray-700">No documents yet</p>
          <p className="text-xs text-gray-400 mt-1 mb-5">Upload your first compliance document to get started</p>
          <button
            onClick={onUpload}
            className="bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            Upload Document
          </button>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            {docs.map((doc) => {
              const docType = DOC_TYPES.find((d) => d.value === doc.document_type);
              return (
                <div key={doc.id} className="flex items-start justify-between px-5 py-4 gap-4 hover:bg-gray-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {docType?.label || doc.document_type}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <CountryBadge code={doc.destination_country} />
                      <span className="text-[11px] text-gray-400">Uploaded {fmtDateTime(doc.uploaded_at)}</span>
                    </div>
                    {doc.reviewer_notes && (
                      <p className="text-xs text-gray-500 mt-1.5 italic border-l-2 border-gray-200 pl-2">
                        "{doc.reviewer_notes}"
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 mt-0.5">
                    <StatusPill status={doc.status} />
                    {doc.file_url && (
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-sky-600 hover:text-sky-800 underline underline-offset-2 hidden sm:inline"
                      >
                        View
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination && pagination.total_pages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <p className="text-xs text-gray-400">
                Page {pagination.page} of {pagination.total_pages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-600
                    hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
                  disabled={page === pagination.total_pages}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-600
                    hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── Certificates tab (US-03) ─────────────────────────────────────────────────
const CertificatesTab = ({ token }) => {
  const [certs,   setCerts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [page,    setPage]    = useState(1);
  const [pagination, setPagination] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [dlError, setDlError] = useState(null);

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

  const handleDownload = async (cert) => {
    setDownloading(cert.id);
    setDlError(null);
    try {
      const r = await fetch(`${API_BASE}/api/certificates/${cert.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const data = await r.json();
        throw new Error(data.message || 'Download failed.');
      }
      const blob = await r.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `TradeLens_${cert.certificate_number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setDlError(e.message);
    } finally {
      setDownloading(null);
    }
  };

  if (loading) return <div className="flex justify-center py-14"><Spinner size="lg" /></div>;
  if (error)   return <Alert type="error" message={error} />;

  return (
    <div className="space-y-4">
      {dlError && <Alert type="error" message={dlError} onClose={() => setDlError(null)} />}

      {certs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 py-16 text-center">
          <p className="text-4xl mb-3">🏅</p>
          <p className="text-sm font-semibold text-gray-700">No certificates yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Once a Standards Officer approves your documents, your certificates will appear here.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {certs.map((cert) => {
              const isExpired = cert.valid_until && new Date(cert.valid_until) < new Date();
              const statusDisplay = cert.status === 'active' && isExpired ? 'expired' : cert.status;

              return (
                <div
                  key={cert.id}
                  className={`bg-white rounded-2xl border overflow-hidden
                    ${cert.status === 'active' && !isExpired
                      ? 'border-emerald-200 border-l-4 border-l-emerald-500'
                      : cert.status === 'revoked'
                        ? 'border-red-200 border-l-4 border-l-red-400'
                        : 'border-gray-200 border-l-4 border-l-gray-300'}`}
                >
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-4 px-5 py-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-xs font-mono font-semibold text-gray-500">{cert.certificate_number}</p>
                        <span className="text-gray-300">·</span>
                        <p className="text-xs text-gray-400">{cert.certificate_type}</p>
                      </div>
                      <p className="text-base font-bold text-gray-900 truncate">{cert.product_name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusPill status={statusDisplay} />
                    </div>
                  </div>

                  {/* Details grid */}
                  <div className="border-t border-gray-100 px-5 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">From</p>
                      <CountryBadge code={cert.issuing_country} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">To</p>
                      <CountryBadge code={cert.destination_country} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Issued</p>
                      <p className="text-gray-700 font-medium">{fmtDate(cert.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Valid Until</p>
                      <p className={`font-medium ${isExpired ? 'text-red-500' : 'text-gray-700'}`}>
                        {fmtDate(cert.valid_until)}
                      </p>
                    </div>
                  </div>

                  {/* QR code + download */}
                  <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between gap-3">
                    <div className="text-xs text-gray-400 truncate font-mono hidden sm:block">
                      {cert.sha256_hash ? `SHA-256: ${cert.sha256_hash.slice(0, 24)}…` : ''}
                    </div>
                    <div className="flex items-center gap-3 ml-auto shrink-0">
                      {cert.qr_code_url && (
                        <img
                          src={cert.qr_code_url}
                          alt="Certificate QR"
                          className="w-10 h-10 rounded border border-gray-200"
                        />
                      )}
                      <button
                        onClick={() => handleDownload(cert)}
                        disabled={!!downloading}
                        className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-700 text-white text-xs font-semibold
                          px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {downloading === cert.id ? (
                          <><Spinner /> Downloading…</>
                        ) : (
                          '⬇ Download PDF'
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Revocation notice */}
                  {cert.status === 'revoked' && cert.revocation_reason && (
                    <div className="border-t border-red-100 px-5 py-2 bg-red-50 text-xs text-red-700">
                      <span className="font-semibold">Revoked: </span>{cert.revocation_reason}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination && pagination.total_pages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <p className="text-xs text-gray-400">
                Page {pagination.page} of {pagination.total_pages} · {pagination.total} certificates
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-600
                    hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
                  disabled={page === pagination.total_pages}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-600
                    hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────
const TraderDashboard = () => {
  const navigate = useNavigate();
  const { user, getToken, isTrader, logout } = useAuth();
  const token = getToken();

  const [activeTab, setActiveTab]   = useState('overview'); // 'overview' | 'documents' | 'certificates'
  const [checklistCountry, setChecklistCountry] = useState('TZ');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadRefreshKey, setUploadRefreshKey] = useState(0);
  const [feedback, setFeedback]     = useState(null);

  // Role guard
  useEffect(() => {
    if (user && !isTrader) navigate('/dashboard');
  }, [user, isTrader, navigate]);

  const handleUploaded = (doc) => {
    setFeedback({ type: 'success', message: 'Document uploaded successfully. A Standards Officer will review it shortly.' });
    setUploadRefreshKey((k) => k + 1);
    setActiveTab('documents');
    setTimeout(() => setFeedback(null), 6000);
  };

  const tabs = [
    { id: 'overview',      label: 'Overview',      icon: '📊' },
    { id: 'documents',     label: 'My Documents',  icon: '📄' },
    { id: 'certificates',  label: 'Certificates',  icon: '🏅' },
  ];

  return (
    <div className="min-h-screen bg-[#f7f6f3] font-sans">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-5 py-4 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          {/* Logo + identity */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gray-900 flex items-center justify-center shrink-0">
              <span className="text-white text-sm font-black">TL</span>
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-gray-900 leading-none">TradeLens</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Trader Portal · Tanzania–Zambia Corridor</p>
            </div>
          </div>

          {/* User info + actions */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden md:block">
              <p className="text-sm font-semibold text-gray-900 leading-none">{user?.full_name}</p>
              <div className="flex items-center justify-end gap-1 mt-0.5">
                <CountryBadge code={user?.country} />
              </div>
            </div>
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-700 text-white text-xs font-bold
                px-3.5 py-2 rounded-lg transition-colors shrink-0"
            >
              + Upload
            </button>
            <button
              onClick={logout}
              className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 hover:border-gray-400
                px-3 py-2 rounded-lg transition-colors hidden sm:inline-flex"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-7 space-y-6">

        {/* ── Global feedback ─────────────────────────────────────────────── */}
        {feedback && (
          <Alert type={feedback.type} message={feedback.message} onClose={() => setFeedback(null)} />
        )}

        {/* ── Welcome card ────────────────────────────────────────────────── */}
        <div className="bg-gray-900 text-white rounded-2xl px-6 py-5 flex items-center justify-between gap-4 relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute -right-4 bottom-0 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
          <div className="relative z-10">
            <p className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-1">Welcome back</p>
            <h2 className="text-xl font-black text-white">{user?.full_name}</h2>
            <p className="text-sm text-white/60 mt-0.5">
              {user?.country === 'TZ' ? '🇹🇿 Tanzania' : '🇿🇲 Zambia'} · Trader Account
            </p>
          </div>
          <div className="relative z-10 text-right hidden sm:block">
            <p className="text-[10px] text-white/40 uppercase tracking-wide mb-1">Corridor</p>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-sm">TZ</span>
              <span className="text-white/30">⇄</span>
              <span className="text-white font-bold text-sm">ZM</span>
            </div>
          </div>
        </div>

        {/* ── Tab bar ─────────────────────────────────────────────────────── */}
        <div className="flex bg-white border border-gray-200 rounded-xl p-1 gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold
                px-3 py-2.5 rounded-lg transition-all
                ${activeTab === tab.id
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
            >
              <span className="hidden sm:inline">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">

            {/* Quick actions */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                {
                  icon: '📤',
                  label: 'Upload Document',
                  sub: 'BR-02 — upload once',
                  action: () => setShowUpload(true),
                  accent: 'border-gray-900 hover:bg-gray-900 hover:text-white',
                },
                {
                  icon: '📄',
                  label: 'My Documents',
                  sub: 'Track review status',
                  action: () => setActiveTab('documents'),
                  accent: 'border-gray-200 hover:border-gray-400',
                },
                {
                  icon: '🏅',
                  label: 'My Certificates',
                  sub: 'Download PDF',
                  action: () => setActiveTab('certificates'),
                  accent: 'border-gray-200 hover:border-gray-400',
                },
              ].map(({ icon, label, sub, action, accent }) => (
                <button
                  key={label}
                  onClick={action}
                  className={`bg-white rounded-2xl border-2 p-5 text-left transition-all hover:shadow-sm group ${accent}`}
                >
                  <p className="text-2xl mb-2">{icon}</p>
                  <p className="text-sm font-bold text-gray-900 group-hover:inherit">{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                </button>
              ))}
            </div>

            {/* Compliance checklist */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Compliance Checklist</h3>
                  <p className="text-xs text-gray-400 mt-0.5">US-02 — real-time status of all 6 required documents</p>
                </div>
                {/* Country switcher */}
                <div className="flex bg-gray-100 rounded-xl p-1 gap-1 shrink-0">
                  {['TZ', 'ZM'].map((c) => (
                    <button
                      key={c}
                      onClick={() => setChecklistCountry(c)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all
                        ${checklistCountry === c
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-800'}`}
                    >
                      {c === 'TZ' ? '🇹🇿 TZ' : '🇿🇲 ZM'}
                    </button>
                  ))}
                </div>
              </div>

              <ChecklistPanel token={token} destinationCountry={checklistCountry} />
            </div>
          </div>
        )}

        {/* ── DOCUMENTS TAB ────────────────────────────────────────────────── */}
        {activeTab === 'documents' && (
          <DocumentsTab
            token={token}
            onUpload={() => setShowUpload(true)}
            refreshKey={uploadRefreshKey}
          />
        )}

        {/* ── CERTIFICATES TAB ─────────────────────────────────────────────── */}
        {activeTab === 'certificates' && (
          <CertificatesTab token={token} />
        )}
      </div>

      {/* ── Upload Modal ─────────────────────────────────────────────────────── */}
      {showUpload && (
        <UploadModal
          token={token}
          onClose={() => setShowUpload(false)}
          onUploaded={handleUploaded}
        />
      )}
    </div>
  );
};

export default TraderDashboard;
