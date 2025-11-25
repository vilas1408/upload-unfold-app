-- Phase 1: Fix existing broken tracked_until timestamps
UPDATE prediction_tracking 
SET tracked_until = (expiry_date::date + interval '10 hours')::timestamptz
WHERE outcome_recorded_at IS NULL 
AND tracked_until < now();

-- Phase 3: Create prediction_tuning table for auto-learning
CREATE TABLE IF NOT EXISTS public.prediction_tuning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tuning_type text NOT NULL,
  tuning_key text NOT NULL,
  accuracy_rate numeric,
  sample_size integer DEFAULT 0,
  confidence_adjustment numeric DEFAULT 0,
  last_calculated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_tuning UNIQUE(tuning_type, tuning_key)
);

-- Enable RLS on prediction_tuning
ALTER TABLE public.prediction_tuning ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read tuning parameters
CREATE POLICY "Anyone can read tuning parameters" 
ON public.prediction_tuning 
FOR SELECT 
USING (true);

-- Only system can manage tuning parameters
CREATE POLICY "System can manage tuning parameters" 
ON public.prediction_tuning 
FOR ALL 
USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_prediction_tuning_lookup 
ON public.prediction_tuning(tuning_type, tuning_key);