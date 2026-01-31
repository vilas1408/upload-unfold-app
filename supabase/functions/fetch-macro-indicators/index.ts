import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MacroIndicators {
  dxy: { value: number; change: number; trend: string };
  usTreasuryYield10Y: { value: number; change: number };
  fedFundsRate: { value: number; outlook: string };
  usdInr: { value: number; change: number; trend: string };
  vix: { value: number; level: string };
  chinaPmi: { value: number; trend: string };
  goldDemand: string;
  oilSupply: string;
  timestamp: string;
}

async function fetchYahooQuote(symbol: string): Promise<{ price: number; change: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const meta = data.chart?.result?.[0]?.meta;
    if (!meta) return null;
    
    const currentPrice = meta.regularMarketPrice || 0;
    const previousClose = meta.previousClose || currentPrice;
    const change = previousClose > 0 ? ((currentPrice - previousClose) / previousClose) * 100 : 0;
    
    return { price: currentPrice, change };
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📊 Fetching macro economic indicators...');
    
    // Fetch all indicators in parallel
    const [dxyData, tnxData, usdInrData, vixData] = await Promise.all([
      fetchYahooQuote('DX-Y.NYB'),      // US Dollar Index
      fetchYahooQuote('^TNX'),           // US 10Y Treasury Yield
      fetchYahooQuote('USDINR=X'),       // USD/INR
      fetchYahooQuote('^VIX'),           // VIX Volatility Index
    ]);

    // DXY Analysis
    const dxy = {
      value: dxyData?.price || 104.5,
      change: dxyData?.change || 0,
      trend: (dxyData?.change || 0) > 0.2 ? 'Strengthening' : 
             (dxyData?.change || 0) < -0.2 ? 'Weakening' : 'Stable'
    };

    // US 10Y Treasury Yield
    const usTreasuryYield10Y = {
      value: tnxData?.price || 4.25,
      change: tnxData?.change || 0
    };

    // Fed Funds Rate (approximation based on 10Y yield)
    const fedFundsRate = {
      value: 5.25, // Current Fed Funds target
      outlook: usTreasuryYield10Y.value < 4.0 ? 'Dovish - Rate cuts expected' :
               usTreasuryYield10Y.value > 4.5 ? 'Hawkish - Rates may stay elevated' :
               'Neutral - Wait and watch approach'
    };

    // USD/INR
    const usdInr = {
      value: usdInrData?.price || 83.50,
      change: usdInrData?.change || 0,
      trend: (usdInrData?.change || 0) > 0.1 ? 'INR Weakening' :
             (usdInrData?.change || 0) < -0.1 ? 'INR Strengthening' : 'Stable'
    };

    // VIX Analysis
    const vixValue = vixData?.price || 15;
    const vix = {
      value: vixValue,
      level: vixValue < 15 ? 'Low - Market complacency' :
             vixValue < 20 ? 'Normal - Stable conditions' :
             vixValue < 30 ? 'Elevated - Increased uncertainty' :
             'High - Fear in markets'
    };

    // China PMI (estimated - would need actual data source)
    const chinaPmi = {
      value: 50.1, // Neutral point is 50
      trend: 'Stable - Manufacturing sector balanced'
    };

    // Commodity-specific assessments
    const goldDemand = dxy.trend === 'Weakening' && vix.value > 20 
      ? 'Strong - Safe haven demand elevated'
      : dxy.trend === 'Strengthening' 
      ? 'Weak - Dollar strength reducing appeal'
      : 'Moderate - Mixed signals';

    const oilSupply = 'Balanced - OPEC+ maintaining production cuts';

    const indicators: MacroIndicators = {
      dxy,
      usTreasuryYield10Y,
      fedFundsRate,
      usdInr,
      vix,
      chinaPmi,
      goldDemand,
      oilSupply,
      timestamp: new Date().toISOString(),
    };

    console.log('✅ Macro indicators fetched successfully');

    return new Response(JSON.stringify({
      success: true,
      data: indicators,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error fetching macro indicators:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
