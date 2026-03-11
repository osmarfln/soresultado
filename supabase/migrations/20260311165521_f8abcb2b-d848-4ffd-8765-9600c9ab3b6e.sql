
-- Enum for draw times
CREATE TYPE public.draw_time AS ENUM ('10h', '12h', '14h', '16h', '18h', '21h');

-- Enum for app roles
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'user');

-- User roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS for user_roles
CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Results table
CREATE TABLE public.draw_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draw_date DATE NOT NULL,
    draw_time draw_time NOT NULL,
    prize_1_milhar TEXT NOT NULL,
    prize_1_group INTEGER NOT NULL CHECK (prize_1_group BETWEEN 1 AND 25),
    prize_1_bicho TEXT NOT NULL,
    prize_2_milhar TEXT NOT NULL,
    prize_2_group INTEGER NOT NULL CHECK (prize_2_group BETWEEN 1 AND 25),
    prize_2_bicho TEXT NOT NULL,
    prize_3_milhar TEXT NOT NULL,
    prize_3_group INTEGER NOT NULL CHECK (prize_3_group BETWEEN 1 AND 25),
    prize_3_bicho TEXT NOT NULL,
    prize_4_milhar TEXT NOT NULL,
    prize_4_group INTEGER NOT NULL CHECK (prize_4_group BETWEEN 1 AND 25),
    prize_4_bicho TEXT NOT NULL,
    prize_5_milhar TEXT NOT NULL,
    prize_5_group INTEGER NOT NULL CHECK (prize_5_group BETWEEN 1 AND 25),
    prize_5_bicho TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'pending')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (draw_date, draw_time)
);
ALTER TABLE public.draw_results ENABLE ROW LEVEL SECURITY;

-- Public can read confirmed results
CREATE POLICY "Anyone can read confirmed results"
ON public.draw_results FOR SELECT
USING (status = 'confirmed');

-- Admins/managers can insert
CREATE POLICY "Admins can insert results"
ON public.draw_results FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
);

-- Admins can update
CREATE POLICY "Admins can update results"
ON public.draw_results FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- Admins can delete
CREATE POLICY "Admins can delete results"
ON public.draw_results FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_draw_results_updated_at
BEFORE UPDATE ON public.draw_results
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_draw_results_date ON public.draw_results(draw_date DESC);
CREATE INDEX idx_draw_results_date_time ON public.draw_results(draw_date, draw_time);
