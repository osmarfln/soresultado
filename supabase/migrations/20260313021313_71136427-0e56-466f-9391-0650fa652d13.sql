
CREATE TABLE public.page_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visited_at timestamp with time zone NOT NULL DEFAULT now(),
  visit_date date NOT NULL DEFAULT CURRENT_DATE,
  visit_hour integer NOT NULL DEFAULT EXTRACT(HOUR FROM now()),
  page text NOT NULL DEFAULT '/'
);

ALTER TABLE public.page_visits ENABLE ROW LEVEL SECURITY;

-- Anyone can insert visits (anonymous tracking)
CREATE POLICY "Anyone can insert visits" ON public.page_visits FOR INSERT TO public WITH CHECK (true);

-- Only admins can read visits
CREATE POLICY "Admins can read visits" ON public.page_visits FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
