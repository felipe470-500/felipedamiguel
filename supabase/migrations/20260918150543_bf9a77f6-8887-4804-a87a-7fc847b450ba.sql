-- 1) Bump record_version stays BEFORE UPDATE (no sync_jobs write)
CREATE OR REPLACE FUNCTION public.bump_vehicle_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.record_version = NEW.record_version THEN
    NEW.record_version := OLD.record_version + 1;
  END IF;
  RETURN NEW;
END $$;

-- 2) Enqueue runs AFTER the vehicle row is persisted, so the FK is always valid.
CREATE OR REPLACE FUNCTION public.enqueue_vehicle_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_op text;
BEGIN
  v_op := CASE
    WHEN TG_OP = 'INSERT' THEN 'CREATE'
    WHEN NEW.status = 'SOLD' AND OLD.status IS DISTINCT FROM NEW.status THEN 'SOLD'
    ELSE 'UPDATE'
  END;

  BEGIN
    -- Reuse a still-unprocessed job for the same vehicle/integration instead of piling duplicates.
    UPDATE public.sync_jobs j
       SET operation = v_op,
           vehicle_version = NEW.record_version,
           idempotency_key = NEW.id::text || ':' || si.platform_id || ':' || NEW.record_version::text,
           status = 'PENDING',
           next_attempt_at = now(),
           updated_at = now()
      FROM public.store_integrations si
     WHERE j.store_integration_id = si.id
       AND j.vehicle_id = NEW.id
       AND j.store_id = NEW.store_id
       AND j.status IN ('PENDING', 'RETRY')
       AND j.locked_at IS NULL
       AND si.store_id = NEW.store_id
       AND si.status IN ('CONNECTED', 'DEGRADED');

    INSERT INTO public.sync_jobs (store_id, vehicle_id, store_integration_id, operation, vehicle_version, idempotency_key)
    SELECT NEW.store_id, NEW.id, si.id, v_op, NEW.record_version,
           NEW.id::text || ':' || si.platform_id || ':' || NEW.record_version::text
      FROM public.store_integrations si
     WHERE si.store_id = NEW.store_id
       AND si.status IN ('CONNECTED', 'DEGRADED')
       AND NOT EXISTS (
         SELECT 1 FROM public.sync_jobs j
          WHERE j.vehicle_id = NEW.id
            AND j.store_integration_id = si.id
            AND j.status IN ('PENDING', 'RETRY')
       )
    ON CONFLICT (idempotency_key) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Never let queue preparation roll back the vehicle write.
    RAISE WARNING 'enqueue_vehicle_sync failed for vehicle %: %', NEW.id, SQLERRM;
  END;

  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS vehicles_enqueue_sync ON public.vehicles;
DROP TRIGGER IF EXISTS vehicles_bump_version ON public.vehicles;

CREATE TRIGGER vehicles_bump_version
BEFORE UPDATE ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.bump_vehicle_version();

CREATE TRIGGER vehicles_enqueue_sync
AFTER INSERT OR UPDATE ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.enqueue_vehicle_sync();