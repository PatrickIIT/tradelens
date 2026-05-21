-- ============================================================
-- 005_verification_log.sql
-- TradeLens — Immutable Audit Trail Table (BR-06)
-- Tanzania–Zambia Corridor | IIT Madras Zanzibar Campus, 2026
-- ============================================================
-- Depends on: 001_users.sql (public.users)
--             004_certificates.sql (public.certificates)
-- ============================================================

-- ── Table ─────────────────────────────────────────────────────
-- Immutable append-only log for all critical actions.
-- Every certificate issuance, revocation, download, document upload,
-- review decision, and border verification is recorded here.
-- This fulfills BR-06 (Immutable audit trail).

CREATE TABLE public.verification_log (
  id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Context
  certificate_id    UUID           REFERENCES public.certificates(id) ON DELETE SET NULL,
  document_id       UUID           REFERENCES public.documents(id) ON DELETE SET NULL,

  -- Action details
  action            TEXT           NOT NULL,   -- e.g. 'certificate_issued', 'document_uploaded', 
                                               -- 'certificate_revoked', 'qr_verified', 
                                               -- 'document_reviewed', 'certificate_downloaded'

  performed_by      UUID           NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  role              user_role      NOT NULL,
  country           country_code   NOT NULL,

  -- Additional structured data
  metadata          JSONB          DEFAULT '{}',   -- flexible payload (e.g. {reason, certificate_number, ...})

  -- Timestamps (append-only — no updates allowed)
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────

-- Primary lookup: audit trail for a specific certificate
CREATE INDEX idx_verification_log_certificate 
  ON public.verification_log (certificate_id, created_at DESC);

-- Officer / Admin audit views
CREATE INDEX idx_verification_log_performed_by 
  ON public.verification_log (performed_by, created_at DESC);

-- Global audit log (Admin Panel)
CREATE INDEX idx_verification_log_action 
  ON public.verification_log (action, created_at DESC);

-- Border verification stats
CREATE INDEX idx_verification_log_country_action 
  ON public.verification_log (country, action, created_at DESC);

-- Time-range queries (stats dashboard)
CREATE INDEX idx_verification_log_created_at 
  ON public.verification_log (created_at DESC);

-- ── Constraints ───────────────────────────────────────────────

-- Action must be meaningful
ALTER TABLE public.verification_log
  ADD CONSTRAINT chk_action_not_empty 
  CHECK (trim(action) <> '');

-- If certificate_id is provided, it must exist (soft reference)
-- Handled via foreign key with ON DELETE SET NULL

-- ── Row Level Security (RLS) ──────────────────────────────────

ALTER TABLE public.verification_log ENABLE ROW LEVEL SECURITY;

-- Traders can see logs for their own certificates/documents (via join in views)
CREATE POLICY "verification_log_select_own_trader"
  ON public.verification_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.certificates c
      WHERE c.id = verification_log.certificate_id 
        AND c.trader_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = verification_log.document_id 
        AND d.trader_id = auth.uid()
    )
  );

-- Standards Officers and Customs Officers can see all logs
-- (needed for certificate audit trail and border compliance)
CREATE POLICY "verification_log_select_officers"
  ON public.verification_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('standards_officer', 'customs_officer', 'admin')
    )
  );

-- Admins have full read access
CREATE POLICY "verification_log_select_admin"
  ON public.verification_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only service role / backend can INSERT (enforced by using SUPABASE_SERVICE_KEY in routes)
-- No direct INSERT policy for users — all logging happens server-side.
CREATE POLICY "verification_log_insert_service"
  ON public.verification_log FOR INSERT
  WITH CHECK (TRUE);

-- No UPDATE or DELETE allowed — immutable audit trail (BR-06)
-- No policies defined for UPDATE/DELETE → blocked for all roles

-- ── Helpful View for Audit Trail UI ───────────────────────────

CREATE OR REPLACE VIEW public.audit_log_with_user AS
SELECT 
  vl.id,
  vl.certificate_id,
  vl.document_id,
  vl.action,
  vl.role,
  vl.country,
  vl.metadata,
  vl.created_at,
  u.id AS performed_by,
  u.full_name,
  u.email
FROM public.verification_log vl
LEFT JOIN public.users u ON u.id = vl.performed_by
ORDER BY vl.created_at DESC;

-- Grant read access to the view via RLS on underlying table

-- ── Example Seed / Test Data (remove in production) ───────────
/*
INSERT INTO public.verification_log 
  (certificate_id, action, performed_by, role, country, metadata)
VALUES 
  (
    'some-certificate-uuid',
    'certificate_issued',
    'some-user-uuid',
    'standards_officer',
    'TZ',
    '{"certificate_number": "TL-TZ-TBS-LK3M9A", "product_name": "Dried Cassava"}'::jsonb
  );
*/

-- ============================================================
-- Summary
-- ============================================================
-- This table is the single source of truth for compliance auditing.
-- All sensitive operations in certificates.js, documents.js, and verify.js 
-- must insert a row here using the service role key.
-- The audit trail is immutable and fully queryable by officers and admins.
