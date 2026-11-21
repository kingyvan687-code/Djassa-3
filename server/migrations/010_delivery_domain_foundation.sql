-- DJASSA Lot 3L: delivery-domain foundation.
-- Additive schema only; no live API/JSON cutover and no GPS collection enabled.
CREATE TABLE IF NOT EXISTS djassa_delivery_companies (
 user_id UUID PRIMARY KEY REFERENCES djassa_users(id) ON DELETE CASCADE,
 legal_name TEXT, registration_number TEXT, tax_number TEXT,
 verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','rejected','suspended')),
 service_zones JSONB NOT NULL DEFAULT '[]'::jsonb, contact_phone TEXT,
 support_contact JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS djassa_driver_profiles (
 user_id UUID PRIMARY KEY REFERENCES djassa_users(id) ON DELETE CASCADE,
 company_user_id UUID REFERENCES djassa_delivery_companies(user_id) ON DELETE SET NULL,
 driver_type TEXT NOT NULL DEFAULT 'independent' CHECK (driver_type IN ('independent','employee','contractor')),
 verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','rejected','suspended')),
 availability_status TEXT NOT NULL DEFAULT 'offline' CHECK (availability_status IN ('offline','available','busy','suspended')),
 vehicle_type TEXT CHECK (vehicle_type IN ('motorcycle','car','van','truck','other')),
 vehicle_registration TEXT, identity_verified_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_djassa_driver_company_availability ON djassa_driver_profiles(company_user_id, availability_status);
CREATE TABLE IF NOT EXISTS djassa_delivery_service_offers (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 company_user_id UUID NOT NULL REFERENCES djassa_delivery_companies(user_id) ON DELETE CASCADE,
 service_code TEXT NOT NULL CHECK (service_code IN ('normal','express')),
 display_name TEXT NOT NULL, price_fcfa BIGINT NOT NULL CHECK (price_fcfa >= 0),
 estimated_minutes INTEGER CHECK (estimated_minutes IS NULL OR estimated_minutes > 0),
 parcel_class TEXT NOT NULL DEFAULT 'standard' CHECK (parcel_class IN ('small','standard','large','bulky')),
 active BOOLEAN NOT NULL DEFAULT true, valid_from TIMESTAMPTZ NOT NULL DEFAULT now(), valid_until TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK (valid_until IS NULL OR valid_until > valid_from), UNIQUE(company_user_id, service_code, parcel_class, valid_from)
);
CREATE INDEX IF NOT EXISTS idx_djassa_delivery_offers_active ON djassa_delivery_service_offers(company_user_id, active, service_code);
ALTER TABLE djassa_delivery_assignments
 ADD COLUMN IF NOT EXISTS service_offer_id UUID REFERENCES djassa_delivery_service_offers(id),
 ADD COLUMN IF NOT EXISTS parcel_class TEXT NOT NULL DEFAULT 'standard',
 ADD COLUMN IF NOT EXISTS failure_reason TEXT,
 ADD COLUMN IF NOT EXISTS reassignment_count INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'djassa_delivery_assignment_parcel_class'
  ) THEN
    ALTER TABLE djassa_delivery_assignments
      ADD CONSTRAINT djassa_delivery_assignment_parcel_class CHECK (parcel_class IN ('small','standard','large','bulky')) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'djassa_delivery_assignment_reassignment_count'
  ) THEN
    ALTER TABLE djassa_delivery_assignments
      ADD CONSTRAINT djassa_delivery_assignment_reassignment_count CHECK (reassignment_count >= 0) NOT VALID;
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS djassa_delivery_status_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), assignment_id UUID NOT NULL REFERENCES djassa_delivery_assignments(id) ON DELETE CASCADE,
 previous_status TEXT, next_status TEXT NOT NULL, actor_user_id UUID REFERENCES djassa_users(id) ON DELETE SET NULL,
 event_source TEXT NOT NULL DEFAULT 'api' CHECK (event_source IN ('api','driver_app','company_app','admin','system')),
 reason TEXT, location JSONB, metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 idempotency_key TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_djassa_delivery_events_assignment ON djassa_delivery_status_events(assignment_id, created_at DESC);
CREATE TABLE IF NOT EXISTS djassa_delivery_location_pings (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 assignment_id UUID NOT NULL REFERENCES djassa_delivery_assignments(id) ON DELETE CASCADE,
 driver_user_id UUID NOT NULL REFERENCES djassa_users(id) ON DELETE CASCADE,
 latitude NUMERIC(9,6) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
 longitude NUMERIC(9,6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
 accuracy_m NUMERIC(8,2) CHECK (accuracy_m IS NULL OR accuracy_m >= 0),
 recorded_at TIMESTAMPTZ NOT NULL, received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 source TEXT NOT NULL DEFAULT 'device' CHECK (source IN ('device','system')),
 UNIQUE(assignment_id, driver_user_id, recorded_at)
);
CREATE INDEX IF NOT EXISTS idx_djassa_delivery_location_latest ON djassa_delivery_location_pings(assignment_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_djassa_delivery_location_retention ON djassa_delivery_location_pings(received_at);
CREATE TABLE IF NOT EXISTS djassa_delivery_proofs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), assignment_id UUID NOT NULL REFERENCES djassa_delivery_assignments(id) ON DELETE CASCADE,
 proof_type TEXT NOT NULL CHECK (proof_type IN ('pickup_photo','delivery_photo','recipient_code','recipient_signature','handover_photo','other')),
 media_reference TEXT, verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','rejected')),
 captured_by UUID REFERENCES djassa_users(id) ON DELETE SET NULL, captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_djassa_delivery_proofs_assignment ON djassa_delivery_proofs(assignment_id, captured_at DESC);
CREATE TABLE IF NOT EXISTS djassa_delivery_reassignments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), assignment_id UUID NOT NULL REFERENCES djassa_delivery_assignments(id) ON DELETE CASCADE,
 previous_driver_user_id UUID REFERENCES djassa_users(id) ON DELETE SET NULL,
 new_driver_user_id UUID REFERENCES djassa_users(id) ON DELETE SET NULL,
 reason TEXT NOT NULL CHECK (reason IN ('breakdown','driver_unavailable','safety','company_request','admin_correction')),
 details TEXT, handover_status TEXT NOT NULL DEFAULT 'pending' CHECK (handover_status IN ('pending','confirmed','not_required')),
 requested_by UUID REFERENCES djassa_users(id) ON DELETE SET NULL, confirmed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_djassa_delivery_reassignments_assignment ON djassa_delivery_reassignments(assignment_id, created_at DESC);
CREATE TABLE IF NOT EXISTS djassa_delivery_location_retention (
 id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1), retention_days INTEGER NOT NULL DEFAULT 30 CHECK (retention_days BETWEEN 1 AND 365),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO djassa_delivery_location_retention(id, retention_days) VALUES (1,30) ON CONFLICT (id) DO NOTHING;
