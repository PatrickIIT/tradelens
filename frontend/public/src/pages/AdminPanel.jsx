// frontend/src/pages/AdminPanel.jsx
import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLES = ['standards_officer', 'customs_officer', 'admin'];
const COUNTRIES = [
  { code: 'TZ', label: 'Tanzania' },
  { code: 'ZM', label: 'Zambia'   },
];
const ROLE_LABELS = {
  trader:            'Trader',
  standards_officer: 'Standards Officer',
  customs_officer:   'Customs Officer',
  admin:             'Admin',
};
const ROLE_COLOURS = {
  trader:            'bg-blue-100 text-blue-800',
  standards_officer: 'bg-purple-100 text-purple-800',
  customs_officer:   'bg-yellow-100 text-yellow-800',
  admin:             'bg-red-100 text-red-800',
};
const COUNTRY_LABELS = { TZ: 'Tanzania', ZM: 'Zambia' };

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (iso) => iso ? new Date(iso).toLocaleDateString('en-GB') : '—';

const badge = (active) =>
  active
    ? 'bg-green-100 text-green-800'
    : 'bg-gray-100 text-gray-500';

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatCard = ({ label, value, colour = 'text-gray-900' }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-1">
    <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
    <span className={`text-3xl font-bold ${colour}`}>{value ?? '—'}</span>
  </div>
);

const SectionHeader = ({ title, subtitle }) => (
  <div className="mb-4">
    <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
    {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
  </div>
);

const Alert = ({ type, message, onClose }) => {
  const styles = {
    success: 'bg-green-50 border-green-400 text-green-800',
    error:   'bg-red-50 border-red-400 text-red-800',
    info:    'bg-blue-50 border-blue-400 text-blue-800',
  };
  return (
    <div className={`border-l-4 p-4 rounded-r-lg flex justify-between items-start ${styles[type]}`}>
      <p className="text-sm">{message}</p>
      {onClose && (
        <button onClick={onClose} className="ml-4 text-lg leading-none opacity-60 hover:opacity-100">
          ×
        </button>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const AdminPanel = () => {
  const { user, isAdmin, getToken } = useAuth();

  // ── Tab state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('overview');

  // ── Stats (Overview tab) ───────────────────────────────────────────────────
  const [stats, setStats]           = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // ── Users tab ─────────────────────────────────────────────────────────────
  const [users, setUsers]           = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState(null);
  const [userFilter, setUserFilter] = useState({ role: '', country: '', search: '' });
  const [deactivating, setDeactivating] = useState(null); // user id being deactivated

  // ── Create Officer modal ───────────────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: '', password: '', full_name: '',
    role: 'standards_officer', country: 'TZ', phone: '',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError]   = useState(null);
  const [createSuccess, setCreateSuccess] = useState(null);

  // ── Audit tab ─────────────────────────────────────────────────────────────
  const [auditLogs, setAuditLogs]     = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilters, setAuditFilters] = useState({
    country: '', from_date: '', to_date: '',
  });

  // ── Feedback ──────────────────────────────────────────────────────────────
  const [feedback, setFeedback] = useState(null); // { type, message }

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!isAdmin) return <Navigate to="/" replace />;

  // ─── Fetch: Verification Stats ─────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const params = new URLSearchParams();
      if (auditFilters.country)   params.set('country',   auditFilters.country);
      if (auditFilters.from_date) params.set('from_date', auditFilters.from_date);
      if (auditFilters.to_date)   params.set('to_date',   auditFilters.to_date);

      const res = await fetch(`${API}/api/verify/stats?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (res.ok) setStats(data.data);
    } catch (err) {
      console.error('[AdminPanel] fetchStats error:', err.message);
    } finally {
      setStatsLoading(false);
    }
  }, [getToken, auditFilters]);

  // ─── Fetch: Users ──────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const res = await fetch(`${API}/api/auth/users`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (res.ok) setUsers(data.data || []);
      else setUsersError(data.message);
    } catch (err) {
      setUsersError('Failed to load users.');
    } finally {
      setUsersLoading(false);
    }
  }, [getToken]);

  // ─── Fetch: Audit Logs ─────────────────────────────────────────────────────
  const fetchAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    try {
      const params = new URLSearchParams();
      if (auditFilters.country)   params.set('country',   auditFilters.country);
      if (auditFilters.from_date) params.set('from_date', auditFilters.from_date);
      if (auditFilters.to_date)   params.set('to_date',   auditFilters.to_date);

      const res = await fetch(`${API}/api/verify/stats?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (res.ok) setAuditLogs(data.data?.by_action ? Object.entries(data.data.by_action) : []);
    } catch (err) {
      console.error('[AdminPanel] fetchAuditLogs error:', err.message);
    } finally {
      setAuditLoading(false);
    }
  }, [getToken, auditFilters]);

  // ─── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
  }, [activeTab, fetchUsers]);
  useEffect(() => {
    if (activeTab === 'audit') fetchAuditLogs();
  }, [activeTab, fetchAuditLogs]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleDeactivate = async (userId, userName) => {
    if (!window.confirm(`Deactivate account for ${userName}? They will lose access immediately.`)) return;
    setDeactivating(userId);
    try {
      const res = await fetch(`${API}/api/auth/users/${userId}/deactivate`, {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => u.id === userId ? { ...u, is_active: false } : u)
        );
        setFeedback({ type: 'success', message: `${userName}'s account has been deactivated.` });
      } else {
        setFeedback({ type: 'error', message: data.message });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Failed to deactivate account.' });
    } finally {
      setDeactivating(null);
    }
  };

  const handleCreateOfficer = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);
    setCreateSuccess(null);

    try {
      const res = await fetch(`${API}/api/auth/users`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          ...createForm,
          phone: createForm.phone || undefined,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setCreateSuccess(`Account created for ${createForm.full_name}.`);
        setCreateForm({
          email: '', password: '', full_name: '',
          role: 'standards_officer', country: 'TZ', phone: '',
        });
        if (activeTab === 'users') fetchUsers();
      } else {
        setCreateError(data.message || 'Failed to create account.');
      }
    } catch {
      setCreateError('Network error. Please try again.');
    } finally {
      setCreateLoading(false);
    }
  };

  // ─── Filtered Users ────────────────────────────────────────────────────────
  const filteredUsers = users.filter((u) => {
    const matchRole    = !userFilter.role    || u.role    === userFilter.role;
    const matchCountry = !userFilter.country || u.country === userFilter.country;
    const matchSearch  = !userFilter.search  ||
      u.full_name.toLowerCase().includes(userFilter.search.toLowerCase()) ||
      u.email.toLowerCase().includes(userFilter.search.toLowerCase());
    return matchRole && matchCountry && matchSearch;
  });

  // ─── Tabs ──────────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'overview', label: 'Overview'      },
    { id: 'users',    label: 'User Management' },
    { id: 'audit',    label: 'Audit & Stats'  },
  ];

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              TradeLens · Tanzania–Zambia Corridor · {user?.full_name}
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            + Create Officer Account
          </button>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-6xl mx-auto flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Feedback Banner ───────────────────────────────────────────────── */}
      {feedback && (
        <div className="max-w-6xl mx-auto px-6 pt-4">
          <Alert
            type={feedback.type}
            message={feedback.message}
            onClose={() => setFeedback(null)}
          />
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-6">

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* OVERVIEW TAB                                                     */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="space-y-8">

            {/* Sprint progress */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <SectionHeader
                title="MVP Sprint Progress"
                subtitle="Target: 30 June 2026 · IIT Madras Zanzibar Campus"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { sprint: 'S1', dates: '1–14 May',    focus: 'Docs, wireframes, auth',          done: true  },
                  { sprint: 'S2', dates: '15–28 May',   focus: 'Trader & Standards portals',      done: false },
                  { sprint: 'S3', dates: '29 May–11 Jun', focus: 'Customs, SMS, admin',           done: false },
                  { sprint: 'S4', dates: '12–30 Jun',   focus: 'Testing, UAT, 5-trader pilot',    done: false },
                ].map((s) => (
                  <div
                    key={s.sprint}
                    className={`rounded-lg border p-4 ${
                      s.done
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-gray-900">Sprint {s.sprint}</span>
                      {s.done && (
                        <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full">
                          Done
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{s.dates}</p>
                    <p className="text-sm text-gray-700 mt-1">{s.focus}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Verification stats */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <SectionHeader
                  title="Verification Statistics"
                  subtitle="Live data from verification_log — all corridor activity"
                />
                <button
                  onClick={fetchStats}
                  disabled={statsLoading}
                  className="text-sm text-gray-500 hover:text-gray-800 underline"
                >
                  {statsLoading ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>

              {statsLoading ? (
                <p className="text-gray-400 text-sm">Loading stats…</p>
              ) : stats ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                      label="Total Verifications"
                      value={stats.total_verifications}
                      colour="text-gray-900"
                    />
                    <StatCard
                      label="QR Scans"
                      value={stats.by_action?.verification_qr || 0}
                      colour="text-blue-700"
                    />
                    <StatCard
                      label="Manual Searches"
                      value={stats.by_action?.verification_search || 0}
                      colour="text-purple-700"
                    />
                    <StatCard
                      label="Tamper Alerts"
                      value={stats.by_action?.verification_tamper_detected || 0}
                      colour={
                        (stats.by_action?.verification_tamper_detected || 0) > 0
                          ? 'text-red-600'
                          : 'text-gray-400'
                      }
                    />
                  </div>

                  {/* By country breakdown */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {Object.entries(stats.by_country || {}).map(([country, count]) => (
                      <div
                        key={country}
                        className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between"
                      >
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">
                            {COUNTRY_LABELS[country] || country}
                          </p>
                          <p className="text-2xl font-bold text-gray-900 mt-0.5">{count}</p>
                        </div>
                        <span className="text-3xl">{country === 'TZ' ? '🇹🇿' : '🇿🇲'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-gray-400 text-sm">No statistics available yet.</p>
              )}
            </div>

            {/* Business requirements status */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <SectionHeader
                title="Business Requirements Status"
                subtitle="MVP scope — Tanzania–Zambia corridor"
              />
              <div className="space-y-3">
                {[
                  { id: 'BR-01', label: 'Single digital certificate registry',           done: true  },
                  { id: 'BR-02', label: 'Upload once, reuse across both countries',       done: true  },
                  { id: 'BR-03', label: 'Customs verification in under 30 seconds',       done: true  },
                  { id: 'BR-06', label: 'Immutable audit trail for all transactions',     done: true  },
                ].map((br) => (
                  <div key={br.id} className="flex items-center gap-3">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                      br.done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
                    }`}>
                      {br.done ? '✓' : '○'}
                    </span>
                    <span className="text-xs font-mono text-gray-400 w-12">{br.id}</span>
                    <span className="text-sm text-gray-700">{br.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* USERS TAB                                                        */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'users' && (
          <div className="space-y-5">
            <SectionHeader
              title="User Management"
              subtitle="All registered users across the Tanzania–Zambia corridor"
            />

            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3">
              <input
                type="text"
                placeholder="Search name or email…"
                value={userFilter.search}
                onChange={(e) => setUserFilter((f) => ({ ...f, search: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
              <select
                value={userFilter.role}
                onChange={(e) => setUserFilter((f) => ({ ...f, role: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                <option value="">All roles</option>
                {Object.entries(ROLE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              <select
                value={userFilter.country}
                onChange={(e) => setUserFilter((f) => ({ ...f, country: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                <option value="">All countries</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
              <button
                onClick={fetchUsers}
                className="text-sm text-gray-500 hover:text-gray-800 underline px-2"
              >
                Refresh
              </button>
            </div>

            {/* Users table */}
            {usersLoading ? (
              <p className="text-gray-400 text-sm py-8 text-center">Loading users…</p>
            ) : usersError ? (
              <Alert type="error" message={usersError} />
            ) : filteredUsers.length === 0 ? (
              <p className="text-gray-400 text-sm py-8 text-center">No users match your filters.</p>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {['Name', 'Email', 'Role', 'Country', 'Status', 'Joined', 'Actions'].map((h) => (
                          <th
                            key={h}
                            className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900">{u.full_name}</td>
                          <td className="px-4 py-3 text-gray-500">{u.email}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${ROLE_COLOURS[u.role]}`}>
                              {ROLE_LABELS[u.role]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {u.country === 'TZ' ? '🇹🇿 Tanzania' : '🇿🇲 Zambia'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${badge(u.is_active)}`}>
                              {u.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-400">{fmt(u.created_at)}</td>
                          <td className="px-4 py-3">
                            {u.is_active && u.id !== user?.id ? (
                              <button
                                onClick={() => handleDeactivate(u.id, u.full_name)}
                                disabled={deactivating === u.id}
                                className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                              >
                                {deactivating === u.id ? 'Deactivating…' : 'Deactivate'}
                              </button>
                            ) : u.id === user?.id ? (
                              <span className="text-xs text-gray-300">You</span>
                            ) : (
                              <span className="text-xs text-gray-300">Inactive</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
                  <p className="text-xs text-gray-400">
                    Showing {filteredUsers.length} of {users.length} users
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* AUDIT & STATS TAB                                                */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'audit' && (
          <div className="space-y-5">
            <SectionHeader
              title="Audit & Verification Stats"
              subtitle="Immutable verification_log — BR-06 compliance"
            />

            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Country</label>
                <select
                  value={auditFilters.country}
                  onChange={(e) => setAuditFilters((f) => ({ ...f, country: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                >
                  <option value="">Both corridors</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">From date</label>
                <input
                  type="date"
                  value={auditFilters.from_date}
                  onChange={(e) => setAuditFilters((f) => ({ ...f, from_date: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">To date</label>
                <input
                  type="date"
                  value={auditFilters.to_date}
                  onChange={(e) => setAuditFilters((f) => ({ ...f, to_date: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
              </div>
              <button
                onClick={fetchAuditLogs}
                className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Apply Filters
              </button>
              <button
                onClick={() => {
                  setAuditFilters({ country: '', from_date: '', to_date: '' });
                }}
                className="text-sm text-gray-400 hover:text-gray-600 underline px-2"
              >
                Clear
              </button>
            </div>

            {/* Action breakdown */}
            {auditLoading ? (
              <p className="text-gray-400 text-sm py-8 text-center">Loading audit data…</p>
            ) : auditLogs.length === 0 ? (
              <p className="text-gray-400 text-sm py-8 text-center">
                No audit events found for the selected filters.
              </p>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Event Type', 'Count', 'Severity'].map((h) => (
                        <th
                          key={h}
                          className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {auditLogs.map(([action, count]) => {
                      const isTamper = action.includes('tamper');
                      const isRevoke = action.includes('revoked');
                      return (
                        <tr key={action} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-xs text-gray-700">{action}</td>
                          <td className="px-4 py-3 font-semibold text-gray-900">{count}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                              isTamper
                                ? 'bg-red-100 text-red-700'
                                : isRevoke
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-gray-100 text-gray-600'
                            }`}>
                              {isTamper ? 'Critical' : isRevoke ? 'Warning' : 'Info'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* CREATE OFFICER MODAL                                                 */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Create Officer Account</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateError(null);
                  setCreateSuccess(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4">
              {createSuccess && <Alert type="success" message={createSuccess} />}
              {createError   && <Alert type="error"   message={createError}   />}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={createForm.full_name}
                    onChange={(e) => setCreateForm((f) => ({ ...f, full_name: e.target.value }))}
                    placeholder="e.g. Joseph Banda"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="officer@zbs.gov.zm"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
                  <input
                    type="password"
                    value={createForm.password}
                    onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="Min 8 chars, 1 uppercase, 1 number"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                    <select
                      value={createForm.role}
                      onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Country</label>
                    <select
                      value={createForm.country}
                      onChange={(e) => setCreateForm((f) => ({ ...f, country: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Phone <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="tel"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+255712345678"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                  />
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateError(null);
                  setCreateSuccess(null);
                }}
                className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOfficer}
                disabled={createLoading || !createForm.email || !createForm.password || !createForm.full_name}
                className="bg-gray-900 text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {createLoading ? 'Creating…' : 'Create Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
