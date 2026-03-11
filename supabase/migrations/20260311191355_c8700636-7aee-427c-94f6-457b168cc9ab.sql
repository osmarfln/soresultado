
-- Add unique constraint on draw_results for upsert support
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'draw_results_draw_date_draw_time_key'
  ) THEN
    ALTER TABLE public.draw_results ADD CONSTRAINT draw_results_draw_date_draw_time_key UNIQUE (draw_date, draw_time);
  END IF;
END $$;

-- Add unique constraint on capital_results for upsert support
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'capital_results_draw_date_draw_time_key'
  ) THEN
    ALTER TABLE public.capital_results ADD CONSTRAINT capital_results_draw_date_draw_time_key UNIQUE (draw_date, draw_time);
  END IF;
END $$;

-- Setup pg_cron for automatic scraping
-- PT-Rio: every 30 min from 9h to 22h (Brasilia time)
SELECT cron.schedule(
  'scrape-ptrio-auto',
  '*/30 9-22 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/scrape-results',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Capital: every 30 min from 9h to 23h (Brasilia time)
SELECT cron.schedule(
  'scrape-capital-auto',
  '*/30 9-23 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/scrape-capital',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY')
    ),
    body := '{}'::jsonb
  );
  $$
);
