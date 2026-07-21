UPDATE public.vehicles
SET images = ARRAY(
  SELECT
    CASE
      WHEN img LIKE '%/storage/v1/object/public/vehicle-images/%'
        THEN '/api/public/vehicle-image?path=' ||
             regexp_replace(img, '^.*/storage/v1/object/public/vehicle-images/', '')
      ELSE img
    END
  FROM unnest(images) AS img
);