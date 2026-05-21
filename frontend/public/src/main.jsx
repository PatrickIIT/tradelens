// frontend/src/main.jsx
// TradeLens — Vite PWA entry point
// Mounts <App /> into #root with StrictMode.
// PWA service-worker registration is handled by vite-plugin-pwa (vite.config.js).

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css'; // global resets / Tailwind base (if used)

// ── Mount ─────────────────────────────────────────────────────────────────────
const container = document.getElementById('root');

if (!container) {
  throw new Error(
    '[TradeLens] Could not find #root element. ' +
    'Check that index.html contains <div id="root"></div>.'
  );
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// ── PWA service-worker registration ──────────────────────────────────────────
// vite-plugin-pwa auto-generates /sw.js and injects the registerSW helper.
// Import it here so the SW is registered on first load.
//
// To enable: add vite-plugin-pwa to vite.config.js, then uncomment below.
//
// import { registerSW } from 'virtual:pwa-register';
//
// const updateSW = registerSW({
//   onNeedRefresh() {
//     // Optional: prompt user to refresh when a new version is available.
//     if (window.confirm('A new version of TradeLens is available. Reload?')) {
//       updateSW(true);
//     }
//   },
//   onOfflineReady() {
//     console.info('[TradeLens] App ready to work offline.');
//   },
// });
