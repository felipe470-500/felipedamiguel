CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'seller', 'integration_operator');
CREATE TYPE public.vehicle_status AS ENUM ('DRAFT', 'AVAILABLE', 'RESERVED', 'SOLD', 'ARCHIVED');
CREATE TYPE public.integration_status AS ENUM ('NOT_CONNECTED', 'CONNECTED', 'DEGRADED', 'BLOCKED');
CREATE TYPE public.sync_status AS ENUM ('PENDING', 'PROCESSING', 'RETRY', 'SUCCEEDED', 'FAILED', 'DEAD_LETTER', 'UNSUPPORTED');

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  address jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY,
  display_name text NOT NULL,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id, store_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_store_role(_user_id uuid, _store_id uuid, _roles public.app_role[] DEFAULT ARRAY['admin'::public.app_role, 'manager'::public.app_role, 'seller'::public.app_role, 'integration_operator'::public.app_role])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (store_id = _store_id OR (store_id IS NULL AND organization_id = (SELECT organization_id FROM public.stores WHERE id = _store_id)))
      AND role = ANY(_roles)
  )
$$;
GRANT EXECUTE ON FUNCTION public.has_store_role(uuid, uuid, public.app_role[]) TO authenticated, service_role;

CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Members read their organizations" ON public.organizations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.organization_id = id AND ur.user_id = auth.uid()));
CREATE POLICY "Members read their stores" ON public.stores FOR SELECT TO authenticated USING (public.has_store_role(auth.uid(), id));

INSERT INTO public.organizations (name, slug) VALUES ('Miguel Veículos', 'miguel-veiculos');
INSERT INTO public.stores (organization_id, name, code)
SELECT id, 'Miguel Veículos', 'MIGUEL' FROM public.organizations WHERE slug = 'miguel-veiculos';

ALTER TABLE public.vehicles
  ADD COLUMN store_id uuid REFERENCES public.stores(id),
  ADD COLUMN internal_code bigint,
  ADD COLUMN brand text,
  ADD COLUMN model text,
  ADD COLUMN version text,
  ADD COLUMN manufacture_year integer,
  ADD COLUMN model_year integer,
  ADD COLUMN price_cents bigint,
  ADD COLUMN mileage_km integer,
  ADD COLUMN color text,
  ADD COLUMN fuel text,
  ADD COLUMN transmission text,
  ADD COLUMN doors smallint,
  ADD COLUMN vin text,
  ADD COLUMN location jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN seller_id text,
  ADD COLUMN status public.vehicle_status NOT NULL DEFAULT 'AVAILABLE',
  ADD COLUMN record_version bigint NOT NULL DEFAULT 1;
UPDATE public.vehicles SET store_id = (SELECT id FROM public.stores WHERE code = 'MIGUEL' LIMIT 1) WHERE store_id IS NULL;
ALTER TABLE public.vehicles ALTER COLUMN store_id SET NOT NULL;
CREATE UNIQUE INDEX vehicles_store_internal_code_key ON public.vehicles(store_id, internal_code) WHERE internal_code IS NOT NULL;
CREATE INDEX vehicles_store_status_idx ON public.vehicles(store_id, status);
CREATE POLICY "Store members read vehicles" ON public.vehicles FOR SELECT TO authenticated USING (public.has_store_role(auth.uid(), store_id));

ALTER TABLE public.leads
  ADD COLUMN store_id uuid REFERENCES public.stores(id),
  ADD COLUMN vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  ADD COLUMN platform_id text,
  ADD COLUMN external_id text,
  ADD COLUMN source text NOT NULL DEFAULT 'website',
  ADD COLUMN assigned_user_id uuid,
  ADD COLUMN status text NOT NULL DEFAULT 'new',
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.leads SET store_id = (SELECT id FROM public.stores WHERE code = 'MIGUEL' LIMIT 1) WHERE store_id IS NULL;
ALTER TABLE public.leads ALTER COLUMN store_id SET NOT NULL;
CREATE UNIQUE INDEX leads_platform_external_key ON public.leads(platform_id, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX leads_store_created_idx ON public.leads(store_id, created_at DESC);
CREATE POLICY "Store members read leads" ON public.leads FOR SELECT TO authenticated USING (public.has_store_role(auth.uid(), store_id));
CREATE POLICY "Store members update leads" ON public.leads FOR UPDATE TO authenticated USING (public.has_store_role(auth.uid(), store_id)) WITH CHECK (public.has_store_role(auth.uid(), store_id));

CREATE TABLE public.vehicle_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  label text NOT NULL,
  value jsonb NOT NULL DEFAULT 'true'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(vehicle_id, feature_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_features TO authenticated;
GRANT ALL ON public.vehicle_features TO service_role;
ALTER TABLE public.vehicle_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store members manage vehicle features" ON public.vehicle_features FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND public.has_store_role(auth.uid(), v.store_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND public.has_store_role(auth.uid(), v.store_id)));

CREATE TABLE public.vehicle_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  media_type text NOT NULL CHECK (media_type IN ('PHOTO', 'VIDEO')),
  storage_path text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  checksum text,
  width integer,
  height integer,
  duration_ms integer,
  processing_status text NOT NULL DEFAULT 'READY',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_media TO authenticated;
GRANT ALL ON public.vehicle_media TO service_role;
ALTER TABLE public.vehicle_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store members manage vehicle media" ON public.vehicle_media FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND public.has_store_role(auth.uid(), v.store_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND public.has_store_role(auth.uid(), v.store_id)));

CREATE TABLE public.vehicle_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  from_status public.vehicle_status,
  to_status public.vehicle_status NOT NULL,
  changed_by uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.vehicle_status_history TO authenticated;
GRANT ALL ON public.vehicle_status_history TO service_role;
ALTER TABLE public.vehicle_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store members read vehicle history" ON public.vehicle_status_history FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND public.has_store_role(auth.uid(), v.store_id)));

CREATE TABLE public.platforms (
  id text PRIMARY KEY,
  name text NOT NULL,
  connector_version text NOT NULL DEFAULT '1.0.0',
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platforms TO authenticated;
GRANT ALL ON public.platforms TO service_role;
ALTER TABLE public.platforms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users read platforms" ON public.platforms FOR SELECT TO authenticated USING (true);
INSERT INTO public.platforms (id, name, capabilities) VALUES
('mercado_livre', 'Mercado Livre', '{"oauth":true,"create":true,"read":true,"update":true,"photos":true,"leads":true,"webhooks":true}'::jsonb),
('na_pista', 'Na Pista', '{}'::jsonb), ('apisa', 'Apisa', '{}'::jsonb), ('pialto', 'Pialto', '{}'::jsonb),
('mobiauto', 'MobiAuto', '{}'::jsonb), ('olx', 'OLX', '{"oauth":true,"create":true,"update":true,"photos":true,"delete":true,"webhooks":true}'::jsonb),
('icarros', 'iCarros', '{"oauth":true}'::jsonb), ('webmotors', 'Webmotors', '{"oauth":true,"create":true,"update":true,"leads":true}'::jsonb),
('autoline', 'Autoline', '{}'::jsonb);

CREATE TABLE public.store_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  platform_id text NOT NULL REFERENCES public.platforms(id),
  status public.integration_status NOT NULL DEFAULT 'NOT_CONNECTED',
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  external_store_id text,
  last_health_check_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id, platform_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_integrations TO authenticated;
GRANT ALL ON public.store_integrations TO service_role;
ALTER TABLE public.store_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store operators manage integrations" ON public.store_integrations FOR ALL TO authenticated USING (public.has_store_role(auth.uid(), store_id, ARRAY['admin'::public.app_role,'manager'::public.app_role,'integration_operator'::public.app_role])) WITH CHECK (public.has_store_role(auth.uid(), store_id, ARRAY['admin'::public.app_role,'manager'::public.app_role,'integration_operator'::public.app_role]));

CREATE TABLE public.integration_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_integration_id uuid NOT NULL REFERENCES public.store_integrations(id) ON DELETE CASCADE,
  encrypted_payload text NOT NULL,
  key_version integer NOT NULL DEFAULT 1,
  masked_identifier text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_integration_id)
);
GRANT ALL ON public.integration_credentials TO service_role;
ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.vehicle_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  store_integration_id uuid NOT NULL REFERENCES public.store_integrations(id) ON DELETE CASCADE,
  external_id text,
  external_status text,
  sync_status public.sync_status NOT NULL DEFAULT 'PENDING',
  last_synced_at timestamptz,
  last_http_status integer,
  last_error_code text,
  last_error_message text,
  last_payload_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(vehicle_id, store_integration_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_integrations TO authenticated;
GRANT ALL ON public.vehicle_integrations TO service_role;
ALTER TABLE public.vehicle_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store members read vehicle integrations" ON public.vehicle_integrations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND public.has_store_role(auth.uid(), v.store_id)));

CREATE TABLE public.media_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_media_id uuid NOT NULL REFERENCES public.vehicle_media(id) ON DELETE CASCADE,
  store_integration_id uuid NOT NULL REFERENCES public.store_integrations(id) ON DELETE CASCADE,
  external_id text,
  external_url text,
  sync_status public.sync_status NOT NULL DEFAULT 'PENDING',
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(vehicle_media_id, store_integration_id)
);
GRANT SELECT ON public.media_integrations TO authenticated;
GRANT ALL ON public.media_integrations TO service_role;
ALTER TABLE public.media_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store members read media integrations" ON public.media_integrations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.vehicle_media vm JOIN public.vehicles v ON v.id = vm.vehicle_id WHERE vm.id = vehicle_media_id AND public.has_store_role(auth.uid(), v.store_id)));

CREATE TABLE public.sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE,
  store_integration_id uuid NOT NULL REFERENCES public.store_integrations(id) ON DELETE CASCADE,
  operation text NOT NULL,
  vehicle_version bigint,
  status public.sync_status NOT NULL DEFAULT 'PENDING',
  priority integer NOT NULL DEFAULT 100,
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 8,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  idempotency_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error_code text,
  last_error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.sync_jobs TO authenticated;
GRANT ALL ON public.sync_jobs TO service_role;
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store operators read sync jobs" ON public.sync_jobs FOR SELECT TO authenticated USING (public.has_store_role(auth.uid(), store_id, ARRAY['admin'::public.app_role,'manager'::public.app_role,'integration_operator'::public.app_role]));
CREATE INDEX sync_jobs_ready_idx ON public.sync_jobs(status, next_attempt_at, priority);

CREATE TABLE public.sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  store_integration_id uuid REFERENCES public.store_integrations(id) ON DELETE SET NULL,
  sync_job_id uuid REFERENCES public.sync_jobs(id) ON DELETE SET NULL,
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  operation text NOT NULL,
  attempt integer NOT NULL DEFAULT 1,
  duration_ms integer,
  http_status integer,
  outcome text NOT NULL,
  error_category text,
  error_code text,
  message text,
  response_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sync_logs TO authenticated;
GRANT ALL ON public.sync_logs TO service_role;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store operators read sync logs" ON public.sync_logs FOR SELECT TO authenticated USING (public.has_store_role(auth.uid(), store_id, ARRAY['admin'::public.app_role,'manager'::public.app_role,'integration_operator'::public.app_role]));
CREATE INDEX sync_logs_store_created_idx ON public.sync_logs(store_id, created_at DESC);

CREATE TABLE public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id text NOT NULL REFERENCES public.platforms(id),
  store_integration_id uuid REFERENCES public.store_integrations(id) ON DELETE SET NULL,
  external_event_id text,
  signature_valid boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'RECEIVED',
  processed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.webhook_events TO authenticated;
GRANT ALL ON public.webhook_events TO service_role;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX webhook_platform_event_key ON public.webhook_events(platform_id, external_event_id) WHERE external_event_id IS NOT NULL;
CREATE POLICY "Store operators read webhook events" ON public.webhook_events FOR SELECT TO authenticated USING (store_integration_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.store_integrations si WHERE si.id = store_integration_id AND public.has_store_role(auth.uid(), si.store_id, ARRAY['admin'::public.app_role,'manager'::public.app_role,'integration_operator'::public.app_role])));

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  actor_user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Organization admins read audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.organization_id = audit_logs.organization_id AND ur.role IN ('admin','manager')));

CREATE OR REPLACE FUNCTION public.enqueue_vehicle_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.record_version = NEW.record_version THEN
    NEW.record_version := OLD.record_version + 1;
  END IF;
  INSERT INTO public.sync_jobs (store_id, vehicle_id, store_integration_id, operation, vehicle_version, idempotency_key)
  SELECT NEW.store_id, NEW.id, si.id,
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATE' WHEN NEW.status = 'SOLD' AND OLD.status IS DISTINCT FROM NEW.status THEN 'SOLD' ELSE 'UPDATE' END,
    NEW.record_version,
    NEW.id::text || ':' || si.platform_id || ':' || NEW.record_version::text
  FROM public.store_integrations si
  WHERE si.store_id = NEW.store_id AND si.status IN ('CONNECTED','DEGRADED')
  ON CONFLICT (idempotency_key) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER vehicles_enqueue_sync BEFORE INSERT OR UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.enqueue_vehicle_sync();

CREATE TRIGGER organizations_touch BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER stores_touch BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER vehicle_media_touch BEFORE UPDATE ON public.vehicle_media FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER platforms_touch BEFORE UPDATE ON public.platforms FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER store_integrations_touch BEFORE UPDATE ON public.store_integrations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER integration_credentials_touch BEFORE UPDATE ON public.integration_credentials FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER vehicle_integrations_touch BEFORE UPDATE ON public.vehicle_integrations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER media_integrations_touch BEFORE UPDATE ON public.media_integrations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER sync_jobs_touch BEFORE UPDATE ON public.sync_jobs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER leads_touch BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();