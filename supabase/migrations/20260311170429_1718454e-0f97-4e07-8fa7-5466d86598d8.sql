
-- Update draw_time enum to match actual PT-Rio schedule names
-- First drop dependent objects, alter, then recreate
ALTER TABLE public.draw_results ALTER COLUMN draw_time TYPE TEXT;
DROP TYPE public.draw_time;
CREATE TYPE public.draw_time AS ENUM ('PPT', 'PTM', 'PT', 'PTV', 'PTN', 'COR');
ALTER TABLE public.draw_results ALTER COLUMN draw_time TYPE draw_time USING draw_time::draw_time;
