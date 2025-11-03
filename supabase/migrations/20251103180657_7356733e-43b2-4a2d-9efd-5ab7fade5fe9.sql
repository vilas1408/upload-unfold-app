-- Create a table to cache stock predictions
CREATE TABLE IF NOT EXISTS public.stock_predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  company_name TEXT NOT NULL,
  prediction_date DATE NOT NULL,
  opening_price NUMERIC NOT NULL,
  closing_price NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  confidence TEXT NOT NULL,
  historical_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(symbol, prediction_date)
);

-- Create index for faster lookups
CREATE INDEX idx_stock_predictions_symbol_date ON public.stock_predictions(symbol, prediction_date);

-- Enable RLS
ALTER TABLE public.stock_predictions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read cached predictions (public data)
CREATE POLICY "Anyone can read stock predictions"
ON public.stock_predictions
FOR SELECT
USING (true);

-- Only the system can insert predictions (via edge function)
CREATE POLICY "System can insert stock predictions"
ON public.stock_predictions
FOR INSERT
WITH CHECK (true);