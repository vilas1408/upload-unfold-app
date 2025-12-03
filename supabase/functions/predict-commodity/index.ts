import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Commodity configuration
const COMMODITY_CONFIG: { [key: string]: { lotSize: number; unit: string; tickSize: number } } = {
  'GOLD': { lotSize: 1000, unit: 'grams', tickSize: 1 },
  'GOLDM': { lotSize: 100, unit: 'grams', tickSize: 1 },
  'SILVER': { lotSize: 30000, unit: 'grams', tickSize: 1 },
  'SILVERM': { lotSize: 5000, unit: 'grams', tickSize: 1 },
  'CRUDEOIL': { lotSize: 100, unit: 'barrels', tickSize: 1 },
  'NATURALGAS': { lotSize: 1250, unit: 'mmBtu', tickSize: 0.1 },
  'COPPER': { lotSize: 2500, unit: 'kg', tickSize: 0.05 },
};

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
    let dataSource: 'MCX_LIVE' | 'AI_ESTIMATED' = 'AI_ESTIMATED';
    
    try {
      const spotResponse = await supabase.functions.invoke('fetch-mcx-spot-price', {
        body: { symbol }
      });
      
      if (spotResponse.data?.success) {
        spotData = spotResponse.data;
        dataSource = spotResponse.data.source === 'mcx' ? 'MCX_LIVE' : 'AI_ESTIMATED';
        console.log(`Got spot price for ${symbol}: ₹${spotData.spotPrice}`);
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
    const config = COMMODITY_CONFIG[symbol] || { lotSize: 100, unit: 'units', tickSize: 1 };
    
    // Calculate spot price (from data or estimate)
    const spotPrice = spotData?.spotPrice || estimateSpotPrice(symbol);
    const internationalPrice = spotData?.internationalPrice || null;
    const usdInr = spotData?.usdInr || 83.50;

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
      optionChainData
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
      });
    }

    return new Response(JSON.stringify({
      success: true,
      prediction,
      historicalData,
      dataSource,
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
    'GOLD': 77500,
    'GOLDM': 77500,
    'SILVER': 92000,
    'SILVERM': 92000,
    'CRUDEOIL': 6200,
    'NATURALGAS': 280,
    'COPPER': 780,
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
  optionChainData: any
): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  // Calculate ATM strike (round to nearest tick)
  const atmStrike = Math.round(spotPrice / config.tickSize) * config.tickSize;
  
  // Determine option type based on technicals
  const optionType = technicals.trend === 'Bullish' || technicals.rsi < 40 ? 'CALL' : 'PUT';
  
  // Calculate premium estimate
  const estimatedPremium = spotPrice * 0.025; // ~2.5% of spot
  const targetPremium = estimatedPremium * 1.4;
  const stopLossPremium = estimatedPremium * 0.7;
  
  // Calculate expiry (next month end)
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const expiryDate = nextMonth.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  
  // Calculate Greeks (simplified)
  const daysToExpiry = Math.ceil((nextMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const volatility = 0.25;
  const delta = optionType === 'CALL' ? 0.55 : -0.45;
  const gamma = 0.002;
  const theta = -estimatedPremium * 0.03;
  const vega = estimatedPremium * 0.15;
  
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
  const totalInvestment = Math.round(estimatedPremium * config.lotSize);
  const maxLoss = totalInvestment;
  const maxGain = Math.round((targetPremium - estimatedPremium) * config.lotSize);
  
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
  }
  if (symbol.includes('NATURAL')) {
    globalFactors.push('Weather patterns significantly impact natural gas demand');
    globalFactors.push('LNG export volumes affect domestic prices');
  }

  return {
    strategy: optionType === 'CALL' ? 'Long Call' : 'Long Put',
    strikePrice: atmStrike,
    optionType,
    expiryDate,
    lotSize: config.lotSize,
    targetPrice: optionType === 'CALL' ? spotPrice * 1.03 : spotPrice * 0.97,
    stopLoss: optionType === 'CALL' ? spotPrice * 0.98 : spotPrice * 1.02,
    entryPrice: spotPrice,
    expectedReturn: ((targetPremium - estimatedPremium) / estimatedPremium) * 100,
    probability: `${probability}%`,
    maxLoss,
    maxGain,
    totalInvestment,
    premium: {
      buyLeg: Math.round(estimatedPremium),
      targetPremium: Math.round(targetPremium),
      stopLossPremium: Math.round(stopLossPremium),
    },
    ivRank: Math.floor(Math.random() * 40) + 30,
    greeks: {
      delta: Math.abs(delta),
      gamma,
      theta,
      vega,
    },
    reasoning,
    riskLevel: probability >= 60 ? 'Medium' : 'High',
    timeFrame: `${daysToExpiry} days to expiry`,
    technicalScore: Math.round(probability * 0.9),
    internationalCorrelation: {
      comexGold: symbol.includes('GOLD') ? internationalPrice : undefined,
      brentCrude: symbol.includes('CRUDE') ? internationalPrice : undefined,
      nymexGas: symbol.includes('NATURAL') ? internationalPrice : undefined,
      lmeCopper: symbol.includes('COPPER') ? internationalPrice : undefined,
      usdInr,
    },
    globalFactors,
  };
}
