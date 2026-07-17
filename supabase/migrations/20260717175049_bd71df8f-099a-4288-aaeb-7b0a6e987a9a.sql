
ALTER TABLE public.draw_results REPLICA IDENTITY FULL;
ALTER TABLE public.sp_results REPLICA IDENTITY FULL;
ALTER TABLE public.capital_results REPLICA IDENTITY FULL;
ALTER TABLE public.federal_results REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.draw_results; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.sp_results; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.capital_results; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.federal_results; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
