
-- Drop the broken restrictive policies on draw_results
DROP POLICY IF EXISTS "Anyone can read confirmed results" ON public.draw_results;
DROP POLICY IF EXISTS "Admins can insert results" ON public.draw_results;
DROP POLICY IF EXISTS "Admins can update results" ON public.draw_results;
DROP POLICY IF EXISTS "Admins can delete results" ON public.draw_results;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Anyone can read confirmed results"
ON public.draw_results FOR SELECT
TO public
USING (status = 'confirmed');

CREATE POLICY "Admins can read all results"
ON public.draw_results FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert results"
ON public.draw_results FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins can update results"
ON public.draw_results FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins can delete results"
ON public.draw_results FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
