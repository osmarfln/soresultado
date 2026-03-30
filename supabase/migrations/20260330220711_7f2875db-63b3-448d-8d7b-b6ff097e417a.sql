
CREATE TYPE public.sp_draw_time AS ENUM (
  'PTSP_0820',
  'PTSP_1000',
  'PTSP_1300',
  'BAND_1530',
  'PTSP_1900',
  'PTNSP_2000'
);

CREATE TABLE public.sp_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_date date NOT NULL,
  draw_time sp_draw_time NOT NULL,
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
  UNIQUE(draw_date, draw_time)
);

ALTER TABLE public.sp_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read confirmed sp results"
  ON public.sp_results FOR SELECT TO public
  USING (status = 'confirmed');

CREATE POLICY "Admins can manage sp results"
  ON public.sp_results FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TRIGGER sp_results_updated_at
  BEFORE UPDATE ON public.sp_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
