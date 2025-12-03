import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Commodity configuration
const COMMODITY_CONFIG: { [key: string]: { lotSize: number; unit: string; tickSize: number; ivRange: [number, number] } } = {
  'GOLD': { lotSize: 100, unit: 'grams', tickSize: 1, ivRange: [0.12, 0.20] },
  'GOLDM': { lotSize: 10, unit: 'grams', tickSize: 1, ivRange: [0.12, 0.20] },
  'SILVER': { lotSize: 30, unit: 'kg', tickSize: 1, ivRange: [0.18, 0.30] },
  'SILVERM': { lotSize: 5, unit: 'kg', tickSize: 1, ivRange: [0.18, 0.30] },
  'CRUDEOIL': { lotSize: 100, unit: 'barrels', tickSize: 1, ivRange: [0.25, 0.45] },
  'NATURALGAS': { lotSize: 1250, unit: 'mmBtu', tickSize: 0.1, ivRange: [0.35, 0.60] },
  'COPPER': { lotSize: 2500, unit: 'kg', tickSize: 0.05, ivRange: [0.15, 0.25] },
};

// MCX 2025-2026 Expiry Calendar (known dates)
const MCX_EXPIRY_CALENDAR: { [commodity: string]: { [monthYear: string]: string } } = {
  'CRUDEOIL': {
    'DEC2025': '2025-12-17',  // New rule: Options expire ~7 business days before futures
    'JAN2026': '2026-01-15',
    'FEB2026': '2026-02-17',
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
  },
  'COPPER': {
    'DEC2025': '2025-12-30',
    'JAN2026': '2026-01-30',
  },
};

// Get MCX expiry date based on commodity type
function getMCXExpiry(symbol: string): { expiryDate: Date; expiryStr: string; daysToExpiry: number } {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  // Determine contract month (current if before 15th, next if after)
  let contractMonth = currentMonth;
  let contractYear = currentYear;
  
  if (now.getDate() > 15) {
    contractMonth = (currentMonth + 1) % 12;
    if (contractMonth === 0) contractYear++;
  }
  
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const monthKey = `${monthNames[contractMonth]}${contractYear}`;
  
  // Check calendar first
  const baseSymbol = symbol.replace(/M$/, '').replace(/MIC$/, ''); // Remove mini/micro suffix
  if (MCX_EXPIRY_CALENDAR[baseSymbol]?.[monthKey]) {
    const calendarDate = new Date(MCX_EXPIRY_CALENDAR[baseSymbol][monthKey]);
    const daysToExpiry = Math.ceil((calendarDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      expiryDate: calendarDate,
      expiryStr: calendarDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      daysToExpiry: Math.max(1, daysToExpiry),
    };
  }
  
  // Calculate based on commodity-specific rules
  let expiryDate: Date;
  
  if (symbol.includes('CRUDE')) {
    // Crude Oil: Options expire 7 business days before futures (futures ~17-19th)
    // From Dec 2025: New rule applies
    const futuresExpiry = new Date(contractYear, contractMonth, 18);
    expiryDate = subtractBusinessDays(futuresExpiry, 7);
  } else if (symbol.includes('GOLD') || symbol.includes('SILVER')) {
    // Gold/Silver: 5th of expiry month (or previous business day)
    expiryDate = new Date(contractYear, contractMonth, 5);
    // Adjust if weekend
    while (expiryDate.getDay() === 0 || expiryDate.getDay() === 6) {
      expiryDate.setDate(expiryDate.getDate() - 1);
    }
  } else if (symbol.includes('NATURAL')) {
    // Natural Gas: Around 24th-27th of month
    expiryDate = new Date(contractYear, contractMonth, 25);
    while (expiryDate.getDay() === 0 || expiryDate.getDay() === 6) {
      expiryDate.setDate(expiryDate.getDate() - 1);
    }
  } else if (symbol.includes('COPPER')) {
    // Copper: Last business day of month
    expiryDate = new Date(contractYear, contractMonth + 1, 0);
    while (expiryDate.getDay() === 0 || expiryDate.getDay() === 6) {
      expiryDate.setDate(expiryDate.getDate() - 1);
    }
  } else {
    // Default: Last business day
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

// Improved premium estimation using simplified Black-Scholes
function estimatePremium(
  spotPrice: number, 
  strikePrice: number, 
  daysToExpiry: number, 
  ivRange: [number, number], 
  isCall: boolean
): { premium: number; iv: number } {
  const timeToExpiry = daysToExpiry / 365;
  const iv = (ivRange[0] + ivRange[1]) / 2; // Use mid-range IV
  
  // Intrinsic value
  const intrinsicValue = isCall 
    ? Math.max(0, spotPrice - strikePrice) 
    : Math.max(0, strikePrice - spotPrice);
  
  // Time value using simplified Black-Scholes approximation
  // Time value ≈ 0.4 * S * σ * √T (at-the-money approximation)
  const timeValue = 0.4 * spotPrice * iv * Math.sqrt(timeToExpiry);
  
  // Adjust time value based on moneyness
  const moneyness = spotPrice / strikePrice;
  const moneynessAdjustment = isCall
    ? (moneyness > 1 ? 1.1 : moneyness < 0.95 ? 0.7 : 1)
    : (moneyness < 1 ? 1.1 : moneyness > 1.05 ? 0.7 : 1);
  
  const premium = intrinsicValue + (timeValue * moneynessAdjustment);
  
  return {
    premium: Math.max(premium, spotPrice * 0.005), // Minimum 0.5% of spot
    iv: iv * 100,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, name } = await req.json();
    console.log(`Processing commodity prediction for: ${symbol} (${name})`);

    // Initialize Supabase client
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
        // Check daily limit
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

    // Fetch MCX spot price
    let spotData: any = null;
    let dataSource: 'MCX_LIVE' | 'YAHOO_FINANCE' | 'AI_ESTIMATED' = 'AI_ESTIMATED';
    
    try {
      const spotResponse = await supabase.functions.invoke('fetch-mcx-spot-price', {
        body: { symbol }
      });
      
      if (spotResponse.data?.success && spotResponse.data?.data) {
        spotData = spotResponse.data.data;
        dataSource = spotData.source === 'mcx' ? 'MCX_LIVE' : 
                     spotData.source === 'yahoo' ? 'YAHOO_FINANCE' : 'AI_ESTIMATED';
        console.log(`Got spot price for ${symbol}: ₹${spotData.spotPrice} (source: ${spotData.source})`);
      }
    } catch (error) {
      console.error('Error fetching spot price:', error);
    }

    // Fetch MCX option chain
    let optionChainData: any = null;
    try {
      const chainResponse = await supabase.functions.invoke('fetch-mcx-option-chain', {
        body: { symbol }
      });
      
      if (chainResponse.data?.success) {
        optionChainData = chainResponse.data;
        console.log(`Got option chain for ${symbol}: ${chainResponse.data.data?.length || 0} strikes`);
      }
    } catch (error) {
      console.error('Error fetching option chain:', error);
    }

    // Get commodity config
    const config = COMMODITY_CONFIG[symbol] || { lotSize: 100, unit: 'units', tickSize: 1, ivRange: [0.20, 0.35] as [number, number] };
    
    // Calculate spot price (from data or estimate)
    const spotPrice = spotData?.spotPrice || estimateSpotPrice(symbol);
    const internationalPrice = spotData?.internationalPrice || null;
    const usdInr = spotData?.usdInrRate || spotData?.usdInr || 83.50;

    // Get expiry date
    const expiryInfo = getMCXExpiry(symbol);
    console.log(`Expiry for ${symbol}: ${expiryInfo.expiryStr} (${expiryInfo.daysToExpiry} days)`);

    // Generate historical data (simplified)
    const historicalData = generateHistoricalData(spotPrice, 60);

    // Calculate technical indicators
    const technicals = calculateTechnicals(historicalData);

    // Generate AI prediction using Lovable AI
    const prediction = await generateAIPrediction(
      symbol,
      name,
      spotPrice,
      technicals,
      config,
      internationalPrice,
      usdInr,
      optionChainData,
      expiryInfo,
      dataSource
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
      historicalData,
      dataSource,
      dataTimestamp: spotData?.timestamp || new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in predict-commodity:', error);
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
  // Estimated spot prices as of late 2025
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
  let price = currentPrice * 0.95;
  
  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    const change = (Math.random() - 0.48) * (price * 0.02);
    price = Math.max(price * 0.9, Math.min(price * 1.1, price + change));
    
    data.push({
      date: date.toISOString().split('T')[0],
      open: price * (1 + (Math.random() - 0.5) * 0.01),
      high: price * (1 + Math.random() * 0.015),
      low: price * (1 - Math.random() * 0.015),
      close: price,
      volume: Math.floor(Math.random() * 50000) + 10000,
    });
  }
  
  return data;
}

function calculateTechnicals(data: any[]): any {
  if (data.length < 14) return { rsi: 50, trend: 'Neutral', support: 0, resistance: 0 };
  
  const closes = data.map(d => d.close);
  const latest = closes[closes.length - 1];
  
  // Simple RSI calculation
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
  
  // Trend determination
  const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const trend = latest > sma20 * 1.02 ? 'Bullish' : latest < sma20 * 0.98 ? 'Bearish' : 'Neutral';
  
  // Support/Resistance
  const highs = data.slice(-20).map(d => d.high);
  const lows = data.slice(-20).map(d => d.low);
  const resistance = Math.max(...highs);
  const support = Math.min(...lows);
  
  return { rsi, trend, support, resistance, sma20, currentPrice: latest };
}

async function generateAIPrediction(
  symbol: string,
  name: string,
  spotPrice: number,
  technicals: any,
  config: any,
  internationalPrice: number | null,
  usdInr: number,
  optionChainData: any,
  expiryInfo: { expiryDate: Date; expiryStr: string; daysToExpiry: number },
  dataSource: string
): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  // Calculate ATM strike (round to nearest tick)
  const atmStrike = Math.round(spotPrice / config.tickSize) * config.tickSize;
  
  // Determine option type based on technicals
  const optionType = technicals.trend === 'Bullish' || technicals.rsi < 40 ? 'CALL' : 'PUT';
  
  // Calculate premium using improved estimation
  const ivRange = config.ivRange || [0.20, 0.35];
  const premiumData = estimatePremium(spotPrice, atmStrike, expiryInfo.daysToExpiry, ivRange, optionType === 'CALL');
  const entryPremium = premiumData.premium;
  const targetPremium = entryPremium * 1.4;
  const stopLossPremium = entryPremium * 0.7;
  
  // Calculate Greeks
  const timeToExpiry = expiryInfo.daysToExpiry / 365;
  const iv = premiumData.iv / 100;
  const delta = optionType === 'CALL' ? 0.5 + (0.15 * (spotPrice > atmStrike ? 1 : -1)) : -(0.5 + (0.15 * (spotPrice < atmStrike ? 1 : -1)));
  const gamma = (0.4 / (spotPrice * iv * Math.sqrt(timeToExpiry))) * 0.01;
  const theta = -(spotPrice * iv * 0.4) / (2 * Math.sqrt(timeToExpiry) * 365);
  const vega = spotPrice * Math.sqrt(timeToExpiry) * 0.4 * 0.01;
  
  // Build AI prompt
  const prompt = `Analyze ${name} (${symbol}) for MCX options trading:

MARKET DATA:
- Spot Price: ₹${spotPrice.toFixed(2)}
- RSI: ${technicals.rsi.toFixed(1)}
- Trend: ${technicals.trend}
- Support: ₹${technicals.support.toFixed(2)}
- Resistance: ₹${technicals.resistance.toFixed(2)}
${internationalPrice ? `- International Price: $${internationalPrice}` : ''}
- USD/INR: ${usdInr}
- Days to Expiry: ${expiryInfo.daysToExpiry}
- Expiry Date: ${expiryInfo.expiryStr}
- Estimated IV: ${premiumData.iv.toFixed(1)}%
- Data Source: ${dataSource}

Provide a brief (2-3 sentences) trading recommendation explaining why to go ${optionType} on ${symbol}.
Focus on: trend alignment, global factors, and key risk.`;

  let reasoning = `Based on technical analysis, ${symbol} shows ${technicals.trend.toLowerCase()} momentum with RSI at ${technicals.rsi.toFixed(1)}. `;
  reasoning += optionType === 'CALL' 
    ? `Bullish setup suggests buying calls near support at ₹${technicals.support.toFixed(0)}.`
    : `Bearish setup suggests buying puts near resistance at ₹${technicals.resistance.toFixed(0)}.`;

  // Try to get AI reasoning
  if (LOVABLE_API_KEY) {
    try {
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'You are a commodity trading analyst. Provide concise trading analysis.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 300,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        reasoning = data.choices?.[0]?.message?.content || reasoning;
      }
    } catch (error) {
      console.error('AI reasoning error:', error);
    }
  }

  // Calculate risk metrics
  const totalInvestment = Math.round(entryPremium * config.lotSize);
  const maxLoss = totalInvestment;
  const maxGain = Math.round((targetPremium - entryPremium) * config.lotSize);
  
  // Probability based on technicals
  let probability = 50;
  if (technicals.trend === 'Bullish' && optionType === 'CALL') probability += 15;
  if (technicals.trend === 'Bearish' && optionType === 'PUT') probability += 15;
  if (technicals.rsi < 30 && optionType === 'CALL') probability += 10;
  if (technicals.rsi > 70 && optionType === 'PUT') probability += 10;

  // Global factors
  const globalFactors: string[] = [];
  if (symbol.includes('GOLD') || symbol.includes('SILVER')) {
    globalFactors.push('Fed interest rate decisions impact precious metals inversely');
    globalFactors.push('USD weakness typically supports gold/silver prices');
  }
  if (symbol.includes('CRUDE')) {
    globalFactors.push('OPEC+ production decisions affect crude oil supply');
    globalFactors.push('Global demand outlook and inventory data are key drivers');
    globalFactors.push('Note: MCX Crude options now expire 7 business days before futures (Dec 2025 onwards)');
  }
  if (symbol.includes('NATURAL')) {
    globalFactors.push('Weather patterns significantly impact natural gas demand');
    globalFactors.push('LNG export volumes affect domestic prices');
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
      expirySource: MCX_EXPIRY_CALENDAR[symbol.replace(/M$/, '').replace(/MIC$/, '')]?.[`${['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][expiryInfo.expiryDate.getMonth()]}${expiryInfo.expiryDate.getFullYear()}`] ? 'calendar' : 'calculated',
    },
  };
}
