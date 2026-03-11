
-- Fix sponsors table restrictive policies too
DROP POLICY IF EXISTS "Admins can manage sponsors" ON public.sponsors;
DROP POLICY IF EXISTS "Anyone can read active sponsors" ON public.sponsors;

CREATE POLICY "Anyone can read active sponsors"
ON public.sponsors FOR SELECT
TO public
USING (is_active = true);

CREATE POLICY "Admins can manage sponsors"
ON public.sponsors FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
