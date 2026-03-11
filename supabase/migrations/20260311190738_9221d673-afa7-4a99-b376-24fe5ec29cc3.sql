
-- Fix federal_results RLS (same RESTRICTIVE issue)
DROP POLICY IF EXISTS "Admins can manage federal results" ON public.federal_results;
DROP POLICY IF EXISTS "Anyone can read confirmed federal results" ON public.federal_results;

CREATE POLICY "Admins can manage federal results"
ON public.federal_results
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can read confirmed federal results"
ON public.federal_results
FOR SELECT
TO public
USING (status = 'confirmed'::text);

-- Allow partial saves: make prize columns have defaults
ALTER TABLE public.federal_results ALTER COLUMN prize_1_milhar SET DEFAULT '0000';
ALTER TABLE public.federal_results ALTER COLUMN prize_1_group SET DEFAULT 0;
ALTER TABLE public.federal_results ALTER COLUMN prize_1_bicho SET DEFAULT '';
ALTER TABLE public.federal_results ALTER COLUMN prize_2_milhar SET DEFAULT '0000';
ALTER TABLE public.federal_results ALTER COLUMN prize_2_group SET DEFAULT 0;
ALTER TABLE public.federal_results ALTER COLUMN prize_2_bicho SET DEFAULT '';
ALTER TABLE public.federal_results ALTER COLUMN prize_3_milhar SET DEFAULT '0000';
ALTER TABLE public.federal_results ALTER COLUMN prize_3_group SET DEFAULT 0;
ALTER TABLE public.federal_results ALTER COLUMN prize_3_bicho SET DEFAULT '';
ALTER TABLE public.federal_results ALTER COLUMN prize_4_milhar SET DEFAULT '0000';
ALTER TABLE public.federal_results ALTER COLUMN prize_4_group SET DEFAULT 0;
ALTER TABLE public.federal_results ALTER COLUMN prize_4_bicho SET DEFAULT '';
ALTER TABLE public.federal_results ALTER COLUMN prize_5_milhar SET DEFAULT '0000';
ALTER TABLE public.federal_results ALTER COLUMN prize_5_group SET DEFAULT 0;
ALTER TABLE public.federal_results ALTER COLUMN prize_5_bicho SET DEFAULT '';
