// frontend/src/pages/Login.jsx
// Public page — Login (all roles) + Trader self-registration
// POST /api/auth/login  |  POST /api/auth/register

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'https://tradelens-api.onrender.com';

// ─── Role → dashboard route map ───────────────────────────────────────────────
const ROLE_ROUTES = {
  trader:           '/dashboard',
  standards_officer: '/standards',
  customs_officer:  '/verify',
  admin:            '/admin',
};

// ─── Password strength indicator ─────────────────────────────────────────────
const getStrength = (pw) => {
  if (!pw) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8)        score++;
  if (/[A-Z]/.test(pw))     score++;
  if (/[0-9]/.test(pw))     score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const map = [
    { label: '',        color: 'bg-gray-200' },
    { label: 'Weak',    color: 'bg-red-400'   },
    { label: 'Fair',    color: 'bg-amber-400'  },
    { label: 'Good',    color: 'bg-sky-400'    },
    { label: 'Strong',  color: 'bg-emerald-500' },
  ];
  return { score, ...map[score] };
};

// ─── Shared input component ───────────────────────────────────────────────────
const Field = ({ label, id, type = 'text', value, onChange, placeholder, autoComplete, children, hint }) => (
  <div>
    <label htmlFor={id} className="block text-xs font-semibold text-stone-600 mb-1.5 tracking-wide uppercase">
      {label}
    </label>
    <div className="relative">
      {children ? (
        children
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-800 placeholder-stone-400
            focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent focus:bg-white
            transition-all duration-150"
        />
      )}
    </div>
    {hint && <p className="mt-1 text-[11px] text-stone-400">{hint}</p>}
  </div>
);

// ─── Select component ─────────────────────────────────────────────────────────
const SelectField = ({ label, id, value, onChange, options }) => (
  <div>
    <label htmlFor={id} className="block text-xs font-semibold text-stone-600 mb-1.5 tracking-wide uppercase">
      {label}
    </label>
    <select
      id={id}
      value={value}
      onChange={onChange}
      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-800
        focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent focus:bg-white
        transition-all duration-150 appearance-none cursor-pointer"
    >
      {options.map(({ value: v, label: l }) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  </div>
);

// ─── Alert banner ─────────────────────────────────────────────────────────────
const Alert = ({ type, message }) => {
  const styles = {
    error:   'bg-red-50 border-red-200 text-red-700',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    info:    'bg-sky-50 border-sky-200 text-sky-700',
  };
  const icons = { error: '✕', success: '✓', info: 'ℹ' };
  return (
    <div className={`flex items-start gap-2.5 border rounded-xl px-4 py-3 text-sm ${styles[type]}`}>
      <span className="font-bold shrink-0 mt-0.5">{icons[type]}</span>
      <span>{message}</span>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const Login = () => {
  const navigate  = useNavigate();
  const { login: ctxLogin, user } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' | 'register'

  // Login form
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);

  // Register form
  const [regForm, setRegForm] = useState({
    full_name: '',
    email: '',
    password: '',
    country: 'TZ',
    phone: '',
    role: 'trader',
  });
  const [showRegPw, setShowRegPw] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState(null);
  const [regSuccess, setRegSuccess] = useState(null);

  const pwStrength = getStrength(regForm.password);

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate(ROLE_ROUTES[user.role] || '/dashboard');
    }
  }, [user, navigate]);

  // ── Login submit ─────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginForm.email || !loginForm.password) {
      setLoginError('Please enter your email and password.');
      return;
    }
    setLoginLoading(true);
    setLoginError(null);
    try {
      const r = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginForm.email.trim(), password: loginForm.password }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || 'Login failed.');

      // Persist session via AuthContext
      ctxLogin(data.data);

      // Navigate by role
      navigate(ROLE_ROUTES[data.data.user.role] || '/dashboard');
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  // ── Register submit ──────────────────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    setRegError(null);
    setRegSuccess(null);

    // Client-side validation
    if (!regForm.full_name.trim() || !regForm.email.trim() || !regForm.password) {
      setRegError('Full name, email, and password are required.');
      return;
    }
    if (regForm.password.length < 8 || !/[A-Z]/.test(regForm.password) || !/[0-9]/.test(regForm.password)) {
      setRegError('Password must be at least 8 characters with one uppercase letter and one number.');
      return;
    }

    setRegLoading(true);
    try {
      const body = {
        full_name: regForm.full_name.trim(),
        email:     regForm.email.trim(),
        password:  regForm.password,
        role:      'trader', // only traders self-register
        country:   regForm.country,
      };
      if (regForm.phone.trim()) body.phone = regForm.phone.trim();

      const r = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || 'Registration failed.');

      setRegSuccess('Account created! You can now sign in.');
      setRegForm({ full_name: '', email: '', password: '', country: 'TZ', phone: '', role: 'trader' });
      setTimeout(() => setMode('login'), 1800);
    } catch (err) {
      setRegError(err.message);
    } finally {
      setRegLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f5f0e8] flex">

      {/* ── Left panel: branding ─────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-1/2 bg-stone-900 flex-col justify-between p-12 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-amber-500/10 pointer-events-none" />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-amber-500/5 pointer-events-none" />
        <div className="absolute top-1/2 -translate-y-1/2 right-0 w-px h-2/3 bg-gradient-to-b from-transparent via-amber-500/30 to-transparent pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center shadow-lg">
              <span className="text-stone-900 font-black text-base">TL</span>
            </div>
            <span className="text-white font-bold text-xl tracking-tight">TradeLens</span>
          </div>

          <h2 className="text-white text-4xl font-bold leading-tight mb-6">
            Connecting<br />
            <span className="text-amber-400">Africa</span>,<br />
            one trade at<br />a time.
          </h2>
          <p className="text-stone-400 text-sm leading-relaxed max-w-xs">
            Digital certificate registry and real-time customs verification for the
            Tanzania–Zambia trade corridor.
          </p>
        </div>

        {/* Corridor stats */}
        <div className="relative z-10 grid grid-cols-2 gap-4">
          {[
            { stat: '< 30s',   label: 'Border clearance',   note: 'vs 5–20 days manually' },
            { stat: 'Once',    label: 'Document upload',     note: 'reused across countries' },
            { stat: '4 roles', label: 'Unified portal',      note: 'Trader · Officer · Admin' },
            { stat: 'TZ · ZM', label: 'Corridor coverage',   note: 'TBS, ZABS, TRA, ZRA' },
          ].map(({ stat, label, note }) => (
            <div key={label} className="bg-stone-800/60 rounded-xl p-4 border border-stone-700/50">
              <p className="text-amber-400 font-bold text-lg leading-none mb-1">{stat}</p>
              <p className="text-white text-xs font-semibold">{label}</p>
              <p className="text-stone-500 text-[11px] mt-0.5">{note}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="relative z-10 text-stone-600 text-xs mt-8">
          IIT Madras Zanzibar Campus · 2026
        </p>
      </div>

      {/* ── Right panel: form ────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-stone-900 flex items-center justify-center">
              <span className="text-amber-400 font-black text-sm">TL</span>
            </div>
            <span className="text-stone-900 font-bold text-lg">TradeLens</span>
          </div>

          {/* Mode toggle */}
          <div className="flex bg-stone-200/70 rounded-2xl p-1 mb-8 gap-1">
            {[
              { id: 'login',    label: 'Sign In'   },
              { id: 'register', label: 'Register'  },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setMode(tab.id);
                  setLoginError(null);
                  setRegError(null);
                  setRegSuccess(null);
                }}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200
                  ${mode === tab.id
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-500 hover:text-stone-700'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── LOGIN FORM ──────────────────────────────────────────────── */}
          {mode === 'login' && (
            <div>
              <div className="mb-7">
                <h1 className="text-2xl font-bold text-stone-900">Welcome back</h1>
                <p className="text-sm text-stone-500 mt-1">Sign in to access your portal</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5" noValidate>
                {loginError && <Alert type="error" message={loginError} />}

                <Field
                  label="Email address"
                  id="login-email"
                  type="email"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="you@example.com"
                  autoComplete="email"
                />

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="login-password" className="text-xs font-semibold text-stone-600 tracking-wide uppercase">
                      Password
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showLoginPw ? 'text' : 'password'}
                      value={loginForm.password}
                      onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="Your password"
                      autoComplete="current-password"
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 pr-11 text-sm text-stone-800 placeholder-stone-400
                        focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent focus:bg-white transition-all duration-150"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs font-medium transition-colors select-none"
                    >
                      {showLoginPw ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full bg-stone-900 hover:bg-stone-700 text-white text-sm font-bold py-3.5 rounded-xl
                    transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed
                    focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
                >
                  {loginLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Signing in…
                    </span>
                  ) : 'Sign In'}
                </button>
              </form>

              {/* Role info */}
              <div className="mt-8 bg-white border border-stone-200 rounded-2xl p-5">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3">Portal access by role</p>
                <div className="space-y-2">
                  {[
                    { emoji: '🏪', role: 'Trader',           note: 'Self-register below',          color: 'text-amber-600' },
                    { emoji: '🔬', role: 'Standards Officer', note: 'TBS (TZ) · ZABS (ZM)',         color: 'text-sky-600'   },
                    { emoji: '🛃', role: 'Customs Officer',   note: 'TRA (TZ) · ZRA (ZM)',          color: 'text-emerald-600' },
                    { emoji: '🔧', role: 'Admin',             note: 'System & user management',     color: 'text-purple-600' },
                  ].map(({ emoji, role, note, color }) => (
                    <div key={role} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{emoji}</span>
                        <span className={`text-xs font-semibold ${color}`}>{role}</span>
                      </div>
                      <span className="text-[11px] text-stone-400">{note}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-stone-400 mt-3 border-t border-stone-100 pt-3">
                  Officer and Admin accounts are created by your system administrator.
                </p>
              </div>
            </div>
          )}

          {/* ── REGISTER FORM ───────────────────────────────────────────── */}
          {mode === 'register' && (
            <div>
              <div className="mb-7">
                <h1 className="text-2xl font-bold text-stone-900">Create your account</h1>
                <p className="text-sm text-stone-500 mt-1">
                  Trader self-registration · Free access to the TradeLens platform
                </p>
              </div>

              <form onSubmit={handleRegister} className="space-y-5" noValidate>
                {regError   && <Alert type="error"   message={regError}   />}
                {regSuccess && <Alert type="success" message={regSuccess} />}

                <Field
                  label="Full Name"
                  id="reg-name"
                  value={regForm.full_name}
                  onChange={(e) => setRegForm((f) => ({ ...f, full_name: e.target.value }))}
                  placeholder="e.g. Amina Hassan"
                  autoComplete="name"
                />

                <Field
                  label="Email address"
                  id="reg-email"
                  type="email"
                  value={regForm.email}
                  onChange={(e) => setRegForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="you@example.com"
                  autoComplete="email"
                />

                {/* Password + strength */}
                <div>
                  <label htmlFor="reg-password" className="block text-xs font-semibold text-stone-600 mb-1.5 tracking-wide uppercase">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="reg-password"
                      type={showRegPw ? 'text' : 'password'}
                      value={regForm.password}
                      onChange={(e) => setRegForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="Min 8 chars, 1 uppercase, 1 number"
                      autoComplete="new-password"
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 pr-11 text-sm text-stone-800 placeholder-stone-400
                        focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent focus:bg-white transition-all duration-150"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs font-medium transition-colors select-none"
                    >
                      {showRegPw ? 'Hide' : 'Show'}
                    </button>
                  </div>

                  {/* Strength bar */}
                  {regForm.password && (
                    <div className="mt-2">
                      <div className="flex gap-1 h-1">
                        {[1, 2, 3, 4].map((n) => (
                          <div
                            key={n}
                            className={`flex-1 rounded-full transition-all duration-300 ${
                              n <= pwStrength.score ? pwStrength.color : 'bg-stone-200'
                            }`}
                          />
                        ))}
                      </div>
                      {pwStrength.label && (
                        <p className="text-[11px] text-stone-400 mt-1">Strength: {pwStrength.label}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Country + phone row */}
                <div className="grid grid-cols-2 gap-4">
                  <SelectField
                    label="Country"
                    id="reg-country"
                    value={regForm.country}
                    onChange={(e) => setRegForm((f) => ({ ...f, country: e.target.value }))}
                    options={[
                      { value: 'TZ', label: '🇹🇿 Tanzania' },
                      { value: 'ZM', label: '🇿🇲 Zambia'   },
                    ]}
                  />

                  <Field
                    label="Phone (optional)"
                    id="reg-phone"
                    type="tel"
                    value={regForm.phone}
                    onChange={(e) => setRegForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+255712345678"
                    autoComplete="tel"
                  />
                </div>

                {/* Role note */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
                  <span className="text-amber-500 text-base shrink-0">🏪</span>
                  <div>
                    <p className="text-xs font-semibold text-amber-800">Trader account</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Self-registration is available for traders only. Standards Officers and Customs
                      Officers are created by the system administrator.
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={regLoading || !!regSuccess}
                  className="w-full bg-stone-900 hover:bg-stone-700 text-white text-sm font-bold py-3.5 rounded-xl
                    transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed
                    focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
                >
                  {regLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating account…
                    </span>
                  ) : regSuccess ? '✓ Done — redirecting…' : 'Create Trader Account'}
                </button>
              </form>
            </div>
          )}

          {/* Footer */}
          <p className="text-center text-[11px] text-stone-400 mt-10">
            TradeLens · Tanzania–Zambia Trade Corridor · IIT Madras Zanzibar 2026
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
