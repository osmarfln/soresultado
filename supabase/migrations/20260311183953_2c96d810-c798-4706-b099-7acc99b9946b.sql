
-- Create enum for capital draw times
CREATE TYPE public.capital_draw_time AS ENUM (
  'LCAP_09', 'LCAP_10', 'LCAP_11', 'LCAP_13', 'PTSP_13', 'CAP_14',
  'LCAP_15', 'BAND_15', 'LCAP_16', 'CAP_18', 'LCAP_20', 'PTNSP_20', 'LCAP_2230'
);

-- Create capital_results table
CREATE TABLE public.capital_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  draw_date DATE NOT NULL,
  draw_time public.capital_draw_time NOT NULL,
  prize_1_milhar TEXT NOT NULL,
  prize_1_group INTEGER NOT NULL,
  prize_1_bicho TEXT NOT NULL,
  prize_2_milhar TEXT NOT NULL,
  prize_2_group INTEGER NOT NULL,
  prize_2_bicho TEXT NOT NULL,
  prize_3_milhar TEXT NOT NULL,
  prize_3_group INTEGER NOT NULL,
  prize_3_bicho TEXT NOT NULL,
  prize_4_milhar TEXT NOT NULL,
  prize_4_group INTEGER NOT NULL,
  prize_4_bicho TEXT NOT NULL,
  prize_5_milhar TEXT NOT NULL,
  prize_5_group INTEGER NOT NULL,
  prize_5_bicho TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (draw_date, draw_time)
);

-- Enable RLS
ALTER TABLE public.capital_results ENABLE ROW LEVEL SECURITY;

-- Public read for confirmed results
CREATE POLICY "Anyone can read confirmed capital results"
  ON public.capital_results FOR SELECT TO public
  USING (status = 'confirmed');

-- Admin full access
CREATE POLICY "Admins can manage capital results"
  ON public.capital_results FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Update trigger
CREATE TRIGGER update_capital_results_updated_at
  BEFORE UPDATE ON public.capital_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
