-- Add market indices to stocks table
INSERT INTO public.stocks (symbol, name, exchange, sector) VALUES
('^NSEI', 'Nifty 50', 'NSE', 'Index'),
('^NSEBANK', 'Bank Nifty', 'NSE', 'Index'),
('^NSEMDCP50', 'Nifty Midcap 50', 'NSE', 'Index')
ON CONFLICT (symbol) DO NOTHING;