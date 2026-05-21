-- ============================================================
-- 001_users.sql
-- TradeLens — User profiles table
-- Tanzania–Zambia Corridor | IIT Madras Zanzibar Campus, 2026
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM (
  'trader',
  'standards_officer',
  'customs_officer',
  'admin'
);

CREATE TYPE country_code AS ENUM ('TZ', 'ZM');

-- ── Table ─────────────────────────────────────────────────────
-- Extends Supabase Auth (auth.users) with app-level profile data.
-- The id column is a foreign key into auth.users so Supabase Auth
-- remains the source of truth for credentials.

CREATE TABLE public.users (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL UNIQUE,
  full_name   TEXT        NOT NULL,
  role        user_role   NOT NULL DEFAULT 'trader',
  country     country_code NOT NULL,
  phone       TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────

CREATE INDEX idx_users_role    ON public.users (role);
CREATE INDEX idx_users_country ON public.users (country);
CREATE INDEX idx_users_email   ON public.users (email);

-- ── Auto-update updated_at ────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Row Level Security (RLS) ──────────────────────────────────

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (except role / is_active — admin only)
CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role    = (SELECT role    FROM public.users WHERE id = auth.uid())
    AND is_active = (SELECT is_active FROM public.users WHERE id = auth.uid())
  );

-- Admins can read all users
CREATE POLICY "users_select_admin"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update any user (including role and is_active)
CREATE POLICY "users_update_admin"
  ON public.users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- New profile row is inserted by a Supabase Auth trigger (see below)
-- so no INSERT policy is needed for regular users.
CREATE POLICY "users_insert_service_role"
  ON public.users FOR INSERT
  WITH CHECK (TRUE); -- restricted at the function level via service role key

-- ── Auto-create profile on signup ────────────────────────────
-- Fires after a new row is inserted into auth.users by Supabase Auth.
-- Reads role + country from the raw_user_meta_data passed during registration.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role, country, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::user_role,
      'trader'
    ),
    COALESCE(
      (NEW.raw_user_meta_data->>'country')::country_code,
      'TZ'
    ),
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Seed: default admin ───────────────────────────────────────
-- Remove or replace before going to production.
-- INSERT INTO public.users (id, email, full_name, role, country)
-- VALUES (
--   gen_random_uuid(),
--   'admin@tradelens.co.tz',
--   'System Admin',
--   'admin',
--   'TZ'
-- );
