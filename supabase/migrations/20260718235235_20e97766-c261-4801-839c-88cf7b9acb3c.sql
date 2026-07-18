CREATE TABLE public.federal_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  draw_hour smallint NOT NULL CHECK (draw_hour BETWEEN 0 AND 23),
  draw_minute smallint NOT NULL CHECK (draw_minute BETWEEN 0 AND 59),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (weekday)
);

GRANT SELECT ON public.federal_schedule TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.federal_schedule TO authenticated;
GRANT ALL ON public.federal_schedule TO service_role;

ALTER TABLE public.federal_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "federal_schedule_public_read"
  ON public.federal_schedule FOR SELECT
  USING (true);

CREATE POLICY "federal_schedule_admin_insert"
  ON public.federal_schedule FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "federal_schedule_admin_update"
  ON public.federal_schedule FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "federal_schedule_admin_delete"
  ON public.federal_schedule FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER federal_schedule_set_updated_at
  BEFORE UPDATE ON public.federal_schedule
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.federal_schedule (weekday, draw_hour, draw_minute, enabled) VALUES
  (3, 20, 30, true),
  (0, 11, 34, true);