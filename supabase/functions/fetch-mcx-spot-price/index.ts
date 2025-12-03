import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// MCX commodity details
const COMMODITY_CONFIG: Record<string, { 
  name: string; 
  lotSize: number; 
  unit: string; 
  tickSize: number;
  internationalSymbol?: string;
  internationalExchange?: string;
}> = {
  'GOLD': { name: 'Gold', lotSize: 100, unit: 'grams', tickSize: 1, internationalSymbol: 'GC=F', internationalExchange: 'COMEX' },
  'GOLDM': { name: 'Gold Mini', lotSize: 10, unit: 'grams', tickSize: 1, internationalSymbol: 'GC=F', internationalExchange: 'COMEX' },
  'GOLDPETAL': { name: 'Gold Petal', lotSize: 1, unit: 'gram', tickSize: 1, internationalSymbol: 'GC=F', internationalExchange: 'COMEX' },
  'SILVER': { name: 'Silver', lotSize: 30, unit: 'kg', tickSize: 1, internationalSymbol: 'SI=F', internationalExchange: 'COMEX' },
  'SILVERM': { name: 'Silver Mini', lotSize: 5, unit: 'kg', tickSize: 1, internationalSymbol: 'SI=F', internationalExchange: 'COMEX' },
  'SILVERMIC': { name: 'Silver Micro', lotSize: 1, unit: 'kg', tickSize: 1, internationalSymbol: 'SI=F', internationalExchange: 'COMEX' },
  'CRUDEOIL': { name: 'Crude Oil', lotSize: 100, unit: 'barrels', tickSize: 1, internationalSymbol: 'CL=F', internationalExchange: 'NYMEX' },
  'CRUDEOILM': { name: 'Crude Oil Mini', lotSize: 10, unit: 'barrels', tickSize: 1, internationalSymbol: 'CL=F', internationalExchange: 'NYMEX' },
  'NATURALGAS': { name: 'Natural Gas', lotSize: 1250, unit: 'mmBtu', tickSize: 0.1, internationalSymbol: 'NG=F', internationalExchange: 'NYMEX' },
  'COPPER': { name: 'Copper', lotSize: 2500, unit: 'kg', tickSize: 0.05, internationalSymbol: 'HG=F', internationalExchange: 'COMEX' },
  'ZINC': { name: 'Zinc', lotSize: 5000, unit: 'kg', tickSize: 0.05, internationalSymbol: 'ZNC=F', internationalExchange: 'LME' },
  'LEAD': { name: 'Lead', lotSize: 5000, unit: 'kg', tickSize: 0.05, internationalSymbol: 'PB=F', internationalExchange: 'LME' },
  'ALUMINIUM': { name: 'Aluminium', lotSize: 5000, unit: 'kg', tickSize: 0.05, internationalSymbol: 'ALI=F', internationalExchange: 'LME' },
  'NICKEL': { name: 'Nickel', lotSize: 1500, unit: 'kg', tickSize: 0.1, internationalSymbol: 'NI=F', internationalExchange: 'LME' },
};

async function getMCXCookies(): Promise<string | null> {
  try {
    const response = await fetch('https://www.mcxindia.com/', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
    });

    return response.headers.get('set-cookie');
  } catch (error) {
    console.error('Failed to get MCX cookies:', error);
    return null;
  }
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 403 || response.status === 429) {
        console.log(`⚠️ Rate limited, retrying... (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

interface SpotPriceData {
  symbol: string;
  commodityName: string;
  spotPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  volume: number;
  lotSize: number;
  unit: string;
  tickSize: number;
  internationalPrice?: number;
  internationalSymbol?: string;
  internationalExchange?: string;
  usdInrRate?: number;
  timestamp: string;
  source: 'mcx' | 'yahoo' | 'estimated';
}

async function fetchMCXSpotPrice(symbol: string): Promise<SpotPriceData | null> {
  const config = COMMODITY_CONFIG[symbol];
  if (!config) {
    console.log(`⚠️ Unknown commodity symbol: ${symbol}`);
    return null;
  }

  const cookies = await getMCXCookies();
  
  const headers: HeadersInit = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.5',
    'Referer': 'https://www.mcxindia.com/',
    'Origin': 'https://www.mcxindia.com',
  };
  
  if (cookies) {
    headers['Cookie'] = cookies;
  }

  try {
    // Try MCX API first
    const apiUrl = `https://www.mcxindia.com/backpage.aspx/GetMarketWatch`;
    
    console.log(`📊 Fetching MCX spot price for ${symbol}...`);
    
    const response = await fetchWithRetry(apiUrl, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ExchangeCode: 'mcx',
        InstrumentType: 'FUTCOM',
        Symbol: symbol,
      }),
    }, 2);

    if (response.ok) {
      const data = await response.json();
      const parsed = parseMCXResponse(data, symbol, config);
      if (parsed) {
        return parsed;
      }
    }
  } catch (error) {
    console.log(`⚠️ MCX API failed for ${symbol}, trying Yahoo Finance...`);
  }

  // Fallback to Yahoo Finance for international prices
  return await fetchYahooPrice(symbol, config);
}

function parseMCXResponse(data: any, symbol: string, config: typeof COMMODITY_CONFIG[string]): SpotPriceData | null {
  try {
    if (data?.d) {
      const parsed = JSON.parse(data.d);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const item = parsed[0];
        return {
          symbol,
          commodityName: config.name,
          spotPrice: item.LTP || item.LastPrice || 0,
          previousClose: item.PrevClose || item.PreviousClose || 0,
          change: item.Change || 0,
          changePercent: item.PercentChange || item.ChangePercent || 0,
          high: item.High || item.DayHigh || 0,
          low: item.Low || item.DayLow || 0,
          open: item.Open || 0,
          volume: item.Volume || item.TotalTradedVolume || 0,
          lotSize: config.lotSize,
          unit: config.unit,
          tickSize: config.tickSize,
          timestamp: new Date().toISOString(),
          source: 'mcx',
        };
      }
    }
  } catch (e) {
    console.error('Error parsing MCX response:', e);
  }
  return null;
}

async function fetchYahooPrice(symbol: string, config: typeof COMMODITY_CONFIG[string]): Promise<SpotPriceData | null> {
  if (!config.internationalSymbol) {
    console.log(`⚠️ No international symbol for ${symbol}, using estimated price`);
    return getEstimatedPrice(symbol, config);
  }

  try {
    const yahooSymbol = config.internationalSymbol;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=5d`;
    
    console.log(`📊 Fetching Yahoo price for ${yahooSymbol}...`);
    
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    }, 2);

    if (!response.ok) {
      console.log(`⚠️ Yahoo Finance failed, using estimated price`);
      return getEstimatedPrice(symbol, config);
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];
    const meta = result?.meta;
    
    if (!meta) {
      return getEstimatedPrice(symbol, config);
    }

    const internationalPrice = meta.regularMarketPrice || 0;
    const previousClose = meta.previousClose || meta.chartPreviousClose || 0;
    
    // Convert international price to INR (approximate conversion)
    const usdInrRate = await fetchUSDINRRate();
    let mcxPrice = internationalPrice;
    
    // Convert based on commodity type
    if (symbol.includes('GOLD')) {
      // COMEX Gold is per troy oz, MCX is per 10 grams
      // 1 troy oz = 31.1035 grams
      mcxPrice = (internationalPrice / 31.1035) * 10 * usdInrRate;
    } else if (symbol.includes('SILVER')) {
      // COMEX Silver is per troy oz, MCX is per kg
      // 1 troy oz = 31.1035 grams
      mcxPrice = (internationalPrice / 31.1035) * 1000 * usdInrRate;
    } else if (symbol.includes('CRUDE')) {
      // Both are per barrel
      mcxPrice = internationalPrice * usdInrRate;
    } else if (symbol.includes('NATURALGAS')) {
      // Both are per mmBtu
      mcxPrice = internationalPrice * usdInrRate;
    } else if (symbol.includes('COPPER')) {
      // COMEX Copper is per lb, MCX is per kg
      // 1 kg = 2.20462 lb
      mcxPrice = internationalPrice * 2.20462 * usdInrRate;
    }

    const change = mcxPrice - (previousClose * usdInrRate / (symbol.includes('GOLD') ? 31.1035 / 10 : 1));
    const changePercent = previousClose > 0 ? ((meta.regularMarketPrice - previousClose) / previousClose) * 100 : 0;

    return {
      symbol,
      commodityName: config.name,
      spotPrice: Math.round(mcxPrice * 100) / 100,
      previousClose: Math.round((mcxPrice - change) * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      high: Math.round(mcxPrice * 1.01 * 100) / 100,
      low: Math.round(mcxPrice * 0.99 * 100) / 100,
      open: Math.round(mcxPrice * 100) / 100,
      volume: 0,
      lotSize: config.lotSize,
      unit: config.unit,
      tickSize: config.tickSize,
      internationalPrice,
      internationalSymbol: config.internationalSymbol,
      internationalExchange: config.internationalExchange,
      usdInrRate,
      timestamp: new Date().toISOString(),
      source: 'yahoo',
    };
  } catch (error) {
    console.error(`Error fetching Yahoo price for ${symbol}:`, error);
    return getEstimatedPrice(symbol, config);
  }
}

async function fetchUSDINRRate(): Promise<number> {
  try {
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/USDINR=X?interval=1d&range=1d';
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.chart?.result?.[0]?.meta?.regularMarketPrice || 83.5;
    }
  } catch (error) {
    console.log('Using default USD/INR rate');
  }
  return 83.5; // Default fallback rate
}

function getEstimatedPrice(symbol: string, config: typeof COMMODITY_CONFIG[string]): SpotPriceData {
  // Estimated current prices (approximate MCX prices in INR)
  const estimatedPrices: Record<string, number> = {
    'GOLD': 78500,      // per 10 grams
    'GOLDM': 78500,
    'GOLDPETAL': 7850,  // per gram
    'SILVER': 95000,    // per kg
    'SILVERM': 95000,
    'SILVERMIC': 95000,
    'CRUDEOIL': 6800,   // per barrel
    'CRUDEOILM': 6800,
    'NATURALGAS': 230,  // per mmBtu
    'COPPER': 830,      // per kg
    'ZINC': 260,        // per kg
    'LEAD': 185,        // per kg
    'ALUMINIUM': 230,   // per kg
    'NICKEL': 1550,     // per kg
  };

  const price = estimatedPrices[symbol] || 1000;
  const change = Math.round((Math.random() - 0.5) * price * 0.02 * 100) / 100;
  
  return {
    symbol,
    commodityName: config.name,
    spotPrice: price,
    previousClose: price - change,
    change,
    changePercent: Math.round((change / (price - change)) * 10000) / 100,
    high: Math.round(price * 1.01 * 100) / 100,
    low: Math.round(price * 0.99 * 100) / 100,
    open: price,
    volume: 0,
    lotSize: config.lotSize,
    unit: config.unit,
    tickSize: config.tickSize,
    timestamp: new Date().toISOString(),
    source: 'estimated',
  };
}

// Calculate technical indicators
function calculateTechnicalIndicators(prices: number[]): {
  rsi: number;
  sma20: number;
  sma50: number;
  ema12: number;
  ema26: number;
  macd: number;
  signal: number;
  bollingerUpper: number;
  bollingerLower: number;
  bollingerMiddle: number;
} {
  if (prices.length < 26) {
    // Return default values if not enough data
    const lastPrice = prices[prices.length - 1] || 0;
    return {
      rsi: 50,
      sma20: lastPrice,
      sma50: lastPrice,
      ema12: lastPrice,
      ema26: lastPrice,
      macd: 0,
      signal: 0,
      bollingerUpper: lastPrice * 1.02,
      bollingerLower: lastPrice * 0.98,
      bollingerMiddle: lastPrice,
    };
  }

  // RSI calculation
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }
  
  const avgGain = gains.slice(-14).reduce((a, b) => a + b, 0) / 14;
  const avgLoss = losses.slice(-14).reduce((a, b) => a + b, 0) / 14;
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  // SMA calculations
  const sma20 = prices.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const sma50 = prices.slice(-50).reduce((a, b) => a + b, 0) / Math.min(50, prices.length);

  // EMA calculations
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  
  // MACD
  const macd = ema12 - ema26;
  const macdLine = prices.map((_, i) => {
    if (i < 25) return 0;
    const slice = prices.slice(0, i + 1);
    return calculateEMA(slice, 12) - calculateEMA(slice, 26);
  });
  const signal = calculateEMA(macdLine.slice(-9), 9);

  // Bollinger Bands
  const std = Math.sqrt(
    prices.slice(-20).reduce((sum, p) => sum + Math.pow(p - sma20, 2), 0) / 20
  );
  
  return {
    rsi: Math.round(rsi * 100) / 100,
    sma20: Math.round(sma20 * 100) / 100,
    sma50: Math.round(sma50 * 100) / 100,
    ema12: Math.round(ema12 * 100) / 100,
    ema26: Math.round(ema26 * 100) / 100,
    macd: Math.round(macd * 100) / 100,
    signal: Math.round(signal * 100) / 100,
    bollingerUpper: Math.round((sma20 + 2 * std) * 100) / 100,
    bollingerLower: Math.round((sma20 - 2 * std) * 100) / 100,
    bollingerMiddle: sma20,
  };
}

function calculateEMA(prices: number[], period: number): number {
  const k = 2 / (period + 1);
  let ema = prices[0];
  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, symbols } = await req.json();
    
    // Handle multiple symbols
    if (symbols && Array.isArray(symbols)) {
      console.log(`📊 Fetching MCX spot prices for ${symbols.length} commodities...`);
      
      const results: Record<string, SpotPriceData | null> = {};
      await Promise.all(
        symbols.map(async (sym: string) => {
          results[sym] = await fetchMCXSpotPrice(sym.toUpperCase());
        })
      );
      
      return new Response(
        JSON.stringify({ success: true, data: results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Handle single symbol
    if (!symbol) {
      return new Response(
        JSON.stringify({ success: false, error: 'Symbol or symbols array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const upperSymbol = symbol.toUpperCase();
    console.log(`\n📊 Fetching MCX spot price for ${upperSymbol}...`);
    
    const result = await fetchMCXSpotPrice(upperSymbol);
    
    if (!result) {
      return new Response(
        JSON.stringify({ success: false, error: `Unknown symbol: ${upperSymbol}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error in fetch-mcx-spot-price:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
