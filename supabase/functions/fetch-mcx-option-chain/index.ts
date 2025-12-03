import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// MCX commodity symbols and their details
const COMMODITY_CONFIG: Record<string, { name: string; lotSize: number; unit: string; tickSize: number }> = {
  'GOLD': { name: 'Gold', lotSize: 100, unit: 'grams', tickSize: 1 },
  'GOLDM': { name: 'Gold Mini', lotSize: 10, unit: 'grams', tickSize: 1 },
  'GOLDPETAL': { name: 'Gold Petal', lotSize: 1, unit: 'gram', tickSize: 1 },
  'SILVER': { name: 'Silver', lotSize: 30, unit: 'kg', tickSize: 1 },
  'SILVERM': { name: 'Silver Mini', lotSize: 5, unit: 'kg', tickSize: 1 },
  'SILVERMIC': { name: 'Silver Micro', lotSize: 1, unit: 'kg', tickSize: 1 },
  'CRUDEOIL': { name: 'Crude Oil', lotSize: 100, unit: 'barrels', tickSize: 1 },
  'CRUDEOILM': { name: 'Crude Oil Mini', lotSize: 10, unit: 'barrels', tickSize: 1 },
  'NATURALGAS': { name: 'Natural Gas', lotSize: 1250, unit: 'mmBtu', tickSize: 0.1 },
  'COPPER': { name: 'Copper', lotSize: 2500, unit: 'kg', tickSize: 0.05 },
  'ZINC': { name: 'Zinc', lotSize: 5000, unit: 'kg', tickSize: 0.05 },
  'LEAD': { name: 'Lead', lotSize: 5000, unit: 'kg', tickSize: 0.05 },
  'ALUMINIUM': { name: 'Aluminium', lotSize: 5000, unit: 'kg', tickSize: 0.05 },
  'NICKEL': { name: 'Nickel', lotSize: 1500, unit: 'kg', tickSize: 0.1 },
};

async function getMCXCookies(): Promise<string | null> {
  try {
    console.log('🔐 Fetching MCX cookies...');
    const response = await fetch('https://www.mcxindia.com/', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    const cookies = response.headers.get('set-cookie');
    if (cookies) {
      console.log('✅ MCX cookies obtained');
      return cookies;
    }
    return null;
  } catch (error) {
    console.error('❌ Failed to get MCX cookies:', error);
    return null;
  }
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 403) {
        console.log(`⚠️ MCX returned 403, retrying... (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      console.log(`⚠️ Fetch failed, retrying... (attempt ${attempt}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

interface OptionChainData {
  strikePrice: number;
  expiryDate: string;
  CE?: {
    lastPrice: number;
    bidPrice: number;
    askPrice: number;
    openInterest: number;
    volume: number;
    impliedVolatility: number;
  };
  PE?: {
    lastPrice: number;
    bidPrice: number;
    askPrice: number;
    openInterest: number;
    volume: number;
    impliedVolatility: number;
  };
}

async function fetchMCXOptionChain(symbol: string): Promise<{ 
  success: boolean; 
  data?: any; 
  error?: string;
  source: 'mcx' | 'estimated';
}> {
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
    // MCX API endpoint for option chain
    const apiUrl = `https://www.mcxindia.com/backpage.aspx/GetOptionChain`;
    
    console.log(`📊 Fetching MCX option chain for ${symbol}...`);
    
    const response = await fetchWithRetry(apiUrl, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Ession: '', // MCX uses session-based requests
        Symbol: symbol,
      }),
    }, 3);

    if (!response.ok) {
      console.log(`⚠️ MCX API returned ${response.status}, trying alternative endpoint...`);
      return await fetchMCXOptionChainAlternative(symbol, headers);
    }

    const data = await response.json();
    console.log('✅ MCX option chain data received');
    
    return {
      success: true,
      data: parseMCXOptionChainResponse(data, symbol),
      source: 'mcx',
    };
  } catch (error) {
    console.error(`❌ Error fetching MCX option chain for ${symbol}:`, error);
    return await fetchMCXOptionChainAlternative(symbol, headers);
  }
}

async function fetchMCXOptionChainAlternative(symbol: string, headers: HeadersInit): Promise<{
  success: boolean;
  data?: any;
  error?: string;
  source: 'mcx' | 'estimated';
}> {
  try {
    // Alternative: Try the market watch API
    const marketWatchUrl = `https://www.mcxindia.com/backpage.aspx/GetMarketWatch`;
    
    console.log(`📊 Trying MCX market watch for ${symbol}...`);
    
    const response = await fetchWithRetry(marketWatchUrl, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ExchangeCode: 'mcx',
        InstrumentType: 'OPTFUT',
        Symbol: symbol,
      }),
    }, 2);

    if (!response.ok) {
      console.log(`⚠️ MCX market watch also failed, returning estimated data`);
      return generateEstimatedOptionChain(symbol);
    }

    const data = await response.json();
    return {
      success: true,
      data: parseMCXMarketWatchResponse(data, symbol),
      source: 'mcx',
    };
  } catch (error) {
    console.error(`❌ MCX alternative endpoint failed:`, error);
    return generateEstimatedOptionChain(symbol);
  }
}

function parseMCXOptionChainResponse(data: any, symbol: string): any {
  const config = COMMODITY_CONFIG[symbol] || { name: symbol, lotSize: 1, unit: 'units', tickSize: 1 };
  
  // Parse the MCX response format
  const optionChain: OptionChainData[] = [];
  let underlyingPrice = 0;
  let expiryDates: string[] = [];

  if (data?.d) {
    try {
      const parsed = JSON.parse(data.d);
      underlyingPrice = parsed.UnderlyingValue || parsed.LTP || 0;
      expiryDates = parsed.ExpiryDates || [];
      
      if (parsed.Data && Array.isArray(parsed.Data)) {
        for (const row of parsed.Data) {
          optionChain.push({
            strikePrice: row.StrikePrice || row.Strike,
            expiryDate: row.ExpiryDate,
            CE: row.CE ? {
              lastPrice: row.CE.LTP || row.CE.LastPrice || 0,
              bidPrice: row.CE.BidPrice || 0,
              askPrice: row.CE.AskPrice || 0,
              openInterest: row.CE.OI || row.CE.OpenInterest || 0,
              volume: row.CE.Volume || 0,
              impliedVolatility: row.CE.IV || 0,
            } : undefined,
            PE: row.PE ? {
              lastPrice: row.PE.LTP || row.PE.LastPrice || 0,
              bidPrice: row.PE.BidPrice || 0,
              askPrice: row.PE.AskPrice || 0,
              openInterest: row.PE.OI || row.PE.OpenInterest || 0,
              volume: row.PE.Volume || 0,
              impliedVolatility: row.PE.IV || 0,
            } : undefined,
          });
        }
      }
    } catch (e) {
      console.error('Error parsing MCX response:', e);
    }
  }

  return {
    symbol,
    commodityName: config.name,
    underlyingPrice,
    lotSize: config.lotSize,
    unit: config.unit,
    tickSize: config.tickSize,
    expiryDates,
    optionChain,
    timestamp: new Date().toISOString(),
  };
}

function parseMCXMarketWatchResponse(data: any, symbol: string): any {
  const config = COMMODITY_CONFIG[symbol] || { name: symbol, lotSize: 1, unit: 'units', tickSize: 1 };
  
  let underlyingPrice = 0;
  const optionChain: OptionChainData[] = [];
  
  if (data?.d) {
    try {
      const parsed = JSON.parse(data.d);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item.InstrumentType === 'FUTCOM') {
            underlyingPrice = item.LTP || item.LastPrice || 0;
          }
        }
      }
    } catch (e) {
      console.error('Error parsing MCX market watch:', e);
    }
  }

  return {
    symbol,
    commodityName: config.name,
    underlyingPrice,
    lotSize: config.lotSize,
    unit: config.unit,
    tickSize: config.tickSize,
    expiryDates: [],
    optionChain,
    timestamp: new Date().toISOString(),
  };
}

function generateEstimatedOptionChain(symbol: string): {
  success: boolean;
  data: any;
  source: 'mcx' | 'estimated';
} {
  const config = COMMODITY_CONFIG[symbol] || { name: symbol, lotSize: 1, unit: 'units', tickSize: 1 };
  
  // Estimated spot prices for common commodities (approximate)
  const estimatedPrices: Record<string, number> = {
    'GOLD': 78500,
    'GOLDM': 78500,
    'GOLDPETAL': 7850,
    'SILVER': 95000,
    'SILVERM': 95000,
    'SILVERMIC': 95000,
    'CRUDEOIL': 6800,
    'CRUDEOILM': 6800,
    'NATURALGAS': 230,
    'COPPER': 830,
    'ZINC': 260,
    'LEAD': 185,
    'ALUMINIUM': 230,
    'NICKEL': 1550,
  };

  const underlyingPrice = estimatedPrices[symbol] || 1000;
  const strikeInterval = symbol.includes('GOLD') ? 500 : 
                         symbol.includes('SILVER') ? 1000 : 
                         symbol.includes('CRUDE') ? 50 : 10;

  // Generate synthetic option chain
  const optionChain: OptionChainData[] = [];
  const atmStrike = Math.round(underlyingPrice / strikeInterval) * strikeInterval;
  
  // Get next monthly expiry
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const lastThursday = new Date(nextMonth);
  while (lastThursday.getDay() !== 4) {
    lastThursday.setDate(lastThursday.getDate() - 1);
  }
  const expiryDate = lastThursday.toISOString().split('T')[0];
  
  for (let i = -10; i <= 10; i++) {
    const strike = atmStrike + (i * strikeInterval);
    const moneyness = (strike - underlyingPrice) / underlyingPrice;
    const iv = 0.15 + Math.abs(moneyness) * 0.1; // Simple IV smile
    
    // Simple premium estimation
    const daysToExpiry = Math.max(1, Math.ceil((lastThursday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const timeValue = underlyingPrice * iv * Math.sqrt(daysToExpiry / 365);
    
    const callIntrinsic = Math.max(0, underlyingPrice - strike);
    const putIntrinsic = Math.max(0, strike - underlyingPrice);
    
    optionChain.push({
      strikePrice: strike,
      expiryDate,
      CE: {
        lastPrice: Math.round(callIntrinsic + timeValue * (1 - moneyness * 0.5)),
        bidPrice: 0,
        askPrice: 0,
        openInterest: Math.round(10000 * Math.exp(-Math.abs(moneyness) * 5)),
        volume: Math.round(1000 * Math.exp(-Math.abs(moneyness) * 3)),
        impliedVolatility: iv * 100,
      },
      PE: {
        lastPrice: Math.round(putIntrinsic + timeValue * (1 + moneyness * 0.5)),
        bidPrice: 0,
        askPrice: 0,
        openInterest: Math.round(10000 * Math.exp(-Math.abs(moneyness) * 5)),
        volume: Math.round(1000 * Math.exp(-Math.abs(moneyness) * 3)),
        impliedVolatility: iv * 100,
      },
    });
  }

  console.log(`📊 Generated estimated option chain for ${symbol}`);
  
  return {
    success: true,
    data: {
      symbol,
      commodityName: config.name,
      underlyingPrice,
      lotSize: config.lotSize,
      unit: config.unit,
      tickSize: config.tickSize,
      expiryDates: [expiryDate],
      optionChain,
      timestamp: new Date().toISOString(),
      isEstimated: true,
    },
    source: 'estimated',
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol } = await req.json();
    
    if (!symbol) {
      return new Response(
        JSON.stringify({ success: false, error: 'Symbol is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const upperSymbol = symbol.toUpperCase();
    console.log(`\n📊 Fetching MCX option chain for ${upperSymbol}...`);
    
    const result = await fetchMCXOptionChain(upperSymbol);
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error in fetch-mcx-option-chain:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
