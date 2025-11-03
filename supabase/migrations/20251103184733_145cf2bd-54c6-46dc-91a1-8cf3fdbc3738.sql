-- Add support for multi-day predictions
ALTER TABLE stock_predictions
ADD COLUMN IF NOT EXISTS days_ahead INTEGER DEFAULT 1;

-- Create index for better performance on multi-day queries
CREATE INDEX IF NOT EXISTS idx_stock_predictions_symbol_date_days 
ON stock_predictions(symbol, prediction_date, days_ahead);

-- Add columns for enhanced confidence metrics
ALTER TABLE stock_predictions
ADD COLUMN IF NOT EXISTS technical_score INTEGER,
ADD COLUMN IF NOT EXISTS trend_alignment TEXT,
ADD COLUMN IF NOT EXISTS risk_factors TEXT;