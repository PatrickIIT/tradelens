// frontend/src/lib/supabase.js
import { createClient } from '@supabase/supabase-js';

// ─── Environment Variables ────────────────────────────────────────────────────
// Set these in frontend/.env (never commit .env to git)
//
// VITE_SUPABASE_URL=https://your-project.supabase.co
// VITE_SUPABASE_ANON_KEY=your-anon-key
//
// The anon key is safe to expose in the browser — Supabase Row Level Security
// (RLS) enforces data access rules server-side. Never use the service role key
// here; that stays in the backend only (SUPABASE_SERVICE_KEY in backend/.env).

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ─── Validation ───────────────────────────────────────────────────────────────
// Fail fast in development if env vars are missing — prevents silent auth
// failures that are hard to debug on Vercel or during UAT (Sprint S4)
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    '[supabase.js] Missing environment variables.\n' +
    'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to frontend/.env\n' +
    'See .env.example in the project root for reference.'
  );
}

// ─── Client ───────────────────────────────────────────────────────────────────
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Persist session in localStorage so traders stay logged in
    // across page refreshes and browser restarts
    persistSession:    true,
    storageKey:        'tradelens_session',

    // Automatically refresh the access token before it expires —
    // critical for long customs verification sessions at the border (US-05)
    autoRefreshToken:  true,

    // Detect session from URL hash after OAuth redirects (future-proofing
    // for when you add Google/gov SSO post-MVP)
    detectSessionInUrl: true,
  },

  // Supabase Storage is used by documents.js (backend) but the frontend
  // may need to generate signed URLs or display document previews
  global: {
    headers: {
      'x-application-name': 'tradelens',
    },
  },
});

// ─── Auth Helpers ─────────────────────────────────────────────────────────────
// Thin wrappers used across pages — keeps fetch logic out of components
// and consistent with the backend session shape from POST /api/auth/login

// Get the current active session (access_token, refresh_token, expires_at)
export const getSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('[supabase.js] getSession error:', error.message);
    return null;
  }
  return session;
};

// Get the current access token — used as Bearer in fetch calls across pages
// Falls back to null safely so callers can check before using
export const getAccessToken = async () => {
  const session = await getSession();
  return session?.access_token || null;
};

// ─── Storage Helpers ──────────────────────────────────────────────────────────
// Used to generate public URLs for document previews in the
// Standards Officer portal (US-04) and Trader Dashboard (US-02)

// Get a public URL for a file in the documents bucket
// storagePath matches the format built in documents.js:
// {trader_id}/{product_id}/{document_type}/{timestamp}.{ext}
export const getDocumentUrl = (storagePath) => {
  if (!storagePath) return null;
  const { data } = supabase.storage
    .from('documents')
    .getPublicUrl(storagePath);
  return data?.publicUrl || null;
};

// Get a short-lived signed URL (60 minutes) for private document access
// Use this instead of getDocumentUrl if the documents bucket is private
export const getSignedDocumentUrl = async (storagePath, expiresInSeconds = 3600) => {
  if (!storagePath) return null;
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) {
    console.error('[supabase.js] getSignedDocumentUrl error:', error.message);
    return null;
  }
  return data?.signedUrl || null;
};

export default supabase;
