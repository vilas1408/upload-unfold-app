-- Table 1: Store historical option premium snapshots
CREATE TABLE option_premiums (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  option_type TEXT NOT NULL CHECK (option_type IN ('share', 'index')),
  strike_price NUMERIC NOT NULL,
  contract_type TEXT NOT NULL CHECK (contract_type IN ('CE', 'PE')),
  premium NUMERIC NOT NULL,
  underlying_price NUMERIC NOT NULL,
  days_to_expiry INTEGER NOT NULL,
  implied_volatility NUMERIC,
  open_interest BIGINT,
  volume BIGINT,
  bid_price NUMERIC,
  ask_price NUMERIC,
  delta NUMERIC,
  gamma NUMERIC,
  theta NUMERIC,
  vega NUMERIC,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  expiry_date DATE NOT NULL,
  
  CONSTRAINT unique_option_snapshot UNIQUE (symbol, strike_price, contract_type, timestamp)
);

CREATE INDEX idx_option_premiums_symbol ON option_premiums(symbol);
CREATE INDEX idx_option_premiums_timestamp ON option_premiums(timestamp DESC);
CREATE INDEX idx_option_premiums_symbol_timestamp ON option_premiums(symbol, timestamp DESC);

-- Table 2: Store volatility metrics for stocks
CREATE TABLE volatility_metrics (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  date DATE NOT NULL,
  historical_volatility_7d NUMERIC,
  historical_volatility_30d NUMERIC,
  implied_volatility_avg NUMERIC,
  iv_rank NUMERIC,
  iv_percentile NUMERIC,
  volume_avg_20d BIGINT,
  volume_today BIGINT,
  volume_ratio NUMERIC,
  
  CONSTRAINT unique_volatility_daily UNIQUE (symbol, date)
);

CREATE INDEX idx_volatility_symbol ON volatility_metrics(symbol);
CREATE INDEX idx_volatility_date ON volatility_metrics(date DESC);

-- Table 3: Track predictions for backtesting
CREATE TABLE prediction_tracking (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  option_type TEXT NOT NULL CHECK (option_type IN ('share', 'index')),
  
  predicted_at TIMESTAMPTZ DEFAULT NOW(),
  prediction_json JSONB NOT NULL,
  
  predicted_strategy TEXT,
  predicted_direction TEXT CHECK (predicted_direction IN ('CALL', 'PUT', 'Mixed')),
  predicted_strike NUMERIC,
  predicted_entry_premium NUMERIC,
  predicted_target_premium NUMERIC,
  predicted_sl_premium NUMERIC,
  expiry_date DATE,
  
  actual_entry_premium NUMERIC,
  actual_max_premium NUMERIC,
  actual_min_premium NUMERIC,
  actual_exit_premium NUMERIC,
  exit_reason TEXT,
  
  prediction_accuracy NUMERIC,
  direction_correct BOOLEAN,
  target_hit BOOLEAN,
  sl_hit BOOLEAN,
  pnl_percent NUMERIC,
  pnl_amount NUMERIC,
  
  technical_score INTEGER,
  trend_at_prediction TEXT,
  rsi_at_prediction INTEGER,
  iv_rank_at_prediction INTEGER,
  
  tracked_until TIMESTAMPTZ,
  outcome_recorded_at TIMESTAMPTZ,
  
  CONSTRAINT unique_prediction UNIQUE (symbol, predicted_at)
);

CREATE INDEX idx_prediction_tracking_symbol ON prediction_tracking(symbol);
CREATE INDEX idx_prediction_tracking_date ON prediction_tracking(predicted_at DESC);
CREATE INDEX idx_prediction_tracking_expiry ON prediction_tracking(expiry_date);

-- Table 4: Store aggregated accuracy metrics
CREATE TABLE accuracy_metrics (
  id BIGSERIAL PRIMARY KEY,
  period TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  total_predictions INTEGER DEFAULT 0,
  successful_predictions INTEGER DEFAULT 0,
  failed_predictions INTEGER DEFAULT 0,
  pending_predictions INTEGER DEFAULT 0,
  
  accuracy_rate NUMERIC,
  avg_profit_percent NUMERIC,
  avg_loss_percent NUMERIC,
  win_rate NUMERIC,
  
  best_performing_symbol TEXT,
  worst_performing_symbol TEXT,
  
  call_success_rate NUMERIC,
  put_success_rate NUMERIC,
  
  bullish_trend_accuracy NUMERIC,
  bearish_trend_accuracy NUMERIC,
  neutral_trend_accuracy NUMERIC,
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_accuracy_period UNIQUE (period, period_start, period_end)
);

-- Enable RLS on all tables
ALTER TABLE option_premiums ENABLE ROW LEVEL SECURITY;
ALTER TABLE volatility_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE accuracy_metrics ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "Anyone can read option premiums" ON option_premiums FOR SELECT USING (true);
CREATE POLICY "Anyone can read volatility metrics" ON volatility_metrics FOR SELECT USING (true);
CREATE POLICY "Anyone can read prediction tracking" ON prediction_tracking FOR SELECT USING (true);
CREATE POLICY "Anyone can read accuracy metrics" ON accuracy_metrics FOR SELECT USING (true);

-- System insert policies
CREATE POLICY "System can insert option premiums" ON option_premiums FOR INSERT WITH CHECK (true);
CREATE POLICY "System can insert volatility metrics" ON volatility_metrics FOR INSERT WITH CHECK (true);
CREATE POLICY "System can manage prediction tracking" ON prediction_tracking FOR ALL USING (true);
CREATE POLICY "System can manage accuracy metrics" ON accuracy_metrics FOR ALL USING (true);