CREATE TABLE public.scrape_robot_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lottery text NOT NULL,
  source_url text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'error', 'blocked', 'no_results')),
  http_status integer,
  duration_ms integer NOT NULL DEFAULT 0,
  results_found integer NOT NULL DEFAULT 0,
  inserted_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  error_message text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.scrape_robot_logs TO authenticated;
GRANT ALL ON public.scrape_robot_logs TO service_role;

ALTER TABLE public.scrape_robot_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read robot logs"
ON public.scrape_robot_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX scrape_robot_logs_lottery_created_at_idx
ON public.scrape_robot_logs (lottery, created_at DESC);