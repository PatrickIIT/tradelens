-- ============================================================
-- 003_documents.sql
-- TradeLens — Documents table
-- Tanzania–Zambia Corridor | IIT Madras Zanzibar Campus, 2026
-- ============================================================
-- Depends on: 001_users.sql (public.users, country_code enum)
--             002_products.sql (public.products)
-- Referenced by: 004_certificates.sql
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────

CREATE TYPE document_type AS ENUM (
  'phytosanitary_certificate',
  'certificate_of_origin',
  'packing_list',
  'commercial_invoice',
  'import_permit',
  'quality_inspection_report'
);

CREATE TYPE document_status AS ENUM (
  'pending',
  'approved',
  'rejected'
);

-- ── Table ─────────────────────────────────────────────────────
-- One row per compliance document uploaded by a trader.
-- BR-02: upload once, reuse across both countries — enforced via
-- the unique partial index on (trader_id, product_id,
-- document_type, destination_country) for pending/approved docs.

CREATE TABLE public.documents (
  id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  trader_id           UUID            NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_id          UUID            NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,

  -- Document identity
  document_type       document_type   NOT NULL,
  destination_country country_code    NOT NULL,
  description         TEXT,                           -- optional trader notes (max 500 chars — enforced in API)

  -- Supabase Storage
  file_url            TEXT            NOT NULL,        -- public / signed URL
  storage_path        TEXT            NOT NULL UNIQUE, -- internal path: documents/<trader_id>/<uuid>.<ext>

  -- Review lifecycle
  status              document_status NOT NULL DEFAULT 'pending',
  reviewer_notes      TEXT,                           -- required on rejection (min 10 chars — enforced in API)
  reviewed_by         UUID            REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at         TIMESTAMPTZ,

  -- Timestamps
  uploaded_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ── Duplicate prevention (BR-02) ─────────────────────────────
-- Blocks re-uploading the same document type for the same product
-- + destination while one is already pending or approved.
-- A rejected doc can be re-uploaded (status = 'rejected' is excluded).

CREATE UNIQUE INDEX idx_documents_no_duplicate_active
  ON public.documents (trader_id, product_id, document_type, destination_country)
  WHERE status IN ('pending', 'approved');

-- ── General indexes ───────────────────────────────────────────

-- Trader's own document list — GET /api/documents (trader view)
CREATE INDEX idx_documents_trader_id       ON public.documents (trader_id);

-- Officer review queue — GET /api/documents?status=pending
CREATE INDEX idx_documents_status          ON public.documents (status);

-- Compliance checklist — GET /api/documents/checklist?product_id=&destination_country=
CREATE INDEX idx_documents_product_dest    ON public.documents (product_id, destination_country);

-- Reviewer audit — who reviewed what
CREATE INDEX idx_documents_reviewed_by     ON public.documents (reviewed_by);

-- Combined filter used by officer list view
CREATE INDEX idx_documents_type_status     ON public.documents (document_type, status);

-- ── Auto-update updated_at ────────────────────────────────────

CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Constraint: reviewed_at set when reviewed_by is set ───────

ALTER TABLE public.documents
  ADD CONSTRAINT chk_review_consistency
  CHECK (
    (reviewed_by IS NULL AND reviewed_at IS NULL)
    OR
    (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  );

-- ── Constraint: trader_id must match product owner ────────────
-- Belt-and-suspenders guard; primary enforcement is in the API layer.

ALTER TABLE public.documents
  ADD CONSTRAINT chk_trader_owns_product
  CHECK (
    trader_id = (
      SELECT trader_id FROM public.products WHERE id = product_id
    )
  );

-- ── Row Level Security (RLS) ──────────────────────────────────

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Traders can read their own documents
CREATE POLICY "documents_select_own_trader"
  ON public.documents FOR SELECT
  USING (trader_id = auth.uid());

-- Standards Officers can read all documents destined for their country
-- (they may only review documents for their own country — enforced in API)
CREATE POLICY "documents_select_standards_officer"
  ON public.documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role = 'standards_officer'
    )
  );

-- Customs Officers can read approved documents (needed for verification)
CREATE POLICY "documents_select_customs_officer"
  ON public.documents FOR SELECT
  USING (
    status = 'approved'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role = 'customs_officer'
    )
  );

-- Admins can read all documents
CREATE POLICY "documents_select_admin"
  ON public.documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only traders can insert (upload) their own documents
CREATE POLICY "documents_insert_own_trader"
  ON public.documents FOR INSERT
  WITH CHECK (
    trader_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'trader'
    )
  );

-- Traders can delete their own PENDING documents only
-- (approved / rejected deletion blocked at API layer too)
CREATE POLICY "documents_delete_own_pending_trader"
  ON public.documents FOR DELETE
  USING (
    trader_id = auth.uid()
    AND status = 'pending'
  );

-- Standards Officers can update status, reviewer_notes, reviewed_by, reviewed_at
-- (PATCH /api/documents/:id/review — US-04)
CREATE POLICY "documents_update_standards_officer"
  ON public.documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role = 'standards_officer'
    )
  );

-- Admins can update anything
CREATE POLICY "documents_update_admin"
  ON public.documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
