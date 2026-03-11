
-- Create federal_results table for manual federal lottery results
CREATE TABLE public.federal_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_date date NOT NULL,
  draw_number text,
  prize_1_milhar text NOT NULL,
  prize_1_group integer NOT NULL,
  prize_1_bicho text NOT NULL,
  prize_2_milhar text NOT NULL,
  prize_2_group integer NOT NULL,
  prize_2_bicho text NOT NULL,
  prize_3_milhar text NOT NULL,
  prize_3_group integer NOT NULL,
  prize_3_bicho text NOT NULL,
  prize_4_milhar text NOT NULL,
  prize_4_group integer NOT NULL,
  prize_4_bicho text NOT NULL,
  prize_5_milhar text NOT NULL,
  prize_5_group integer NOT NULL,
  prize_5_bicho text NOT NULL,
  status text NOT NULL DEFAULT 'confirmed',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(draw_date)
);

ALTER TABLE public.federal_results ENABLE ROW LEVEL SECURITY;

-- Admins can manage
CREATE POLICY "Admins can manage federal results"
ON public.federal_results
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Anyone can read confirmed
CREATE POLICY "Anyone can read confirmed federal results"
ON public.federal_results
FOR SELECT
TO public
USING (status = 'confirmed'::text);
