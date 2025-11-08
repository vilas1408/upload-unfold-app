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
    const { symbol, name, type } = await req.json();
    
    if (!symbol || !name || !type) {
      throw new Error('Symbol, name, and type are required');
    }
    
    console.log('Predicting options for:', symbol, name, type);

    const GOOGLE_GEMINI_API_KEY = Deno.env.get('GOOGLE_GEMINI_API_KEY');
    if (!GOOGLE_GEMINI_API_KEY) {
      throw new Error('GOOGLE_GEMINI_API_KEY is not configured');
    }

    // Fetch historical data
    const historicalData = await fetchRealStockData(symbol);
    const technicalAnalysis = calculateTechnicalIndicators(historicalData);
    
    const systemPrompt = `You are an elite options trading expert specializing in Indian stock and index options. You provide SIMPLE, DIRECTIONAL options strategies based on real-time market data and technical analysis.

🎯 YOUR STRATEGY RULES:
- **BULLISH MARKET**: Recommend BUY CALL options ONLY
- **BEARISH MARKET**: Recommend BUY PUT options ONLY
- **NO COMPLEX STRATEGIES**: No spreads, straddles, iron condors, or hedging strategies
- **SIMPLE DIRECTIONAL BETS**: One clear direction, one simple trade

📊 ANALYSIS FRAMEWORK:

**1. Market Direction Analysis:**
- Use moving averages (SMA5, SMA10, SMA20) to determine trend
- RSI for momentum (>70 overbought, <30 oversold)
- MACD for trend confirmation
- Price action and volume patterns
- Support/resistance levels

**2. Decision Logic:**
- If price > SMA20 AND RSI < 70 AND MACD positive → BULLISH → BUY CALL
- If price < SMA20 AND RSI > 30 AND MACD negative → BEARISH → BUY PUT
- Strong uptrend (SMA5 > SMA10 > SMA20) → BULLISH → BUY CALL
- Strong downtrend (SMA5 < SMA10 < SMA20) → BEARISH → BUY PUT

**3. Strike Price Selection:**
- ATM (At The Money) for balanced risk/reward
- Slightly OTM (Out of The Money) for higher return potential
- Strike should be within ±5% of current price

**4. Premium Calculation (Realistic):**
- ATM Call/Put: 2-4% of strike price
- Slightly OTM: 1-3% of strike price
- Adjust based on volatility (higher volatility = higher premium)

**5. Risk Management:**
- Max loss = Premium paid
- Target return: 50-100% of premium
- Stop loss: Exit if premium drops 50%
- Time frame: 7-30 days (avoid weekly expiries)

📈 PROBABILITY FRAMEWORK:
- 65-75%: Strong trend, clear momentum, good technical setup
- 55-64%: Moderate trend, decent indicators
- 45-54%: Weak signals, mixed indicators

🚨 CRITICAL RULES:
- ONE strategy ONLY: Either "Long Call" or "Long Put"
- NO hedging, NO spreads, NO complex strategies
- Base decision on REAL current market data provided
- Premium must be realistic based on strike and volatility
- Breakeven = Strike + Premium (for CALL) OR Strike - Premium (for PUT)`;

    const userPrompt = `Analyze ${type === 'share' ? 'stock' : 'index'} options for ${name} (${symbol}) and provide a SIMPLE DIRECTIONAL options recommendation based on current live market data.

=== 📈 LIVE MARKET DATA (Last 30 Days) ===
${historicalData.map((d: any) => 
  `${d.date}: Open ₹${d.open.toFixed(2)}, High ₹${d.high.toFixed(2)}, Low ₹${d.low.toFixed(2)}, Close ₹${d.close.toFixed(2)}, Vol: ${d.volume.toLocaleString()}`
).join('\n')}

=== 📊 CURRENT TECHNICAL ANALYSIS ===
**Current Status:**
• Last Close: ₹${technicalAnalysis.currentPrice.toFixed(2)}
• 24h Change: ${technicalAnalysis.priceChange24h.toFixed(2)}%
• 7d Change: ${technicalAnalysis.priceChange7d.toFixed(2)}%
• Volatility (30d): ${technicalAnalysis.volatility.toFixed(2)}%

**Moving Averages:**
• SMA(5): ₹${technicalAnalysis.sma5.toFixed(2)}
• SMA(10): ₹${technicalAnalysis.sma10.toFixed(2)}
• SMA(20): ₹${technicalAnalysis.sma20.toFixed(2)}

**Momentum Indicators:**
• RSI(14): ${technicalAnalysis.rsi.toFixed(2)}
• MACD Histogram: ${technicalAnalysis.macd.histogram.toFixed(2)}

**Key Levels:**
• Resistance: ${technicalAnalysis.resistanceLevels.map((r: any) => `₹${r.toFixed(2)}`).join(', ')}
• Support: ${technicalAnalysis.supportLevels.map((s: any) => `₹${s.toFixed(2)}`).join(', ')}

=== 🎯 YOUR TASK ===

Based on the LIVE data above, provide ONE simple directional options recommendation:

**IF BULLISH (uptrend detected):**
- Strategy: "Long Call"
- Recommend BUY CALL option ONLY

**IF BEARISH (downtrend detected):**
- Strategy: "Long Put"  
- Recommend BUY PUT option ONLY

**Provide these details:**

1. **Strategy Name**: MUST be "Long Call" OR "Long Put"

2. **Strike Price**: Single strike price (ATM or slightly OTM, within ±5% of current price)

3. **Option Type**: "CALL" or "PUT"

4. **Target Price**: Expected price target

5. **Stop Loss**: Exit price if trade goes wrong

6. **Expected Return**: 50-100% of premium paid

7. **Probability**: Success probability (45-75%)

8. **Max Loss**: Premium paid (in ₹)

9. **Max Gain**: Potential profit (in ₹)

10. **Breakeven**: Strike + Premium (CALL) OR Strike - Premium (PUT)

11. **Premium Details**: 
    - buyLeg: Premium to pay for the option (₹)
    - sellLeg: null (no sell leg in simple strategy)
    - netCost: Same as buyLeg
    - description: Brief explanation of premium

12. **IV Rank**: 0-100 (estimated volatility rank)

13. **Greeks** (estimated):
    - delta: 0.40-0.60 (typical for ATM options)
    - gamma: Small positive number
    - theta: Negative (time decay per day)
    - vega: Positive (volatility sensitivity)

14. **Reasoning**: 150-200 words explaining:
    - Market direction (bullish/bearish) based on live data
    - Technical indicators supporting the trade
    - Why this strike price and expiry
    - Risk and reward expectations
    - Key price levels to watch

15. **Risk Level**: "Medium" or "High"

16. **Time Frame**: "7-14 days" or "15-30 days"

17. **Technical Score**: 0-10 (quality of setup)

**JSON OUTPUT FORMAT**:
{
  "strategy": "Long Call" | "Long Put",
  "strikePrice": "₹<number>",
  "optionType": "CALL" | "PUT",
  "targetPrice": <number>,
  "stopLoss": <number>,
  "expectedReturn": <percentage>,
  "probability": "<percentage>%",
  "maxLoss": <number>,
  "maxGain": <number>,
  "breakeven": "₹<number>",
  "premium": {
    "buyLeg": <number>,
    "sellLeg": null,
    "netCost": <number>,
    "description": "<brief explanation>"
  },
  "ivRank": <0-100>,
  "greeks": {
    "delta": <0.40-0.60>,
    "gamma": <small positive>,
    "theta": <negative>,
    "vega": <positive>
  },
  "reasoning": "<150-200 words>",
  "riskLevel": "Medium" | "High",
  "timeFrame": "<days>",
  "technicalScore": <0-10>
}`;

    const geminiPayload = {
      contents: [{
        parts: [{
          text: `${systemPrompt}\n\n${userPrompt}`
        }]
      }],
      generationConfig: {
        temperature: 0.2,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GOOGLE_GEMINI_API_KEY}`,
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
      throw new Error(`Google Gemini API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.candidates[0].content.parts[0].text;
    console.log('Options AI Response:', content);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse AI response');
    }

    const prediction = JSON.parse(jsonMatch[0]);

    return new Response(
      JSON.stringify({ 
        success: true, 
        prediction,
        historicalData
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error: any) {
    console.error('Options prediction error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Upstox authentication - Get access token
async function getUpstoxAccessToken(): Promise<string> {
  const apiKey = Deno.env.get('UPSTOX_API_KEY');
  const apiSecret = Deno.env.get('UPSTOX_API_SECRET');
  
  if (!apiKey || !apiSecret) {
    throw new Error('Upstox API credentials not configured');
  }
  
  // Note: Upstox requires OAuth 2.0 flow with user authorization
  // For now, we'll use the API key directly for server-to-server calls
  // In production, implement proper OAuth flow
  return apiKey;
}

// Helper function to fetch real stock data from Upstox
async function fetchRealStockData(symbol: string) {
  console.log(`Attempting to fetch data for: ${symbol}`);
  
  try {
    const accessToken = await getUpstoxAccessToken();
    
    // Map symbols to Upstox instrument keys
    let instrumentKey = '';
    
    if (symbol === '^NSEI') {
      instrumentKey = 'NSE_INDEX|Nifty 50';
    } else if (symbol === '^NSEBANK') {
      instrumentKey = 'NSE_INDEX|Nifty Bank';
    } else if (/^\d+$/.test(symbol)) {
      // BSE stock (numerical code)
      instrumentKey = `BSE_EQ|${symbol}`;
    } else {
      // NSE stock (alphabetic symbol)
      const cleanSymbol = symbol.replace('.NS', '').replace('.BO', '');
      instrumentKey = `NSE_EQ|${cleanSymbol}`;
    }
    
    console.log(`Using Upstox instrument key: ${instrumentKey}`);
    
    // Get historical data from Upstox
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    // Format dates as YYYY-MM-DD
    const toDate = endDate.toISOString().split('T')[0];
    const fromDate = startDate.toISOString().split('T')[0];
    
    const url = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(instrumentKey)}/day/${toDate}/${fromDate}`;
    
    console.log(`Upstox API URL: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error(`Upstox API error: ${response.status}`);
      const errorText = await response.text();
      console.error(`Upstox error details: ${errorText}`);
      // Fallback to Yahoo Finance if Upstox fails
      console.log('Falling back to Yahoo Finance...');
      return await fetchYahooFinanceData(symbol);
    }
    
    const data = await response.json();
    console.log(`Upstox response status: ${data.status}`);
    
    if (!data.data?.candles || data.data.candles.length === 0) {
      console.warn('No candle data from Upstox, falling back to Yahoo Finance');
      return await fetchYahooFinanceData(symbol);
    }
    
    console.log(`Fetched ${data.data.candles.length} candles from Upstox`);
    
    // Upstox candle format: [timestamp, open, high, low, close, volume, oi]
    const historicalData = data.data.candles.map((candle: any[]) => ({
      date: new Date(candle[0]).toISOString().split('T')[0],
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
      volume: candle[5]
    })).reverse(); // Upstox returns newest first, we want oldest first
    
    return historicalData;
    
  } catch (error) {
    console.error('Error fetching from Upstox:', error);
    // Fallback to Yahoo Finance
    console.log('Falling back to Yahoo Finance due to error...');
    return await fetchYahooFinanceData(symbol);
  }
}

// Fallback function to fetch from Yahoo Finance
async function fetchYahooFinanceData(symbol: string) {
  console.log(`Fetching from Yahoo Finance for: ${symbol}`);
  
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
    
    // Calculate date range (last 30 days)
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - (30 * 24 * 60 * 60);
    
    // Fetch from Yahoo Finance Chart API
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?period1=${startDate}&period2=${endDate}&interval=1d`;
    
    console.log(`Yahoo Finance URL: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch data for ${symbol} (tried ${yahooSymbol})`);
    }
    
    const data = await response.json();
    const result = data.chart.result[0];
    
    if (!result || !result.timestamp) {
      throw new Error('Invalid stock data received from Yahoo Finance');
    }
    
    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];
    
    const historicalData = timestamps.map((timestamp: number, index: number) => {
      const date = new Date(timestamp * 1000);
      return {
        date: date.toISOString().split('T')[0],
        open: quotes.open[index] || 0,
        high: quotes.high[index] || 0,
        low: quotes.low[index] || 0,
        close: quotes.close[index] || 0,
        volume: quotes.volume[index] || 0
      };
    }).filter((d: any) => d.close > 0); // Filter out invalid entries

    console.log(`Fetched ${historicalData.length} days from Yahoo Finance`);
    return historicalData;
  } catch (error) {
    console.error('Error fetching from Yahoo Finance:', error);
    throw error;
  }
}

// Helper function to calculate technical indicators
function calculateTechnicalIndicators(data: any[]) {
  const closes = data.map(d => d.close);
  const volumes = data.map(d => d.volume);
  const currentPrice = closes[closes.length - 1];

  // Calculate SMAs
  const sma5 = closes.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const sma10 = closes.slice(-10).reduce((a, b) => a + b, 0) / 10;
  const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;

  // Calculate EMA
  const ema10 = calculateEMA(closes, 10);

  // Calculate RSI
  const rsi = calculateRSI(closes, 14);

  // Calculate MACD
  const macd = calculateMACD(closes);

  // Calculate Bollinger Bands
  const bollingerBands = calculateBollingerBands(closes, 20);

  // Calculate volatility
  const returns = closes.slice(1).map((price, i) => Math.log(price / closes[i]));
  const volatility = Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length) * Math.sqrt(252) * 100;

  // Price changes
  const priceChange24h = ((currentPrice - closes[closes.length - 2]) / closes[closes.length - 2]) * 100;
  const priceChange7d = ((currentPrice - closes[closes.length - 7]) / closes[closes.length - 7]) * 100;

  // Support and resistance
  const highs = data.slice(-20).map(d => d.high);
  const lows = data.slice(-20).map(d => d.low);
  const resistanceLevels = [...new Set(highs)].sort((a, b) => b - a).slice(0, 2);
  const supportLevels = [...new Set(lows)].sort((a, b) => a - b).slice(0, 2);

  // Volume analysis
  const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const recentVolume = volumes[volumes.length - 1];
  const volumeVsAvg = ((recentVolume - avgVolume) / avgVolume) * 100;

  // Trend determination
  const shortTrend = sma5 > sma10 ? 'Bullish' : 'Bearish';
  const mediumTrend = sma10 > sma20 ? 'Bullish' : 'Bearish';
  const longTrend = currentPrice > sma20 ? 'Bullish' : 'Bearish';

  return {
    currentPrice,
    sma5,
    sma10,
    sma20,
    ema10,
    rsi,
    macd,
    bollingerBands,
    volatility,
    priceChange24h,
    priceChange7d,
    resistanceLevels,
    supportLevels,
    avgVolume,
    volumeVsAvg,
    volumeTrend: volumeVsAvg > 0 ? 'Increasing' : 'Decreasing',
    shortTrend,
    mediumTrend,
    longTrend
  };
}

function calculateEMA(data: number[], period: number): number {
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  
  return ema;
}

function calculateRSI(data: number[], period: number): number {
  const changes = data.slice(1).map((price, i) => price - data[i]);
  const gains = changes.map(change => change > 0 ? change : 0);
  const losses = changes.map(change => change < 0 ? -change : 0);
  
  const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateMACD(data: number[]) {
  const ema12 = calculateEMA(data, 12);
  const ema26 = calculateEMA(data, 26);
  const macdLine = ema12 - ema26;
  
  const macdData = [];
  for (let i = 26; i < data.length; i++) {
    const ema12Temp = calculateEMA(data.slice(0, i + 1), 12);
    const ema26Temp = calculateEMA(data.slice(0, i + 1), 26);
    macdData.push(ema12Temp - ema26Temp);
  }
  
  const signalLine = calculateEMA(macdData, 9);
  const histogram = macdLine - signalLine;
  
  return {
    macd: macdLine,
    signal: signalLine,
    histogram: histogram
  };
}

function calculateBollingerBands(data: number[], period: number) {
  const sma = data.slice(-period).reduce((a, b) => a + b, 0) / period;
  const squaredDiffs = data.slice(-period).map(price => Math.pow(price - sma, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
  const stdDev = Math.sqrt(variance);
  
  return {
    upper: sma + (2 * stdDev),
    middle: sma,
    lower: sma - (2 * stdDev),
    width: (4 * stdDev / sma) * 100
  };
}
