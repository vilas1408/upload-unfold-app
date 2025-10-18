-- Create function for updating timestamps (if not exists)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create stocks table for NSE and BSE listings
CREATE TABLE public.stocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  exchange TEXT NOT NULL CHECK (exchange IN ('NSE', 'BSE')),
  sector TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.stocks ENABLE ROW LEVEL SECURITY;

-- Create policy to allow everyone to read stocks (public data)
CREATE POLICY "Stocks are viewable by everyone" 
ON public.stocks 
FOR SELECT 
USING (true);

-- Create index for faster searches
CREATE INDEX idx_stocks_symbol ON public.stocks(symbol);
CREATE INDEX idx_stocks_name ON public.stocks(name);
CREATE INDEX idx_stocks_exchange ON public.stocks(exchange);

-- Insert popular NSE stocks (Nifty 50)
INSERT INTO public.stocks (symbol, name, exchange, sector) VALUES
  ('RELIANCE.NS', 'Reliance Industries', 'NSE', 'Oil & Gas'),
  ('TCS.NS', 'Tata Consultancy Services', 'NSE', 'IT'),
  ('HDFCBANK.NS', 'HDFC Bank', 'NSE', 'Banking'),
  ('INFY.NS', 'Infosys', 'NSE', 'IT'),
  ('ICICIBANK.NS', 'ICICI Bank', 'NSE', 'Banking'),
  ('HINDUNILVR.NS', 'Hindustan Unilever', 'NSE', 'FMCG'),
  ('ITC.NS', 'ITC Limited', 'NSE', 'FMCG'),
  ('SBIN.NS', 'State Bank of India', 'NSE', 'Banking'),
  ('BHARTIARTL.NS', 'Bharti Airtel', 'NSE', 'Telecom'),
  ('KOTAKBANK.NS', 'Kotak Mahindra Bank', 'NSE', 'Banking'),
  ('LT.NS', 'Larsen & Toubro', 'NSE', 'Infrastructure'),
  ('AXISBANK.NS', 'Axis Bank', 'NSE', 'Banking'),
  ('BAJFINANCE.NS', 'Bajaj Finance', 'NSE', 'Finance'),
  ('ASIANPAINT.NS', 'Asian Paints', 'NSE', 'Paints'),
  ('MARUTI.NS', 'Maruti Suzuki', 'NSE', 'Automobile'),
  ('HCLTECH.NS', 'HCL Technologies', 'NSE', 'IT'),
  ('SUNPHARMA.NS', 'Sun Pharma', 'NSE', 'Pharma'),
  ('TITAN.NS', 'Titan Company', 'NSE', 'Jewellery'),
  ('WIPRO.NS', 'Wipro', 'NSE', 'IT'),
  ('ULTRACEMCO.NS', 'UltraTech Cement', 'NSE', 'Cement'),
  ('ONGC.NS', 'Oil and Natural Gas Corporation', 'NSE', 'Oil & Gas'),
  ('NESTLEIND.NS', 'Nestle India', 'NSE', 'FMCG'),
  ('TATAMOTORS.NS', 'Tata Motors', 'NSE', 'Automobile'),
  ('NTPC.NS', 'NTPC', 'NSE', 'Power'),
  ('POWERGRID.NS', 'Power Grid Corporation', 'NSE', 'Power'),
  ('TATASTEEL.NS', 'Tata Steel', 'NSE', 'Steel'),
  ('M&M.NS', 'Mahindra & Mahindra', 'NSE', 'Automobile'),
  ('BAJAJFINSV.NS', 'Bajaj Finserv', 'NSE', 'Finance'),
  ('ADANIPORTS.NS', 'Adani Ports', 'NSE', 'Infrastructure'),
  ('COALINDIA.NS', 'Coal India', 'NSE', 'Mining'),
  ('TECHM.NS', 'Tech Mahindra', 'NSE', 'IT'),
  ('DRREDDY.NS', 'Dr. Reddy''s Labs', 'NSE', 'Pharma'),
  ('INDUSINDBK.NS', 'IndusInd Bank', 'NSE', 'Banking'),
  ('CIPLA.NS', 'Cipla', 'NSE', 'Pharma'),
  ('EICHERMOT.NS', 'Eicher Motors', 'NSE', 'Automobile'),
  ('GRASIM.NS', 'Grasim Industries', 'NSE', 'Cement'),
  ('HINDALCO.NS', 'Hindalco Industries', 'NSE', 'Metals'),
  ('DIVISLAB.NS', 'Divi''s Laboratories', 'NSE', 'Pharma'),
  ('BRITANNIA.NS', 'Britannia Industries', 'NSE', 'FMCG'),
  ('JSWSTEEL.NS', 'JSW Steel', 'NSE', 'Steel'),
  ('HEROMOTOCO.NS', 'Hero MotoCorp', 'NSE', 'Automobile'),
  ('TATACONSUM.NS', 'Tata Consumer Products', 'NSE', 'FMCG'),
  ('APOLLOHOSP.NS', 'Apollo Hospitals', 'NSE', 'Healthcare'),
  ('ADANIENT.NS', 'Adani Enterprises', 'NSE', 'Conglomerate'),
  ('BPCL.NS', 'Bharat Petroleum', 'NSE', 'Oil & Gas'),
  ('SHREECEM.NS', 'Shree Cement', 'NSE', 'Cement'),
  ('VEDL.NS', 'Vedanta', 'NSE', 'Mining');

-- Insert popular BSE stocks
INSERT INTO public.stocks (symbol, name, exchange, sector) VALUES
  ('500325.BO', 'Reliance Industries', 'BSE', 'Oil & Gas'),
  ('532540.BO', 'Tata Consultancy Services', 'BSE', 'IT'),
  ('500180.BO', 'HDFC Bank', 'BSE', 'Banking'),
  ('500209.BO', 'Infosys', 'BSE', 'IT'),
  ('532174.BO', 'ICICI Bank', 'BSE', 'Banking'),
  ('500696.BO', 'Hindustan Unilever', 'BSE', 'FMCG'),
  ('500875.BO', 'ITC Limited', 'BSE', 'FMCG'),
  ('500112.BO', 'State Bank of India', 'BSE', 'Banking'),
  ('532454.BO', 'Bharti Airtel', 'BSE', 'Telecom'),
  ('500247.BO', 'Kotak Mahindra Bank', 'BSE', 'Banking'),
  ('500510.BO', 'Larsen & Toubro', 'BSE', 'Infrastructure'),
  ('532215.BO', 'Axis Bank', 'BSE', 'Banking'),
  ('500034.BO', 'Bajaj Finance', 'BSE', 'Finance'),
  ('500820.BO', 'Asian Paints', 'BSE', 'Paints'),
  ('532500.BO', 'Maruti Suzuki', 'BSE', 'Automobile'),
  ('532281.BO', 'HCL Technologies', 'BSE', 'IT'),
  ('524715.BO', 'Sun Pharma', 'BSE', 'Pharma'),
  ('500114.BO', 'Titan Company', 'BSE', 'Jewellery'),
  ('507685.BO', 'Wipro', 'BSE', 'IT'),
  ('532538.BO', 'UltraTech Cement', 'BSE', 'Cement');

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_stocks_updated_at
BEFORE UPDATE ON public.stocks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();