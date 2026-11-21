-- DJASSA Lot 3D: lossless staging area for legacy JSON imports.
-- This is deliberately separate from live domain tables. No application cutover occurs here.
CREATE TABLE IF NOT EXISTS djassa_legacy_import_records (
  id BIGSERIAL PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES djassa_legacy_import_batches(id) ON DELETE CASCADE,
  collection_path TEXT NOT NULL,
  record_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  payload_sha256 TEXT NOT NULL,
  validation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (validation_status IN ('pending','valid','rejected')),
  validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(batch_id, collection_path, record_key)
);
CREATE INDEX IF NOT EXISTS idx_djassa_legacy_records_batch
  ON djassa_legacy_import_records(batch_id, collection_path, validation_status);
