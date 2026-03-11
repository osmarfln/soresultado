
-- Drop restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Admins can manage capital results" ON public.capital_results;
DROP POLICY IF EXISTS "Anyone can read confirmed capital results" ON public.capital_results;

-- Permissive: admins can do everything
CREATE POLICY "Admins can manage capital results"
ON public.capital_results
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Permissive: anyone can read confirmed
CREATE POLICY "Anyone can read confirmed capital results"
ON public.capital_results
FOR SELECT
TO public
USING (status = 'confirmed'::text);
