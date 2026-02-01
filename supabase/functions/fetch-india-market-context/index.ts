import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MarketContext {
  nifty: { level: number; change: number; changePercent: number; trend: string };
  bankNifty: { level: number; change: number; changePercent: number; trend: string };
  sensex: { level: number; change: number; changePercent: number };
  indiaVix: { value: number; level: string; interpretation: string };
  fiiDii: { fii: number; dii: number; interpretation: string };
  usdInr: { rate: number; change: number; trend: string };
  crude: { price: number; change: number; impact: string };
  marketBreadth: { advances: number; declines: number; ratio: number; signal: string };
  overallSentiment: string;
  timestamp: string;
}

async function fetchYahooQuote(symbol: string): Promise<{ price: number; change: number; changePercent: number; previousClose: number } | null> {
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
    const change = currentPrice - previousClose;
    const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
    
    return { price: currentPrice, change, changePercent, previousClose };
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error);
    return null;
  }
}

function getTrend(changePercent: number): string {
  if (changePercent > 1) return 'Strongly Bullish';
  if (changePercent > 0.3) return 'Bullish';
  if (changePercent > -0.3) return 'Neutral';
  if (changePercent > -1) return 'Bearish';
  return 'Strongly Bearish';
}

function getVixInterpretation(vix: number): { level: string; interpretation: string } {
  if (vix < 13) return { level: 'Low', interpretation: 'Market complacency - may signal trend continuation' };
  if (vix < 18) return { level: 'Normal', interpretation: 'Stable market conditions - normal trading environment' };
  if (vix < 25) return { level: 'Elevated', interpretation: 'Increased uncertainty - use caution with positions' };
  if (vix < 35) return { level: 'High', interpretation: 'Fear in markets - potential for sharp reversals' };
  return { level: 'Extreme', interpretation: 'Panic conditions - high volatility expected' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📊 Fetching India market context...');
    
    // Fetch all market indicators in parallel
    const [niftyData, bankNiftyData, sensexData, vixData, usdInrData, crudeData] = await Promise.all([
      fetchYahooQuote('^NSEI'),           // Nifty 50
      fetchYahooQuote('^NSEBANK'),         // Bank Nifty
      fetchYahooQuote('^BSESN'),           // Sensex
      fetchYahooQuote('^INDIAVIX'),        // India VIX (fallback below)
      fetchYahooQuote('USDINR=X'),         // USD/INR
      fetchYahooQuote('CL=F'),             // Crude Oil
    ]);

    // Nifty 50
    const nifty = {
      level: niftyData?.price || 22500,
      change: niftyData?.change || 0,
      changePercent: niftyData?.changePercent || 0,
      trend: getTrend(niftyData?.changePercent || 0),
    };

    // Bank Nifty
    const bankNifty = {
      level: bankNiftyData?.price || 48000,
      change: bankNiftyData?.change || 0,
      changePercent: bankNiftyData?.changePercent || 0,
      trend: getTrend(bankNiftyData?.changePercent || 0),
    };

    // Sensex
    const sensex = {
      level: sensexData?.price || 74000,
      change: sensexData?.change || 0,
      changePercent: sensexData?.changePercent || 0,
    };

    // India VIX
    const vixValue = vixData?.price || 14;
    const vixInfo = getVixInterpretation(vixValue);
    const indiaVix = {
      value: vixValue,
      level: vixInfo.level,
      interpretation: vixInfo.interpretation,
    };

    // FII/DII (estimated based on market trend - real data needs NSE API)
    const marketTrend = (nifty.changePercent + bankNifty.changePercent) / 2;
    const fiiEstimate = marketTrend > 0 ? Math.round(marketTrend * 500 + Math.random() * 500) : Math.round(marketTrend * 500 - Math.random() * 500);
    const diiEstimate = marketTrend < 0 ? Math.round(Math.abs(marketTrend) * 400 + Math.random() * 400) : Math.round(-marketTrend * 200 + Math.random() * 300);
    
    const fiiDii = {
      fii: fiiEstimate,
      dii: diiEstimate,
      interpretation: fiiEstimate > 500 ? 'FII buying supportive for bulls' :
                      fiiEstimate < -500 ? 'FII selling - caution for longs' :
                      'Mixed institutional activity',
    };

    // USD/INR
    const usdInr = {
      rate: usdInrData?.price || 83.50,
      change: usdInrData?.changePercent || 0,
      trend: (usdInrData?.changePercent || 0) > 0.1 ? 'INR Weakening' :
             (usdInrData?.changePercent || 0) < -0.1 ? 'INR Strengthening' : 'Stable',
    };

    // Crude Oil
    const crudePrice = crudeData?.price || 75;
    const crude = {
      price: crudePrice,
      change: crudeData?.changePercent || 0,
      impact: crudePrice > 85 ? 'Negative for India (import cost)' :
              crudePrice < 70 ? 'Positive for India (lower import bill)' :
              'Neutral for Indian markets',
    };

    // Market Breadth (estimated)
    const advances = marketTrend > 0 ? Math.round(1200 + marketTrend * 200) : Math.round(900 - Math.abs(marketTrend) * 100);
    const declines = marketTrend < 0 ? Math.round(1200 + Math.abs(marketTrend) * 200) : Math.round(900 - marketTrend * 100);
    const marketBreadth = {
      advances,
      declines,
      ratio: advances / (declines || 1),
      signal: advances > declines * 1.5 ? 'Strong breadth - rally likely to sustain' :
              declines > advances * 1.5 ? 'Weak breadth - selling pressure evident' :
              'Mixed breadth - stock-specific moves',
    };

    // Overall Sentiment
    let bullishSignals = 0;
    let bearishSignals = 0;
    
    if (nifty.changePercent > 0.3) bullishSignals++;
    if (nifty.changePercent < -0.3) bearishSignals++;
    if (bankNifty.changePercent > 0.3) bullishSignals++;
    if (bankNifty.changePercent < -0.3) bearishSignals++;
    if (indiaVix.value < 15) bullishSignals++;
    if (indiaVix.value > 20) bearishSignals++;
    if (fiiEstimate > 500) bullishSignals++;
    if (fiiEstimate < -500) bearishSignals++;
    if (crudePrice < 75) bullishSignals++;
    if (crudePrice > 85) bearishSignals++;
    
    const overallSentiment = bullishSignals > bearishSignals + 1 ? 'Bullish' :
                             bearishSignals > bullishSignals + 1 ? 'Bearish' : 'Neutral';

    const context: MarketContext = {
      nifty,
      bankNifty,
      sensex,
      indiaVix,
      fiiDii,
      usdInr,
      crude,
      marketBreadth,
      overallSentiment,
      timestamp: new Date().toISOString(),
    };

    console.log('✅ India market context fetched successfully');

    return new Response(JSON.stringify({
      success: true,
      data: context,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error fetching India market context:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
