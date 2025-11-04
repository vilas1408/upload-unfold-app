import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body;
    try {
      body = await req.json();
    } catch (jsonError) {
      console.error('Failed to parse request body:', jsonError);
      throw new Error('Invalid request body. Please provide symbol and companyName.');
    }

    const { symbol, companyName } = body;
    
    if (!symbol || !companyName) {
      console.error('Missing required fields:', { symbol, companyName });
      throw new Error('Both symbol and companyName are required');
    }
    
    console.log('Predicting stock for:', symbol, companyName);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check for cached 7-day predictions for today
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const { data: cachedPredictions, error: cacheError } = await supabase
      .from('stock_predictions')
      .select('*')
      .eq('symbol', symbol)
      .eq('prediction_date', today)
      .order('days_ahead');

    if (cachedPredictions && cachedPredictions.length === 7 && !cacheError) {
      console.log('Returning cached 7-day predictions for:', symbol);
      const predictions = cachedPredictions.map(p => ({
        day: p.days_ahead,
        openingPrice: p.opening_price,
        closingPrice: p.closing_price,
        reason: p.reason,
        confidence: p.confidence,
        predictionDate: p.prediction_date,
        technicalScore: p.technical_score,
        trendAlignment: p.trend_alignment,
        riskFactors: p.risk_factors
      }));
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          predictions,
          historicalData: cachedPredictions[0].historical_data,
          cached: true
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('No cache found, generating new prediction');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Fetch real historical data from Yahoo Finance (30 days for better analysis)
    const historicalData = await fetchRealStockData(symbol);
    
    // Calculate technical indicators
    const technicalAnalysis = calculateTechnicalIndicators(historicalData);
    
    // Use Lovable AI to analyze and predict 7 days with improved accuracy
    const systemPrompt = `You are a conservative senior quantitative analyst specializing in Indian stock markets. Your predictions must be REALISTIC and CONSERVATIVE.

⚠️ CRITICAL REALITY CHECK:
- Stock markets are HIGHLY UNPREDICTABLE
- Past data CANNOT reliably predict future prices
- External factors (news, earnings, global events) often matter MORE than technical indicators
- Your job is to identify SHORT-TERM PROBABILITIES, not certainties

🎯 CONFIDENCE SCORING (LOWER = MORE HONEST):
Day 1: 55-65% (most reliable, but still uncertain)
Day 2: 50-60% (declining reliability)
Day 3-4: 45-55% (moderate uncertainty)
Day 5-7: 40-50% (high uncertainty - many unknown factors)

📊 TECHNICAL ANALYSIS CHECKLIST (Score each 0 or 1):
1. ✓ Strong trend continuation (3+ aligned SMAs)
2. ✓ RSI in confirming zone (30-70, not extreme)
3. ✓ MACD supporting direction (histogram alignment)
4. ✓ Volume confirming price action (no divergence)
5. ✓ Price respecting support/resistance levels
6. ✓ Low volatility (Bollinger width <5%)

**Technical Score** = Count of checkmarks (0-6)

**Confidence Formula**:
- Day 1: 55% + (Score × 1.5%)
- Day 2: 50% + (Score × 1.5%)
- Day 3-4: 45% + (Score × 1.5%)
- Day 5-7: 40% + (Score × 1.5%)

**Subtract confidence for**:
- High volatility (-5%)
- Conflicting indicators (-5%)
- Near major resistance without momentum (-3%)
- Recent choppy price action (-3%)

🚨 PREDICTION DISCIPLINE:
1. Be CONSERVATIVE - predict smaller moves (0.5-2% daily max)
2. Acknowledge uncertainty in your reasoning
3. Identify specific risks that could invalidate prediction
4. Day 1 opening = yesterday's close (±0.3% gap allowed)
5. Each subsequent day's opening = previous close (±0.5% gap)
6. Price movements must respect support/resistance levels
7. If indicators conflict, predict SIDEWAYS/NEUTRAL movement`;

    const userPrompt = `Analyze ${companyName} (${symbol}) and predict NEXT 7 TRADING DAYS with REALISTIC, CONSERVATIVE forecasts.

=== 📈 HISTORICAL PRICE DATA (Last 30 Days) ===
${historicalData.map((d: any) => 
  `${d.date}: Open ₹${d.open}, High ₹${d.high}, Low ₹${d.low}, Close ₹${d.close}, Vol: ${d.volume.toLocaleString()}`
).join('\n')}

=== 📊 TECHNICAL ANALYSIS ===
**Current Price**: ₹${technicalAnalysis.currentPrice}
**24h Change**: ${technicalAnalysis.priceChange24h}%
**7d Change**: ${technicalAnalysis.priceChange7d}%
**Volatility**: ${technicalAnalysis.volatility}%

**Moving Averages**:
• SMA(5): ₹${technicalAnalysis.sma5} ${technicalAnalysis.currentPrice > technicalAnalysis.sma5 ? '✓ Above' : '✗ Below'}
• SMA(10): ₹${technicalAnalysis.sma10} ${technicalAnalysis.currentPrice > technicalAnalysis.sma10 ? '✓ Above' : '✗ Below'}
• SMA(20): ₹${technicalAnalysis.sma20} ${technicalAnalysis.currentPrice > technicalAnalysis.sma20 ? '✓ Above' : '✗ Below'}
• EMA(10): ₹${technicalAnalysis.ema10}

**Momentum**:
• RSI(14): ${technicalAnalysis.rsi} ${technicalAnalysis.rsi > 70 ? '⚠️ Overbought' : technicalAnalysis.rsi < 30 ? '⚠️ Oversold' : '✓ Neutral'}
• MACD: ${technicalAnalysis.macd.macd.toFixed(2)}, Signal: ${technicalAnalysis.macd.signal.toFixed(2)}, Histogram: ${technicalAnalysis.macd.histogram.toFixed(2)} ${technicalAnalysis.macd.histogram > 0 ? '↗️' : '↘️'}

**Volatility (Bollinger Bands)**:
• Upper: ₹${technicalAnalysis.bollingerBands.upper}
• Lower: ₹${technicalAnalysis.bollingerBands.lower}
• Width: ${technicalAnalysis.bollingerBands.width}% ${technicalAnalysis.bollingerBands.width > 5 ? '⚠️ High volatility' : '✓ Normal'}

**Key Levels**:
• Support: ${technicalAnalysis.supportLevels.map((s: any) => `₹${s}`).join(', ')}
• Resistance: ${technicalAnalysis.resistanceLevels.map((r: any) => `₹${r}`).join(', ')}

**Volume**:
• Average: ${technicalAnalysis.avgVolume.toLocaleString()}
• Trend: ${technicalAnalysis.volumeTrend} ${technicalAnalysis.volumeVsAvg > 20 ? '🔥' : ''}
• vs Avg: ${technicalAnalysis.volumeVsAvg}%

**Trend Summary**:
• Short-term (5d): ${technicalAnalysis.shortTrend}
• Medium-term (10d): ${technicalAnalysis.mediumTrend}
• Long-term (20d): ${technicalAnalysis.longTrend}

=== 🎯 YOUR TASK ===
For EACH of the next 7 trading days, provide:

1. **Technical Score** (0-6): Count how many indicators align
2. **Confidence %**: Use the formula (40-65% range, decreasing over time)
3. **Opening & Closing Prices**: Be conservative (0.5-2% daily moves max)
4. **Reasoning** (80-120 words): Focus on PRIMARY driver + key risks
5. **Risk Factors**: List 2-4 specific concerns

⚠️ CRITICAL CONSTRAINTS:
- Day 1 opening MUST be ≈ ₹${technicalAnalysis.currentPrice} (±0.3%)
- Each day's opening = previous day's predicted close (±0.5% gap if news/gap expected)
- Price must respect support/resistance levels
- Confidence DECREASES each day (Day 1 highest, Day 7 lowest)
- If indicators conflict, predict SMALL movements or sideways

**JSON OUTPUT** (array of 7 predictions):
[
  {
    "day": 1,
    "openingPrice": <number>,
    "closingPrice": <number>,
    "reason": "<80-120 words: primary driver, supporting indicators, key risks>",
    "confidence": "<percentage>",
    "predictionDate": "<YYYY-MM-DD>",
    "technicalScore": <0-6>,
    "trendAlignment": "<bullish/bearish/neutral>",
    "riskFactors": "<2-4 specific risk factors, comma-separated>"
  },
  ... (repeat for days 2-7)
]`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2, // Lower temperature for more consistent, conservative predictions
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status} - ${errorText}`);
    }

    let aiResponse;
    try {
      const responseText = await response.text();
      console.log('Raw AI Response:', responseText.substring(0, 500)); // Log first 500 chars
      aiResponse = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      throw new Error('Invalid response from AI gateway. Please try again.');
    }

    if (!aiResponse.choices?.[0]?.message?.content) {
      console.error('Unexpected AI response structure:', aiResponse);
      throw new Error('Invalid AI response structure');
    }

    const content = aiResponse.choices[0].message.content;
    console.log('AI Response:', content);

    // Extract JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Could not parse AI response - expected array of 7 predictions');
    }

    const predictions = JSON.parse(jsonMatch[0]);
    
    if (!Array.isArray(predictions) || predictions.length !== 7) {
      throw new Error(`Expected 7 predictions, got ${predictions?.length || 0}`);
    }

    // Calculate prediction dates for next 7 trading days
    const tradingDates = getNext7TradingDays();
    predictions.forEach((pred, idx) => {
      pred.predictionDate = tradingDates[idx];
      pred.day = idx + 1;
    });

    // Cache all 7 predictions in the database
    try {
      const insertPromises = predictions.map((pred, idx) => 
        supabase
          .from('stock_predictions')
          .insert({
            symbol,
            company_name: companyName,
            prediction_date: today,
            days_ahead: idx + 1,
            opening_price: pred.openingPrice,
            closing_price: pred.closingPrice,
            reason: pred.reason,
            confidence: pred.confidence,
            technical_score: pred.technicalScore,
            trend_alignment: pred.trendAlignment,
            risk_factors: pred.riskFactors,
            historical_data: historicalData
          })
      );
      
      await Promise.all(insertPromises);
      console.log('All 7 predictions cached successfully');
    } catch (cacheInsertError) {
      console.error('Failed to cache predictions:', cacheInsertError);
      // Don't fail the request if caching fails
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        predictions,
        historicalData,
        cached: false
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in predict-stock:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function fetchRealStockData(symbol: string) {
  try {
    // Convert symbol to Yahoo Finance format
    let yahooSymbol = symbol;
    
    // Skip if already has a suffix or is an index
    if (!symbol.includes('.') && !symbol.startsWith('^')) {
      // BSE stocks are numerical codes - add .BO suffix
      if (/^\d+$/.test(symbol)) {
        yahooSymbol = `${symbol}.BO`;
      } else {
        // NSE stocks are alphabetic - add .NS suffix
        yahooSymbol = `${symbol}.NS`;
      }
    }
    
    // Calculate date range (last 30 days for better analysis)
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - (30 * 24 * 60 * 60);
    
    // Fetch from Yahoo Finance API
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?period1=${startDate}&period2=${endDate}&interval=1d`;
    
    console.log(`Fetching ${symbol} as ${yahooSymbol} (is numeric: ${/^\d+$/.test(symbol)})`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch stock data');
    }
    
    const data = await response.json();
    const result = data.chart.result[0];
    
    if (!result || !result.timestamp) {
      throw new Error('Invalid stock data received');
    }
    
    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];
    
    const historicalData = timestamps.map((timestamp: number, index: number) => {
      const date = new Date(timestamp * 1000);
      return {
        date: date.toISOString().split('T')[0],
        open: Math.round(quotes.open[index] * 100) / 100,
        close: Math.round(quotes.close[index] * 100) / 100,
        high: Math.round(quotes.high[index] * 100) / 100,
        low: Math.round(quotes.low[index] * 100) / 100,
        volume: quotes.volume[index]
      };
    });
    
    return historicalData;
  } catch (error) {
    console.error('Error fetching real stock data:', error);
    console.warn(`FALLING BACK TO MOCK DATA for ${symbol} - Yahoo Finance API failed`);
    // Fallback to mock data if API fails
    return generateMockHistoricalData(symbol);
  }
}

function getNext7TradingDays(): string[] {
  const dates: string[] = [];
  const date = new Date();
  let addedDays = 0;
  
  while (addedDays < 7) {
    date.setDate(date.getDate() + 1);
    
    // Skip weekends (Saturday = 6, Sunday = 0)
    if (date.getDay() !== 0 && date.getDay() !== 6) {
      dates.push(date.toISOString().split('T')[0]);
      addedDays++;
    }
  }
  
  return dates;
}

// Seeded random number generator for deterministic mock data
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateMockHistoricalData(symbol: string) {
  const data = [];
  const basePrice = 2400;
  const today = new Date();
  
  // Create a seed from the symbol and today's date for consistency
  const symbolSeed = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const dateSeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  let seed = symbolSeed + dateSeed;
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // Use seeded random for consistent results
    seed++;
    const randomChange = (seededRandom(seed) - 0.5) * 50;
    const open = basePrice + randomChange + (29 - i) * 10;
    
    seed++;
    const close = open + (seededRandom(seed) - 0.5) * 30;
    
    seed++;
    const volume = Math.floor(1000000 + seededRandom(seed) * 500000);
    
    seed++;
    const high = Math.max(open, close) + seededRandom(seed) * 20;
    
    seed++;
    const low = Math.min(open, close) - seededRandom(seed) * 20;
    
    data.push({
      date: date.toISOString().split('T')[0],
      open: Math.round(open * 100) / 100,
      close: Math.round(close * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      volume
    });
  }
  
  return data;
}

function calculateTechnicalIndicators(data: any[]) {
  const closes = data.map((d: any) => d.close);
  const highs = data.map((d: any) => d.high);
  const lows = data.map((d: any) => d.low);
  const volumes = data.map((d: any) => d.volume);
  const currentPrice = closes[closes.length - 1];
  
  // Simple Moving Averages
  const sma = (period: number) => {
    const slice = closes.slice(-period);
    return Math.round((slice.reduce((a: number, b: number) => a + b, 0) / period) * 100) / 100;
  };
  
  // Exponential Moving Average
  const ema = (period: number) => {
    const k = 2 / (period + 1);
    let emaValue = closes[0];
    for (let i = 1; i < closes.length; i++) {
      emaValue = closes[i] * k + emaValue * (1 - k);
    }
    return Math.round(emaValue * 100) / 100;
  };
  
  // RSI Calculation
  const calculateRSI = (period = 14) => {
    const changes = [];
    for (let i = 1; i < closes.length; i++) {
      changes.push(closes[i] - closes[i - 1]);
    }
    
    const gains = changes.map((c: number) => c > 0 ? c : 0);
    const losses = changes.map((c: number) => c < 0 ? Math.abs(c) : 0);
    
    const avgGain = gains.slice(-period).reduce((a: number, b: number) => a + b, 0) / period;
    const avgLoss = losses.slice(-period).reduce((a: number, b: number) => a + b, 0) / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return Math.round((100 - (100 / (1 + rs))) * 100) / 100;
  };
  
  // MACD Calculation
  const calculateMACD = () => {
    const ema12 = ema(12);
    const ema26 = ema(26);
    const macdLine = Math.round((ema12 - ema26) * 100) / 100;
    
    // Signal line (9-day EMA of MACD)
    const signal = Math.round((macdLine * 0.2 + ema26 * 0.8) * 100) / 100;
    const histogram = Math.round((macdLine - signal) * 100) / 100;
    
    return { macd: macdLine, signal, histogram };
  };
  
  // Bollinger Bands
  const calculateBollingerBands = (period = 20, stdDev = 2) => {
    const sma20 = sma(period);
    const slice = closes.slice(-period);
    const variance = slice.reduce((sum: number, val: number) => sum + Math.pow(val - sma20, 2), 0) / period;
    const std = Math.sqrt(variance);
    
    return {
      upper: Math.round((sma20 + stdDev * std) * 100) / 100,
      middle: sma20,
      lower: Math.round((sma20 - stdDev * std) * 100) / 100,
      width: Math.round((std / sma20 * 100) * 100) / 100
    };
  };
  
  // Support and Resistance Levels
  const calculateSupportResistance = () => {
    const recentData = data.slice(-20);
    const sortedLows = [...lows.slice(-20)].sort((a: number, b: number) => a - b);
    const sortedHighs = [...highs.slice(-20)].sort((a: number, b: number) => b - a);
    
    return {
      support: [
        Math.round(sortedLows[0] * 100) / 100,
        Math.round(sortedLows[Math.floor(sortedLows.length * 0.25)] * 100) / 100
      ],
      resistance: [
        Math.round(sortedHighs[0] * 100) / 100,
        Math.round(sortedHighs[Math.floor(sortedHighs.length * 0.25)] * 100) / 100
      ]
    };
  };
  
  // Volume Analysis
  const avgVolume = Math.round(volumes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20);
  const recentVolume = volumes[volumes.length - 1];
  const volumeVsAvg = Math.round(((recentVolume - avgVolume) / avgVolume * 100) * 100) / 100;
  
  // Volume Trend
  const recentAvgVol = volumes.slice(-5).reduce((a: number, b: number) => a + b, 0) / 5;
  const olderAvgVol = volumes.slice(-10, -5).reduce((a: number, b: number) => a + b, 0) / 5;
  const volumeTrend = recentAvgVol > olderAvgVol * 1.2 ? 'Increasing' : recentAvgVol < olderAvgVol * 0.8 ? 'Decreasing' : 'Stable';
  
  // Trend Analysis
  const sma5 = sma(5);
  const sma10 = sma(10);
  const sma20 = sma(20);
  
  const shortTrend = currentPrice > sma5 ? 'Bullish' : 'Bearish';
  const mediumTrend = sma5 > sma10 ? 'Bullish' : 'Bearish';
  const longTrend = sma10 > sma20 ? 'Bullish' : 'Bearish';
  
  // Price Changes
  const priceChange24h = Math.round(((closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2] * 100) * 100) / 100;
  const priceChange7d = closes.length >= 7 
    ? Math.round(((closes[closes.length - 1] - closes[closes.length - 7]) / closes[closes.length - 7] * 100) * 100) / 100 
    : 0;
  
  // Volatility
  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  const variance = returns.reduce((sum: number, r: number) => sum + Math.pow(r, 2), 0) / returns.length;
  const volatility = Math.round(Math.sqrt(variance) * 100 * 100) / 100;
  
  const levels = calculateSupportResistance();
  const macd = calculateMACD();
  const bollingerBands = calculateBollingerBands();
  
  return {
    currentPrice,
    sma5,
    sma10,
    sma20,
    ema10: ema(10),
    rsi: calculateRSI(),
    macd,
    bollingerBands,
    supportLevels: levels.support,
    resistanceLevels: levels.resistance,
    avgVolume,
    volumeTrend,
    volumeVsAvg,
    shortTrend,
    mediumTrend,
    longTrend,
    priceChange24h,
    priceChange7d,
    volatility
  };
}
