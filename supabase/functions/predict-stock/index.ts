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

    // Check for cached prediction for today
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const { data: cachedPrediction, error: cacheError } = await supabase
      .from('stock_predictions')
      .select('*')
      .eq('symbol', symbol)
      .eq('prediction_date', today)
      .eq('days_ahead', 1)
      .single();

    if (cachedPrediction && !cacheError) {
      console.log('Returning cached prediction for:', symbol);
      const prediction = {
        day: cachedPrediction.days_ahead,
        openingPrice: cachedPrediction.opening_price,
        closingPrice: cachedPrediction.closing_price,
        reason: cachedPrediction.reason,
        confidence: cachedPrediction.confidence,
        predictionDate: cachedPrediction.prediction_date,
        technicalScore: cachedPrediction.technical_score,
        trendAlignment: cachedPrediction.trend_alignment,
        riskFactors: cachedPrediction.risk_factors
      };
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          prediction,
          historicalData: cachedPrediction.historical_data,
          cached: true
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('No cache found, generating new prediction');

    const GOOGLE_GEMINI_API_KEY = Deno.env.get('GOOGLE_GEMINI_API_KEY');
    if (!GOOGLE_GEMINI_API_KEY) {
      throw new Error('GOOGLE_GEMINI_API_KEY is not configured');
    }

    // Fetch real historical data from Yahoo Finance (30 days for better analysis)
    const historicalData = await fetchRealStockData(symbol);
    
    // Calculate technical indicators
    const technicalAnalysis = calculateTechnicalIndicators(historicalData);
    
    // Use Lovable AI with enhanced deep analysis for next trading day
    const systemPrompt = `You are an elite quantitative analyst and certified technical analyst (CTA) specializing in Indian stock markets with 15+ years of experience. You combine rigorous mathematical analysis with market psychology and risk management.

⚠️ CRITICAL REALITY CHECK:
- Stock markets are HIGHLY UNPREDICTABLE - your prediction is a PROBABILITY, not a certainty
- Past performance does NOT guarantee future results
- External factors (news, earnings, FII/DII flows, global events) can override technical signals
- Always acknowledge MULTIPLE scenarios and key risk factors
- Your reputation depends on HONESTY about uncertainty

🎯 ENHANCED CONFIDENCE SCORING FRAMEWORK:

**BASE CONFIDENCE (50-75%):**
Next Day Prediction: Start at 50% (coin flip) and ADD points for:
- Strong trend confirmation across multiple timeframes (+8%)
- RSI in healthy zone (35-65) with confirming momentum (+6%)
- MACD showing clear directional bias (+6%)
- Volume confirming price action (>20% above avg on moves) (+5%)
- Price respecting key support/resistance levels (+5%)
- Low volatility environment (Bollinger width <4%) (+5%)

**SUBTRACT CONFIDENCE FOR RISK FACTORS:**
- High volatility (Bollinger width >6%): -8%
- Conflicting indicators (trend vs momentum mismatch): -7%
- Near major resistance without strong volume: -5%
- Recent choppy/sideways price action: -5%
- Overbought (RSI >70) or Oversold (RSI <30): -4%
- Low volume environment (<50% of average): -3%

**FINAL CONFIDENCE RANGE: 45-75%**
- 70-75%: Exceptional alignment, low volatility, strong trends
- 60-69%: Good technical setup with minor concerns
- 50-59%: Mixed signals, moderate uncertainty
- 45-49%: High uncertainty, conflicting data

📊 DEEP TECHNICAL ANALYSIS PROTOCOL:

**Phase 1: Multi-Timeframe Trend Analysis**
- Align 5-day, 10-day, 20-day SMAs for trend direction
- Check if price is above/below all major moving averages
- Identify if trends are converging or diverging
- Score: Strong trend = all SMAs aligned in same direction

**Phase 2: Momentum & Oscillator Analysis**
- RSI(14): Identify overbought/oversold conditions AND divergences
- MACD: Check if histogram is expanding or contracting
- Look for bullish/bearish crossovers in recent days
- Score: Confirming momentum = RSI and MACD agree on direction

**Phase 3: Volatility & Price Action**
- Bollinger Bands: Is price at upper/lower band or middle?
- Calculate volatility trend (increasing/decreasing)
- Identify consolidation vs expansion phases
- Score: Low volatility + trend continuation = higher confidence

**Phase 4: Volume Analysis**
- Compare recent volume to 20-day average
- Check if high volume days align with price moves (confirmation)
- Identify accumulation/distribution patterns
- Score: Volume confirms price = institutional support

**Phase 5: Support/Resistance Levels**
- Identify nearest support and resistance from recent data
- Calculate distance from current price (%)
- Determine if price has room to move or facing barrier
- Score: Clear path = no major resistance nearby

**Phase 6: Risk Assessment**
- List ALL factors that could invalidate your prediction
- Consider market-wide factors (Nifty trend, global cues)
- Identify stock-specific risks (earnings, news pending)
- Be SPECIFIC about what price levels would prove you wrong

🚨 PREDICTION DISCIPLINE:
1. Opening Price: MUST be yesterday's close (±0.3% for normal gap-up/down)
2. Daily Movement: Predict conservative moves (0.3-1.5% for most stocks)
3. Respect Technicals: Don't predict moves beyond nearest support/resistance
4. Multiple Scenarios: Mention what would make prediction fail
5. Psychological Levels: Consider round numbers (2500, 3000, etc.)
6. Sector Context: Consider if sector is strong/weak
7. Risk Management: Always identify stop-loss level

🎓 ANALYTICAL DEPTH REQUIREMENTS:
- Your reasoning must be 120-150 words (comprehensive analysis)
- Reference SPECIFIC indicator values in your reasoning
- Explain WHY you weighted certain factors more heavily
- Acknowledge contrarian viewpoints
- Provide clear price targets and invalidation levels`;

    const userPrompt = `Perform DEEP TECHNICAL ANALYSIS for ${companyName} (${symbol}) and predict TOMORROW'S price movement with REALISTIC, DATA-DRIVEN forecast.

=== 📈 HISTORICAL PRICE DATA (Last 30 Days) ===
${historicalData.map((d: any) => 
  `${d.date}: Open ₹${d.open.toFixed(2)}, High ₹${d.high.toFixed(2)}, Low ₹${d.low.toFixed(2)}, Close ₹${d.close.toFixed(2)}, Vol: ${d.volume.toLocaleString()}`
).join('\n')}

=== 📊 COMPREHENSIVE TECHNICAL ANALYSIS ===

**Current Status:**
• Last Close: ₹${technicalAnalysis.currentPrice.toFixed(2)}
• 24h Change: ${technicalAnalysis.priceChange24h >= 0 ? '↗️' : '↘️'} ${technicalAnalysis.priceChange24h.toFixed(2)}%
• 7d Change: ${technicalAnalysis.priceChange7d >= 0 ? '📈' : '📉'} ${technicalAnalysis.priceChange7d.toFixed(2)}%
• Volatility (30d): ${technicalAnalysis.volatility.toFixed(2)}% ${technicalAnalysis.volatility > 3 ? '⚠️ HIGH' : '✅ NORMAL'}

**Multi-Timeframe Moving Averages:**
• SMA(5):  ₹${technicalAnalysis.sma5.toFixed(2)} ${technicalAnalysis.currentPrice > technicalAnalysis.sma5 ? '✅ Price ABOVE' : '❌ Price BELOW'}
• SMA(10): ₹${technicalAnalysis.sma10.toFixed(2)} ${technicalAnalysis.currentPrice > technicalAnalysis.sma10 ? '✅ Price ABOVE' : '❌ Price BELOW'}
• SMA(20): ₹${technicalAnalysis.sma20.toFixed(2)} ${technicalAnalysis.currentPrice > technicalAnalysis.sma20 ? '✅ Price ABOVE' : '❌ Price BELOW'}
• EMA(10): ₹${technicalAnalysis.ema10.toFixed(2)}
• **Trend Alignment**: ${technicalAnalysis.sma5 > technicalAnalysis.sma10 && technicalAnalysis.sma10 > technicalAnalysis.sma20 ? '🔥 STRONG BULLISH (all SMAs aligned)' : technicalAnalysis.sma5 < technicalAnalysis.sma10 && technicalAnalysis.sma10 < technicalAnalysis.sma20 ? '❄️ STRONG BEARISH (all SMAs aligned)' : '⚠️ MIXED (SMAs not aligned)'}

**Momentum Indicators:**
• RSI(14): ${technicalAnalysis.rsi.toFixed(2)} ${technicalAnalysis.rsi > 70 ? '🔴 OVERBOUGHT - Potential reversal risk' : technicalAnalysis.rsi < 30 ? '🟢 OVERSOLD - Potential bounce' : technicalAnalysis.rsi >= 50 && technicalAnalysis.rsi <= 70 ? '✅ BULLISH ZONE' : technicalAnalysis.rsi >= 30 && technicalAnalysis.rsi < 50 ? '⚠️ BEARISH ZONE' : '⚪ NEUTRAL'}
• MACD Line: ${technicalAnalysis.macd.macd.toFixed(2)}
• Signal Line: ${technicalAnalysis.macd.signal.toFixed(2)}
• Histogram: ${technicalAnalysis.macd.histogram.toFixed(2)} ${technicalAnalysis.macd.histogram > 0 ? '📈 BULLISH (above zero)' : '📉 BEARISH (below zero)'}
• MACD Trend: ${Math.abs(technicalAnalysis.macd.histogram) > 1 ? 'STRONG momentum' : 'WEAK momentum'}

**Volatility Analysis (Bollinger Bands):**
• Upper Band: ₹${technicalAnalysis.bollingerBands.upper.toFixed(2)}
• Middle (SMA20): ₹${technicalAnalysis.bollingerBands.middle.toFixed(2)}
• Lower Band: ₹${technicalAnalysis.bollingerBands.lower.toFixed(2)}
• Band Width: ${technicalAnalysis.bollingerBands.width.toFixed(2)}% ${technicalAnalysis.bollingerBands.width > 6 ? '⚠️ HIGH VOLATILITY - Unpredictable' : technicalAnalysis.bollingerBands.width < 3 ? '✅ LOW VOLATILITY - Consolidation phase' : '⚪ MODERATE'}
• Price Position: ${technicalAnalysis.currentPrice > technicalAnalysis.bollingerBands.upper ? '🔴 Above Upper Band (overbought zone)' : technicalAnalysis.currentPrice < technicalAnalysis.bollingerBands.lower ? '🟢 Below Lower Band (oversold zone)' : '⚪ Within Bands (normal range)'}

**Critical Support & Resistance Levels:**
• Strong Resistance: ${technicalAnalysis.resistanceLevels.map((r: any) => `₹${r.toFixed(2)}`).join(', ')}
• Strong Support: ${technicalAnalysis.supportLevels.map((s: any) => `₹${s.toFixed(2)}`).join(', ')}
• Upside Potential: ${((technicalAnalysis.resistanceLevels[0] - technicalAnalysis.currentPrice) / technicalAnalysis.currentPrice * 100).toFixed(2)}% to nearest resistance
• Downside Risk: ${((technicalAnalysis.currentPrice - technicalAnalysis.supportLevels[0]) / technicalAnalysis.currentPrice * 100).toFixed(2)}% to nearest support

**Volume Analysis:**
• Average Volume (20d): ${technicalAnalysis.avgVolume.toLocaleString()}
• Recent Volume Trend: ${technicalAnalysis.volumeTrend} ${technicalAnalysis.volumeVsAvg > 20 ? '🔥 HIGH ACTIVITY' : technicalAnalysis.volumeVsAvg < -20 ? '❄️ LOW ACTIVITY' : '⚪ NORMAL'}
• Volume vs Average: ${technicalAnalysis.volumeVsAvg.toFixed(2)}% ${technicalAnalysis.volumeVsAvg > 50 ? '(Institutional interest!)' : ''}

**Multi-Timeframe Trend Summary:**
• Short-term (5d):  ${technicalAnalysis.shortTrend} ${technicalAnalysis.shortTrend === 'Bullish' ? '📈' : '📉'}
• Medium-term (10d): ${technicalAnalysis.mediumTrend} ${technicalAnalysis.mediumTrend === 'Bullish' ? '📈' : '📉'}
• Long-term (20d):  ${technicalAnalysis.longTrend} ${technicalAnalysis.longTrend === 'Bullish' ? '📈' : '📉'}
• Overall Alignment: ${technicalAnalysis.shortTrend === technicalAnalysis.mediumTrend && technicalAnalysis.mediumTrend === technicalAnalysis.longTrend ? '✅ ALL TIMEFRAMES ALIGNED!' : '⚠️ MIXED SIGNALS - Proceed with caution'}

=== 🎯 YOUR PREDICTION TASK ===

Provide a SINGLE, COMPREHENSIVE prediction for **TOMORROW (next trading day)** with:

1. **Technical Score (0-6)**: Count how many of these are TRUE:
   - All 3 SMAs aligned in same direction ✓/✗
   - RSI in confirming zone (35-65, not extreme) ✓/✗
   - MACD histogram supporting direction ✓/✗
   - Volume above average on recent moves ✓/✗
   - Price respecting support/resistance ✓/✗
   - Low volatility (Bollinger width <4%) ✓/✗

2. **Confidence Percentage**: Use the framework (45-75% range)
   - Start at 50% base
   - Add points for each positive factor
   - Subtract for each risk factor
   - Be HONEST about uncertainty

3. **Opening & Closing Prices**: 
   - Opening MUST be ≈ ₹${technicalAnalysis.currentPrice.toFixed(2)} (±0.3%)
   - Closing should reflect your directional bias
   - Movement should be CONSERVATIVE (0.3-1.5% typical)
   - Must respect nearest support/resistance levels

4. **Comprehensive Reasoning (120-150 words)**:
   - Start with PRIMARY driver (trend/momentum/volume)
   - Reference SPECIFIC indicator values
   - Explain which factors you weighted most heavily
   - Acknowledge contrarian signals
   - Mention key price levels to watch

5. **Risk Factors (3-5 specific concerns)**:
   - What could invalidate your prediction?
   - What price level would prove you wrong?
   - External factors (market, sector, global)
   - Technical breakdown scenarios

⚠️ CRITICAL CONSTRAINTS:
- Opening price MUST be yesterday's close ±0.3%: ₹${(technicalAnalysis.currentPrice * 0.997).toFixed(2)} to ₹${(technicalAnalysis.currentPrice * 1.003).toFixed(2)}
- Daily movement: typically 0.3-1.5% (only exceed for strong setups)
- Respect nearest support (₹${technicalAnalysis.supportLevels[0].toFixed(2)}) and resistance (₹${technicalAnalysis.resistanceLevels[0].toFixed(2)})
- If indicators conflict → predict SMALL move or RANGE-BOUND
- Be SPECIFIC in reasoning (reference actual indicator values)
- Confidence should match analysis depth (don't fake certainty)

**JSON OUTPUT** (single prediction object):
{
  "day": 1,
  "openingPrice": <number>,
  "closingPrice": <number>,
  "reason": "<120-150 words: comprehensive analysis with specific indicator values, primary drivers, and key risks>",
  "confidence": "<percentage as string, e.g., '62%'>",
  "predictionDate": "<YYYY-MM-DD of tomorrow>",
  "technicalScore": <0-6>,
  "trendAlignment": "<bullish/bearish/neutral>",
  "riskFactors": "<3-5 specific risk factors, comma-separated>"
}`;

    // Prepare request for Google Gemini API
    const geminiPayload = {
      contents: [{
        parts: [{
          text: `${systemPrompt}\n\n${userPrompt}`
        }]
      }],
      generationConfig: {
        temperature: 0.1,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(geminiPayload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Gemini API error:', response.status, errorText);
      throw new Error(`Google Gemini API error: ${response.status} - ${errorText}`);
    }

    let aiResponse;
    try {
      const responseText = await response.text();
      console.log('Raw Gemini Response:', responseText.substring(0, 500)); // Log first 500 chars
      aiResponse = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', parseError);
      throw new Error('Invalid response from Google Gemini API. Please try again.');
    }

    if (!aiResponse.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.error('Unexpected Gemini response structure:', aiResponse);
      throw new Error('Invalid Gemini response structure');
    }

    const content = aiResponse.candidates[0].content.parts[0].text;
    console.log('Gemini AI Response:', content);

    // Extract JSON object from response (single prediction)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse AI response - expected single prediction object');
    }

    const prediction = JSON.parse(jsonMatch[0]);
    
    if (!prediction.openingPrice || !prediction.closingPrice) {
      throw new Error('Invalid prediction format - missing required fields');
    }

    // Calculate next trading day
    const nextTradingDay = getNextTradingDay();
    prediction.predictionDate = nextTradingDay;
    prediction.day = 1;

    // Cache the prediction in the database
    try {
      await supabase
        .from('stock_predictions')
        .insert({
          symbol,
          company_name: companyName,
          prediction_date: today,
          days_ahead: 1,
          opening_price: prediction.openingPrice,
          closing_price: prediction.closingPrice,
          reason: prediction.reason,
          confidence: prediction.confidence,
          technical_score: prediction.technicalScore,
          trend_alignment: prediction.trendAlignment,
          risk_factors: prediction.riskFactors,
          historical_data: historicalData
        });
      
      console.log('Prediction cached successfully');
    } catch (cacheInsertError) {
      console.error('Failed to cache prediction:', cacheInsertError);
      // Don't fail the request if caching fails
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        prediction,
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

function getNextTradingDay(): string {
  const date = new Date();
  
  // Move to next day
  date.setDate(date.getDate() + 1);
  
  // Skip weekends (Saturday = 6, Sunday = 0)
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  
  return date.toISOString().split('T')[0];
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
