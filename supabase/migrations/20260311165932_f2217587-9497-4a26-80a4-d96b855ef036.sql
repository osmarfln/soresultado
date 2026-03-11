
-- Drop all existing restrictive policies
DROP POLICY IF EXISTS "Anyone can read confirmed results" ON public.draw_results;
DROP POLICY IF EXISTS "Admins can insert results" ON public.draw_results;
DROP POLICY IF EXISTS "Admins can update results" ON public.draw_results;
DROP POLICY IF EXISTS "Admins can delete results" ON public.draw_results;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

-- Recreate as PERMISSIVE (default)
CREATE POLICY "Anyone can read confirmed results"
ON public.draw_results FOR SELECT
TO public
USING (status = 'confirmed');

CREATE POLICY "Admins can insert results"
ON public.draw_results FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "Admins can update results"
ON public.draw_results FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins can delete results"
ON public.draw_results FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create sponsors table for admin to manage ads
CREATE TABLE public.sponsors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    link_url TEXT,
    position TEXT NOT NULL DEFAULT 'sidebar' CHECK (position IN ('header', 'sidebar', 'between_results', 'footer')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active sponsors"
ON public.sponsors FOR SELECT
TO public
USING (is_active = true);

CREATE POLICY "Admins can manage sponsors"
ON public.sponsors FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_sponsors_updated_at
BEFORE UPDATE ON public.sponsors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
