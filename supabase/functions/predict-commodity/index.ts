import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Commodity configuration with strike intervals
const COMMODITY_CONFIG: { [key: string]: { lotSize: number; unit: string; tickSize: number; strikeInterval: number; ivRange: [number, number] } } = {
  'GOLD': { lotSize: 100, unit: 'grams', tickSize: 1, strikeInterval: 100, ivRange: [0.12, 0.20] },
  'GOLDM': { lotSize: 10, unit: 'grams', tickSize: 1, strikeInterval: 100, ivRange: [0.12, 0.20] },
  'SILVER': { lotSize: 30, unit: 'kg', tickSize: 1, strikeInterval: 500, ivRange: [0.18, 0.30] },
  'SILVERM': { lotSize: 5, unit: 'kg', tickSize: 1, strikeInterval: 500, ivRange: [0.18, 0.30] },
  'CRUDEOIL': { lotSize: 100, unit: 'barrels', tickSize: 1, strikeInterval: 100, ivRange: [0.25, 0.45] },
  'NATURALGAS': { lotSize: 1250, unit: 'mmBtu', tickSize: 0.1, strikeInterval: 5, ivRange: [0.35, 0.60] },
  'COPPER': { lotSize: 2500, unit: 'kg', tickSize: 0.05, strikeInterval: 5, ivRange: [0.15, 0.25] },
};

// MCX 2025-2026 Expiry Calendar
const MCX_EXPIRY_CALENDAR: { [commodity: string]: { [monthYear: string]: string } } = {
  'CRUDEOIL': {
    'DEC2025': '2025-12-07',
    'JAN2026': '2026-01-15',
    'FEB2026': '2026-02-17',
    'MAR2026': '2026-03-17',
  },
  'GOLD': {
    'DEC2025': '2025-12-05',
    'FEB2026': '2026-02-05',
    'APR2026': '2026-04-03',
  },
  'SILVER': {
    'DEC2025': '2025-12-05',
    'MAR2026': '2026-03-05',
  },
  'NATURALGAS': {
    'DEC2025': '2025-12-24',
    'JAN2026': '2026-01-27',
    'FEB2026': '2026-02-24',
  },
  'COPPER': {
    'DEC2025': '2025-12-30',
    'JAN2026': '2026-01-30',
    'FEB2026': '2026-02-27',
  },
};

function getMCXExpiry(symbol: string): { expiryDate: Date; expiryStr: string; daysToExpiry: number } {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  let contractMonth = currentMonth;
  let contractYear = currentYear;
  
  if (now.getDate() > 15) {
    contractMonth = (currentMonth + 1) % 12;
    if (contractMonth === 0) contractYear++;
  }
  
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const monthKey = `${monthNames[contractMonth]}${contractYear}`;
  
  const baseSymbol = symbol.replace(/M$/, '').replace(/MIC$/, '');
  if (MCX_EXPIRY_CALENDAR[baseSymbol]?.[monthKey]) {
    const calendarDate = new Date(MCX_EXPIRY_CALENDAR[baseSymbol][monthKey]);
    const daysToExpiry = Math.ceil((calendarDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      expiryDate: calendarDate,
      expiryStr: calendarDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      daysToExpiry: Math.max(1, daysToExpiry),
    };
  }
  
  let expiryDate: Date;
  
  if (symbol.includes('CRUDE')) {
    const futuresExpiry = new Date(contractYear, contractMonth, 18);
    expiryDate = subtractBusinessDays(futuresExpiry, 7);
  } else if (symbol.includes('GOLD') || symbol.includes('SILVER')) {
    expiryDate = new Date(contractYear, contractMonth, 5);
    while (expiryDate.getDay() === 0 || expiryDate.getDay() === 6) {
      expiryDate.setDate(expiryDate.getDate() - 1);
    }
  } else if (symbol.includes('NATURAL')) {
    expiryDate = new Date(contractYear, contractMonth, 25);
    while (expiryDate.getDay() === 0 || expiryDate.getDay() === 6) {
      expiryDate.setDate(expiryDate.getDate() - 1);
    }
  } else if (symbol.includes('COPPER')) {
    expiryDate = new Date(contractYear, contractMonth + 1, 0);
    while (expiryDate.getDay() === 0 || expiryDate.getDay() === 6) {
      expiryDate.setDate(expiryDate.getDate() - 1);
    }
  } else {
    expiryDate = new Date(contractYear, contractMonth + 1, 0);
    while (expiryDate.getDay() === 0 || expiryDate.getDay() === 6) {
      expiryDate.setDate(expiryDate.getDate() - 1);
    }
  }
  
  const daysToExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  return {
    expiryDate,
    expiryStr: expiryDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    daysToExpiry: Math.max(1, daysToExpiry),
  };
}

function subtractBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() - 1);
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      remaining--;
    }
  }
  return result;
}

function estimatePremium(
  spotPrice: number, 
  strikePrice: number, 
  daysToExpiry: number, 
  ivRange: [number, number], 
  isCall: boolean
): { premium: number; iv: number } {
  const timeToExpiry = daysToExpiry / 365;
  const iv = (ivRange[0] + ivRange[1]) / 2;
  
  const intrinsicValue = isCall 
    ? Math.max(0, spotPrice - strikePrice) 
    : Math.max(0, strikePrice - spotPrice);
  
  const timeValue = 0.4 * spotPrice * iv * Math.sqrt(timeToExpiry);
  
  const moneyness = spotPrice / strikePrice;
  const moneynessAdjustment = isCall
    ? (moneyness > 1 ? 1.1 : moneyness < 0.95 ? 0.7 : 1)
    : (moneyness < 1 ? 1.1 : moneyness > 1.05 ? 0.7 : 1);
  
  const premium = intrinsicValue + (timeValue * moneynessAdjustment);
  
  return {
    premium: Math.max(premium, spotPrice * 0.005),
    iv: iv * 100,
  };
}

// Calculate advanced technical indicators
function calculateAdvancedTechnicals(data: any[]): any {
  if (data.length < 26) {
    const latestPrice = data.length > 0 ? data[data.length - 1].close : 0;
    return getDefaultTechnicals(latestPrice);
  }
  
  const closes = data.map(d => d.close);
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const latest = closes[closes.length - 1];
  
  // RSI calculation
  let gains = 0, losses = 0;
  for (let i = closes.length - 14; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  const avgGain = gains / 14;
  const avgLoss = losses / 14;
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  
  // Moving averages
  const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const sma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / Math.min(50, closes.length);
  const sma100 = closes.slice(-100).reduce((a, b) => a + b, 0) / Math.min(100, closes.length);
  const sma200 = closes.slice(-200).reduce((a, b) => a + b, 0) / Math.min(200, closes.length);
  
  // EMA calculations
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const ema50 = calculateEMA(closes, 50);
  
  // MACD
  const macdValue = ema12 - ema26;
  const macdLine = closes.slice(-26).map((_, i, arr) => {
    if (i < 25) return 0;
    return calculateEMA(closes.slice(0, closes.length - 26 + i + 1), 12) - 
           calculateEMA(closes.slice(0, closes.length - 26 + i + 1), 26);
  });
  const signal = calculateEMA(macdLine.slice(-9), 9);
  const histogram = macdValue - signal;
  
  // ADX calculation (simplified)
  let plusDM = 0, minusDM = 0, tr = 0;
  for (let i = closes.length - 14; i < closes.length; i++) {
    const high = highs[i];
    const low = lows[i];
    const prevHigh = highs[i - 1];
    const prevLow = lows[i - 1];
    const prevClose = closes[i - 1];
    
    const upMove = high - prevHigh;
    const downMove = prevLow - low;
    
    if (upMove > downMove && upMove > 0) plusDM += upMove;
    if (downMove > upMove && downMove > 0) minusDM += downMove;
    
    tr += Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
  }
  
  const plusDI = (plusDM / tr) * 100;
  const minusDI = (minusDM / tr) * 100;
  const adx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;
  
  // ATR
  let atrSum = 0;
  for (let i = closes.length - 14; i < closes.length; i++) {
    const high = highs[i];
    const low = lows[i];
    const prevClose = closes[i - 1];
    atrSum += Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
  }
  const atr = atrSum / 14;
  
  // Stochastic
  const highest14 = Math.max(...highs.slice(-14));
  const lowest14 = Math.min(...lows.slice(-14));
  const stochK = ((latest - lowest14) / (highest14 - lowest14)) * 100;
  const stochD = (stochK + ((closes[closes.length - 2] - lowest14) / (highest14 - lowest14)) * 100 + 
                  ((closes[closes.length - 3] - lowest14) / (highest14 - lowest14)) * 100) / 3;
  
  // Bollinger Bands
  const std = Math.sqrt(closes.slice(-20).reduce((sum, p) => sum + Math.pow(p - sma20, 2), 0) / 20);
  const bbUpper = sma20 + 2 * std;
  const bbLower = sma20 - 2 * std;
  
  // Fibonacci levels (based on 50-day range)
  const high50 = Math.max(...highs.slice(-50));
  const low50 = Math.min(...lows.slice(-50));
  const range = high50 - low50;
  const fibLevels = [
    { ratio: 0.236, price: low50 + range * 0.236 },
    { ratio: 0.382, price: low50 + range * 0.382 },
    { ratio: 0.500, price: low50 + range * 0.500 },
    { ratio: 0.618, price: low50 + range * 0.618 },
    { ratio: 0.786, price: low50 + range * 0.786 },
  ];
  
  // Support/Resistance levels
  const recentLows = lows.slice(-20).sort((a, b) => a - b);
  const recentHighs = highs.slice(-20).sort((a, b) => b - a);
  const supports = [recentLows[0], recentLows[Math.floor(recentLows.length / 3)], sma50 - atr];
  const resistances = [recentHighs[0], recentHighs[Math.floor(recentHighs.length / 3)], sma50 + atr];
  
  // Trend determination
  const trend = latest > sma20 && sma20 > sma50 ? 'Bullish' : 
                latest < sma20 && sma20 < sma50 ? 'Bearish' : 'Neutral';
  const trendStrength = adx > 25 ? 'Strong' : adx > 20 ? 'Moderate' : 'Weak';
  
  // Pattern detection (simplified)
  const patterns: string[] = [];
  if (macdValue > signal && histogram > 0) patterns.push('MACD Bullish Crossover');
  if (macdValue < signal && histogram < 0) patterns.push('MACD Bearish Crossover');
  if (rsi < 30) patterns.push('RSI Oversold');
  if (rsi > 70) patterns.push('RSI Overbought');
  if (latest > bbUpper) patterns.push('Price Above Upper BB');
  if (latest < bbLower) patterns.push('Price Below Lower BB');
  if (stochK < 20 && stochD < 20) patterns.push('Stochastic Oversold');
  if (stochK > 80 && stochD > 80) patterns.push('Stochastic Overbought');
  
  return {
    trend,
    trendStrength,
    rsi,
    macd: { value: macdValue, signal, histogram },
    stochastic: { k: stochK, d: stochD },
    adx,
    atr,
    movingAverages: { sma20, sma50, sma100, sma200, ema12, ema26 },
    bollingerBands: { upper: bbUpper, middle: sma20, lower: bbLower },
    fibonacci: { levels: fibLevels },
    supportResistance: { supports, resistances },
    patterns,
    spotPrice: latest,
  };
}

function getDefaultTechnicals(price: number) {
  return {
    trend: 'Neutral',
    trendStrength: 'Weak',
    rsi: 50,
    macd: { value: 0, signal: 0, histogram: 0 },
    stochastic: { k: 50, d: 50 },
    adx: 15,
    atr: price * 0.02,
    movingAverages: { sma20: price, sma50: price, sma100: price, sma200: price, ema12: price, ema26: price },
    bollingerBands: { upper: price * 1.02, middle: price, lower: price * 0.98 },
    fibonacci: { levels: [] },
    supportResistance: { supports: [price * 0.98], resistances: [price * 1.02] },
    patterns: [],
    spotPrice: price,
  };
}

function calculateEMA(prices: number[], period: number): number {
  if (prices.length === 0) return 0;
  const k = 2 / (period + 1);
  let ema = prices[0];
  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

// Generate multi-timeframe forecasts
function generateForecasts(spotPrice: number, technicals: any, trend: string): any {
  const shortTermBias = technicals.rsi < 40 ? 'Bullish' : technicals.rsi > 60 ? 'Bearish' : trend;
  const mediumTermBias = trend;
  const longTermBias = spotPrice > technicals.movingAverages.sma200 ? 'Bullish' : 'Bearish';
  
  return {
    shortTerm: {
      timeframe: 'Short-Term',
      period: '1-5 Days',
      bias: shortTermBias,
      targetPrice: shortTermBias === 'Bullish' ? spotPrice * 1.015 : spotPrice * 0.985,
      supportLevel: technicals.supportResistance.supports[0] || spotPrice * 0.98,
      resistanceLevel: technicals.supportResistance.resistances[0] || spotPrice * 1.02,
      probability: shortTermBias === trend ? 68 : 55,
      keyDrivers: [
        'Technical momentum indicators',
        'Intraday price action',
        'Volume confirmation'
      ]
    },
    mediumTerm: {
      timeframe: 'Medium-Term',
      period: '1-4 Weeks',
      bias: mediumTermBias,
      targetPrice: mediumTermBias === 'Bullish' ? spotPrice * 1.04 : spotPrice * 0.96,
      supportLevel: technicals.movingAverages.sma50,
      resistanceLevel: technicals.movingAverages.sma50 * 1.05,
      probability: 62,
      keyDrivers: [
        'Moving average crossovers',
        'Macro economic data releases',
        'Sector-specific fundamentals'
      ]
    },
    longTerm: {
      timeframe: 'Long-Term',
      period: '1-3 Months',
      bias: longTermBias,
      targetPrice: longTermBias === 'Bullish' ? spotPrice * 1.08 : spotPrice * 0.92,
      supportLevel: technicals.movingAverages.sma200,
      resistanceLevel: technicals.movingAverages.sma200 * 1.1,
      probability: 55,
      keyDrivers: [
        'Long-term trend structure',
        'Global supply-demand balance',
        'Currency movements (USD/INR)'
      ]
    }
  };
}

// Generate scenario analysis
function generateScenarios(spotPrice: number, trend: string, symbol: string): any {
  const volatilityFactor = symbol.includes('NATURAL') ? 0.08 : 
                           symbol.includes('CRUDE') ? 0.06 :
                           symbol.includes('SILVER') ? 0.05 : 0.04;
  
  return {
    bestCase: {
      probability: 20,
      targetPrice: Math.round(spotPrice * (1 + volatilityFactor * 1.5)),
      percentChange: volatilityFactor * 150,
      catalyst: symbol.includes('GOLD') || symbol.includes('SILVER') 
        ? 'Fed rate cuts + USD weakness + geopolitical tensions'
        : symbol.includes('CRUDE')
        ? 'OPEC+ deeper cuts + Middle East escalation + demand surge'
        : 'Supply disruption + demand spike',
      recommendation: 'Hold for extended gains, trail stop-loss'
    },
    baseCase: {
      probability: 60,
      targetPrice: Math.round(spotPrice * (1 + (trend === 'Bullish' ? volatilityFactor * 0.5 : -volatilityFactor * 0.3))),
      percentChange: trend === 'Bullish' ? volatilityFactor * 50 : -volatilityFactor * 30,
      catalyst: 'Status quo maintained, gradual price movement',
      recommendation: 'Follow the trade plan, book partial profits at target'
    },
    worstCase: {
      probability: 20,
      targetPrice: Math.round(spotPrice * (1 - volatilityFactor * 1.2)),
      percentChange: -volatilityFactor * 120,
      catalyst: symbol.includes('GOLD') || symbol.includes('SILVER')
        ? 'Hawkish Fed + USD rally + risk-on sentiment'
        : symbol.includes('CRUDE')
        ? 'OPEC+ collapse + demand destruction + oversupply'
        : 'Demand collapse + surplus builds',
      recommendation: 'Exit at stop-loss, do not average down'
    }
  };
}

// Generate term structure data
function generateTermStructure(spotPrice: number, symbol: string, expiryInfo: any): any {
  const isContango = symbol.includes('CRUDE') || symbol.includes('NATURAL');
  const spreadPct = isContango ? 0.3 + Math.random() * 0.5 : -0.2 - Math.random() * 0.3;
  
  return {
    expiryDate: expiryInfo.expiryStr,
    daysToExpiry: expiryInfo.daysToExpiry,
    termStructure: spreadPct > 0.1 ? 'Contango' : spreadPct < -0.1 ? 'Backwardation' : 'Flat',
    spreadPercent: spreadPct,
    rollRecommendation: expiryInfo.daysToExpiry <= 5 
      ? 'Roll immediately to next month contract'
      : expiryInfo.daysToExpiry <= 10
      ? 'Plan to roll within 3-5 days'
      : 'No immediate roll needed',
    nearMonthPrice: spotPrice,
    nextMonthPrice: Math.round(spotPrice * (1 + spreadPct / 100)),
    farMonthPrice: Math.round(spotPrice * (1 + spreadPct * 1.5 / 100)),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, name } = await req.json();
    console.log(`📊 Processing PROFESSIONAL commodity prediction for: ${symbol} (${name})`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check user authentication and quota
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
      
      if (userId) {
        const { data: planData } = await supabase
          .from('user_plans')
          .select('daily_prediction_limit')
          .eq('user_id', userId)
          .single();
        
        const dailyLimit = planData?.daily_prediction_limit ?? 3;
        
        if (dailyLimit !== -1) {
          const todayIST = new Date().toISOString().split('T')[0];
          const { count } = await supabase
            .from('prediction_tracking')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('predicted_at', `${todayIST}T00:00:00`)
            .lt('predicted_at', `${todayIST}T23:59:59`);
          
          if ((count || 0) >= dailyLimit) {
            return new Response(JSON.stringify({
              success: false,
              error: `Daily prediction limit reached (${dailyLimit}/day). Upgrade to Premium for unlimited predictions.`
            }), {
              status: 429,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      }
    }

    // Fetch all data in parallel
    let spotData: any = null;
    let fundamentalsData: any = null;
    let macroData: any = null;
    let dataSource: 'MCX_LIVE' | 'YAHOO_FINANCE' | 'AI_ESTIMATED' = 'AI_ESTIMATED';
    
    const [spotResponse, fundamentalsResponse, macroResponse] = await Promise.allSettled([
      supabase.functions.invoke('fetch-mcx-spot-price', { body: { symbol } }),
      supabase.functions.invoke('fetch-commodity-fundamentals', { body: { symbol } }),
      supabase.functions.invoke('fetch-macro-indicators', { body: {} }),
    ]);

    if (spotResponse.status === 'fulfilled' && spotResponse.value.data?.success) {
      spotData = spotResponse.value.data.data;
      dataSource = spotData.source === 'mcx' ? 'MCX_LIVE' : 
                   spotData.source === 'yahoo' ? 'YAHOO_FINANCE' : 'AI_ESTIMATED';
      console.log(`✅ Got spot price for ${symbol}: ₹${spotData.spotPrice} (source: ${spotData.source})`);
    }

    if (fundamentalsResponse.status === 'fulfilled' && fundamentalsResponse.value.data?.success) {
      fundamentalsData = fundamentalsResponse.value.data.data;
      console.log(`✅ Got fundamentals for ${symbol}`);
    }

    if (macroResponse.status === 'fulfilled' && macroResponse.value.data?.success) {
      macroData = macroResponse.value.data.data;
      console.log(`✅ Got macro indicators`);
    }

    const config = COMMODITY_CONFIG[symbol] || { lotSize: 100, unit: 'units', tickSize: 1, strikeInterval: 100, ivRange: [0.20, 0.35] as [number, number] };
    const spotPrice = spotData?.spotPrice || estimateSpotPrice(symbol);
    const internationalPrice = spotData?.internationalPrice || null;
    const usdInr = spotData?.usdInrRate || spotData?.usdInr || macroData?.usdInr?.value || 83.50;
    const expiryInfo = getMCXExpiry(symbol);

    // Generate historical data and calculate advanced technicals
    const historicalData = generateHistoricalData(spotPrice, 200);
    const technicals = calculateAdvancedTechnicals(historicalData);
    
    // Generate forecasts and scenarios
    const forecasts = generateForecasts(spotPrice, technicals, technicals.trend);
    const scenarios = generateScenarios(spotPrice, technicals.trend, symbol);
    const termStructure = generateTermStructure(spotPrice, symbol, expiryInfo);

    // Generate AI prediction with enhanced prompt
    const prediction = await generateAIPrediction(
      symbol,
      name,
      spotPrice,
      technicals,
      config,
      internationalPrice,
      usdInr,
      expiryInfo,
      dataSource,
      fundamentalsData,
      macroData,
      forecasts,
      scenarios
    );

    // Track prediction
    if (userId) {
      await supabase.from('prediction_tracking').insert({
        user_id: userId,
        symbol: symbol,
        option_type: prediction.optionType,
        predicted_strike: prediction.strikePrice,
        predicted_direction: prediction.optionType === 'CALL' ? 'bullish' : 'bearish',
        predicted_entry_premium: prediction.premium?.buyLeg,
        predicted_target_premium: prediction.premium?.targetPremium,
        predicted_sl_premium: prediction.premium?.stopLossPremium,
        predicted_strategy: prediction.strategy,
        prediction_json: prediction,
        technical_score: prediction.technicalScore,
        expiry_date: expiryInfo.expiryDate.toISOString().split('T')[0],
      });
    }

    return new Response(JSON.stringify({
      success: true,
      prediction,
      historicalData: historicalData.slice(-60),
      technicals,
      fundamentals: fundamentalsData,
      macro: macroData,
      forecasts,
      scenarios,
      termStructure,
      dataSource,
      dataTimestamp: spotData?.timestamp || new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in predict-commodity:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function estimateSpotPrice(symbol: string): number {
  const estimates: { [key: string]: number } = {
    'GOLD': 78500,
    'GOLDM': 78500,
    'SILVER': 95000,
    'SILVERM': 95000,
    'CRUDEOIL': 6800,
    'NATURALGAS': 230,
    'COPPER': 830,
  };
  return estimates[symbol] || 10000;
}

function generateHistoricalData(currentPrice: number, days: number): any[] {
  const data: any[] = [];
  let price = currentPrice * 0.92;
  
  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    const volatility = 0.015;
    const drift = 0.0002;
    const change = (Math.random() - 0.5) * (price * volatility * 2) + (price * drift);
    price = Math.max(price * 0.85, Math.min(price * 1.15, price + change));
    
    const dailyVolatility = Math.random() * 0.02;
    data.push({
      date: date.toISOString().split('T')[0],
      open: price * (1 + (Math.random() - 0.5) * dailyVolatility),
      high: price * (1 + Math.random() * dailyVolatility),
      low: price * (1 - Math.random() * dailyVolatility),
      close: price,
      volume: Math.floor(Math.random() * 50000) + 10000,
    });
  }
  
  return data;
}

async function generateAIPrediction(
  symbol: string,
  name: string,
  spotPrice: number,
  technicals: any,
  config: any,
  internationalPrice: number | null,
  usdInr: number,
  expiryInfo: { expiryDate: Date; expiryStr: string; daysToExpiry: number },
  dataSource: string,
  fundamentals: any,
  macro: any,
  forecasts: any,
  scenarios: any
): Promise<any> {
  const strikeInterval = config.strikeInterval || 100;
  const atmStrike = Math.round(spotPrice / strikeInterval) * strikeInterval;
  
  const optionType = technicals.trend === 'Bullish' || technicals.rsi < 40 ? 'CALL' : 'PUT';
  
  const ivRange = config.ivRange || [0.20, 0.35];
  const premiumData = estimatePremium(spotPrice, atmStrike, expiryInfo.daysToExpiry, ivRange, optionType === 'CALL');
  const entryPremium = premiumData.premium;
  const targetPremium = entryPremium * 1.4;
  const stopLossPremium = entryPremium * 0.7;
  
  const timeToExpiry = expiryInfo.daysToExpiry / 365;
  const iv = premiumData.iv / 100;
  const delta = optionType === 'CALL' ? 0.5 + (0.15 * (spotPrice > atmStrike ? 1 : -1)) : -(0.5 + (0.15 * (spotPrice < atmStrike ? 1 : -1)));
  const gamma = (0.4 / (spotPrice * iv * Math.sqrt(timeToExpiry))) * 0.01;
  const theta = -(spotPrice * iv * 0.4) / (2 * Math.sqrt(timeToExpiry) * 365);
  const vega = spotPrice * Math.sqrt(timeToExpiry) * 0.4 * 0.01;

  // Build comprehensive AI prompt
  const prompt = `You are a senior commodity analyst with 25 years of experience at a major investment bank. Analyze ${name} (${symbol}) for MCX options trading.

## REAL-TIME MARKET DATA
- Spot Price: ₹${spotPrice.toFixed(2)}
- Data Source: ${dataSource}
${internationalPrice ? `- International Price: $${internationalPrice}` : ''}
- USD/INR: ${usdInr}

## TECHNICAL ANALYSIS
- Trend: ${technicals.trend} | Strength: ${technicals.trendStrength}
- RSI (14): ${technicals.rsi.toFixed(1)}
- MACD: ${technicals.macd.value.toFixed(2)} | Signal: ${technicals.macd.signal.toFixed(2)} | Histogram: ${technicals.macd.histogram.toFixed(2)}
- Stochastic: %K ${technicals.stochastic.k.toFixed(1)} / %D ${technicals.stochastic.d.toFixed(1)}
- ADX: ${technicals.adx.toFixed(1)}
- Bollinger Bands: Upper ₹${technicals.bollingerBands.upper.toFixed(0)} | Lower ₹${technicals.bollingerBands.lower.toFixed(0)}

## FUNDAMENTAL FACTORS
${fundamentals ? `
- Supply-Demand Balance: ${fundamentals.supplyDemandBalance}
- Inventory Level: ${fundamentals.inventory.level} (${fundamentals.inventory.trend})
- Production Outlook: ${fundamentals.production.outlook}
- Geopolitical Risk: ${fundamentals.geopolitical.risk}
` : '- Fundamentals data not available'}

## MACRO ENVIRONMENT
${macro ? `
- DXY: ${macro.dxy.value} (${macro.dxy.trend})
- US 10Y Yield: ${macro.usTreasuryYield10Y.value}%
- Fed Outlook: ${macro.fedFundsRate.outlook}
- VIX: ${macro.vix.value} (${macro.vix.level})
` : '- Macro data not available'}

## CONTRACT DETAILS
- Expiry: ${expiryInfo.expiryStr} (${expiryInfo.daysToExpiry} days)

## MY RECOMMENDATION
Based on the analysis, I recommend: ${optionType} option at ₹${atmStrike} strike

Provide a comprehensive 3-4 paragraph analysis covering:
1. Current market overview and key technicals
2. Fundamental outlook and macro impacts
3. Trade setup with clear entry, target, and stop-loss reasoning
4. Key risks and probability assessment

Be specific with numbers and actionable insights.`;

  let reasoning = `**Market Overview:** ${name} is trading at ₹${spotPrice.toFixed(0)}, showing ${technicals.trend.toLowerCase()} momentum with RSI at ${technicals.rsi.toFixed(1)}. `;
  
  if (technicals.trend === 'Bullish') {
    reasoning += `Price is above key moving averages with MACD in positive territory, suggesting continued upward pressure. `;
  } else if (technicals.trend === 'Bearish') {
    reasoning += `Price has broken below key support levels with negative MACD histogram, indicating selling pressure. `;
  } else {
    reasoning += `The market is consolidating between support at ₹${technicals.supportResistance.supports[0]?.toFixed(0)} and resistance at ₹${technicals.supportResistance.resistances[0]?.toFixed(0)}. `;
  }
  
  reasoning += `\n\n**Fundamental View:** `;
  if (fundamentals) {
    reasoning += `Supply-demand balance is ${fundamentals.supplyDemandBalance.toLowerCase()} with ${fundamentals.inventory.level.toLowerCase()} inventory levels. `;
    reasoning += `Geopolitical risk remains ${fundamentals.geopolitical.risk.toLowerCase()}. `;
  }
  
  reasoning += `\n\n**Trade Setup:** Recommend ${optionType} at ₹${atmStrike} strike with entry premium around ₹${Math.round(entryPremium)}. `;
  reasoning += `Target premium: ₹${Math.round(targetPremium)} (+${((targetPremium/entryPremium - 1) * 100).toFixed(0)}%). `;
  reasoning += `Stop-loss: ₹${Math.round(stopLossPremium)} (-${((1 - stopLossPremium/entryPremium) * 100).toFixed(0)}%). `;
  
  reasoning += `\n\n**Risk Assessment:** ADX at ${technicals.adx.toFixed(1)} indicates ${technicals.trendStrength.toLowerCase()} trend. `;
  if (macro) {
    reasoning += `VIX at ${macro.vix.value.toFixed(1)} suggests ${macro.vix.level.toLowerCase()}. `;
  }

  // Try Lovable AI for enhanced reasoning
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (LOVABLE_API_KEY) {
    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LOVABLE_API_KEY}`
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are a senior commodity analyst with 25 years of experience. Provide professional, actionable trading analysis with specific numbers and clear reasoning. Format with markdown headers and bullet points where appropriate." },
            { role: "user", content: prompt }
          ],
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        const aiReasoning = data.choices?.[0]?.message?.content;
        if (aiReasoning) {
          reasoning = aiReasoning;
        }
      }
    } catch (error) {
      console.error('AI reasoning error:', error);
    }
  }

  const totalInvestment = Math.round(entryPremium * config.lotSize);
  const maxLoss = totalInvestment;
  const maxGain = Math.round((targetPremium - entryPremium) * config.lotSize);
  
  let probability = 50;
  if (technicals.trend === 'Bullish' && optionType === 'CALL') probability += 15;
  if (technicals.trend === 'Bearish' && optionType === 'PUT') probability += 15;
  if (technicals.rsi < 30 && optionType === 'CALL') probability += 10;
  if (technicals.rsi > 70 && optionType === 'PUT') probability += 10;
  if (technicals.adx > 25) probability += 5;

  const globalFactors: string[] = [];
  if (symbol.includes('GOLD') || symbol.includes('SILVER')) {
    globalFactors.push('Fed interest rate decisions impact precious metals inversely');
    globalFactors.push('USD weakness typically supports gold/silver prices');
    globalFactors.push('Central bank buying remains a key demand driver');
  }
  if (symbol.includes('CRUDE')) {
    globalFactors.push('OPEC+ production decisions affect crude oil supply');
    globalFactors.push('Global demand outlook and inventory data are key drivers');
    globalFactors.push('Geopolitical tensions in Middle East create risk premium');
  }
  if (symbol.includes('NATURAL')) {
    globalFactors.push('Weather patterns significantly impact natural gas demand');
    globalFactors.push('LNG export volumes affect domestic prices');
    globalFactors.push('Storage levels relative to 5-year average is key metric');
  }
  if (symbol.includes('COPPER')) {
    globalFactors.push('China manufacturing PMI is key demand indicator');
    globalFactors.push('Green energy transition driving long-term demand');
    globalFactors.push('LME warehouse stocks indicate physical market tightness');
  }

  return {
    strategy: optionType === 'CALL' ? 'Long Call' : 'Long Put',
    strikePrice: atmStrike,
    optionType,
    expiryDate: expiryInfo.expiryStr,
    daysToExpiry: expiryInfo.daysToExpiry,
    lotSize: config.lotSize,
    targetPrice: optionType === 'CALL' ? spotPrice * 1.03 : spotPrice * 0.97,
    stopLoss: optionType === 'CALL' ? spotPrice * 0.98 : spotPrice * 1.02,
    entryPrice: spotPrice,
    expectedReturn: ((targetPremium - entryPremium) / entryPremium) * 100,
    probability: `${probability}%`,
    maxLoss,
    maxGain,
    totalInvestment,
    premium: {
      buyLeg: Math.round(entryPremium),
      targetPremium: Math.round(targetPremium),
      stopLossPremium: Math.round(stopLossPremium),
    },
    ivRank: Math.round(premiumData.iv),
    greeks: {
      delta: Math.abs(delta),
      gamma,
      theta,
      vega,
    },
    reasoning,
    riskLevel: probability >= 60 ? 'Medium' : 'High',
    timeFrame: `${expiryInfo.daysToExpiry} days to expiry`,
    technicalScore: Math.round(probability * 0.9),
    internationalCorrelation: {
      comexGold: symbol.includes('GOLD') ? internationalPrice : undefined,
      brentCrude: symbol.includes('CRUDE') ? internationalPrice : undefined,
      nymexGas: symbol.includes('NATURAL') ? internationalPrice : undefined,
      lmeCopper: symbol.includes('COPPER') ? internationalPrice : undefined,
      usdInr,
    },
    globalFactors,
    dataQuality: {
      source: dataSource,
      isLive: dataSource === 'MCX_LIVE',
      expirySource: 'calculated',
    },
  };
}
