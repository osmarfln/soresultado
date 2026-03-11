
CREATE TABLE public.ticker_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL DEFAULT '',
  bg_color text NOT NULL DEFAULT '#22c55e',
  text_color text NOT NULL DEFAULT '#ffffff',
  font_size text NOT NULL DEFAULT '18px',
  font_family text NOT NULL DEFAULT 'Space Grotesk',
  speed integer NOT NULL DEFAULT 60,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ticker_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read ticker settings
CREATE POLICY "Anyone can read ticker" ON public.ticker_settings FOR SELECT USING (true);

-- Only admins can modify
CREATE POLICY "Admins can manage ticker" ON public.ticker_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert default row
INSERT INTO public.ticker_settings (message, is_active) VALUES ('🎰 Bem-vindo ao Jogos Online — Resultados atualizados em tempo real!', true);
