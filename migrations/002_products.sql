-- ============================================================
-- 002_products.sql
-- TradeLens — Products table
-- Tanzania–Zambia Corridor | IIT Madras Zanzibar Campus, 2026
-- ============================================================
-- Depends on: 001_users.sql (public.users, country_code enum)
-- Referenced by: 003_documents.sql, 004_certificates.sql
-- ============================================================

-- ── Table ─────────────────────────────────────────────────────
-- A product belongs to a trader and represents a tradeable
-- agricultural / food item in the Tanzania-Zambia corridor.
-- Documents and certificates are issued per product, per
-- destination country (BR-02: upload once, reuse across both).

CREATE TABLE public.products (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_id       UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Core product details
  name            TEXT          NOT NULL,                    -- e.g. "Dried Cassava"
  description     TEXT,                                      -- optional long-form notes
  hs_code         TEXT,                                      -- Harmonised System code for customs
  origin_country  country_code  NOT NULL,                    -- country where product is produced

  -- Destination(s) — MVP covers TZ↔ZM so we store the intended destination
  destination_country country_code NOT NULL,                 -- TZ or ZM

  -- Soft-delete / lifecycle
  is_active       BOOLEAN       NOT NULL DEFAULT TRUE,

  -- Timestamps
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────

-- Most common query: all products for a given trader
CREATE INDEX idx_products_trader_id      ON public.products (trader_id);

-- Filter by origin / destination (compliance checklist, BR-02)
CREATE INDEX idx_products_origin         ON public.products (origin_country);
CREATE INDEX idx_products_destination    ON public.products (destination_country);

-- Composite: trader + destination — used by the compliance checklist endpoint
-- GET /api/documents/checklist?product_id=&destination_country=
CREATE INDEX idx_products_trader_dest    ON public.products (trader_id, destination_country);

-- ── Auto-update updated_at ────────────────────────────────────
-- Reuses the function created in 001_users.sql

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Row Level Security (RLS) ──────────────────────────────────

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Traders can read their own products
CREATE POLICY "products_select_own_trader"
  ON public.products FOR SELECT
  USING (
    trader_id = auth.uid()
  );

-- Standards Officers and Customs Officers can read all active products
-- (needed when reviewing documents or verifying certificates at border)
CREATE POLICY "products_select_officers"
  ON public.products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('standards_officer', 'customs_officer', 'admin')
    )
  );

-- Only the owning trader can insert their own products
CREATE POLICY "products_insert_own_trader"
  ON public.products FOR INSERT
  WITH CHECK (
    trader_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'trader'
    )
  );

-- Traders can update their own products (name, description, hs_code)
-- They cannot change trader_id, origin_country, or destination_country
-- after documents have been attached — enforce that in application logic.
CREATE POLICY "products_update_own_trader"
  ON public.products FOR UPDATE
  USING (trader_id = auth.uid())
  WITH CHECK (trader_id = auth.uid());

-- Admins get full access
CREATE POLICY "products_all_admin"
  ON public.products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Soft-delete only: traders set is_active = false (handled by update policy above)
-- Hard DELETE is not permitted via RLS — no DELETE policy is defined.

-- ── Seed data (dev / demo only) ───────────────────────────────
-- Remove before production. Requires a real trader UUID from auth.users.

-- INSERT INTO public.products
--   (id, trader_id, name, description, hs_code, origin_country, destination_country)
-- VALUES
--   (
--     gen_random_uuid(),
--     '<trader-uuid-here>',
--     'Dried Cassava',
--     'Sun-dried cassava chips for export',
--     '0714.10',
--     'TZ',
--     'ZM'
--   ),
--   (
--     gen_random_uuid(),
--     '<trader-uuid-here>',
--     'Groundnuts (Shelled)',
--     'Grade-A shelled groundnuts',
--     '1202.42',
--     'ZM',
--     'TZ'
--   );
