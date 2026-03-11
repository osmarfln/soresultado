
-- Drop all restrictive policies on draw_results
DROP POLICY IF EXISTS "Admins can delete results" ON public.draw_results;
DROP POLICY IF EXISTS "Admins can insert results" ON public.draw_results;
DROP POLICY IF EXISTS "Admins can read all results" ON public.draw_results;
DROP POLICY IF EXISTS "Admins can update results" ON public.draw_results;
DROP POLICY IF EXISTS "Anyone can read confirmed results" ON public.draw_results;

-- Recreate as permissive
CREATE POLICY "Admins can manage results"
ON public.draw_results
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can insert and update results"
ON public.draw_results
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Anyone can read confirmed results"
ON public.draw_results
FOR SELECT
TO public
USING (status = 'confirmed'::text);
