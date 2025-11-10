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
    
    // Get current date for dynamic expiry calculation
    const currentDate = new Date();
    const daysToAdd = 7; // Next weekly expiry (7 days)
    const expiryDate = new Date(currentDate);
    expiryDate.setDate(currentDate.getDate() + daysToAdd);
    const formattedExpiry = expiryDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-').toUpperCase();
    
    const systemPrompt = `You are an elite options trading expert specializing in Indian stock and index options. You provide TWO-LEG SPREAD STRATEGIES with LOW PREMIUM cost based on real-time market data.

🎯 YOUR STRATEGY RULES:
- **RECOMMEND TWO-LEG SPREAD STRATEGIES** to minimize premium cost
- **BULLISH MARKET**: Bull Call Spread (Buy lower strike CALL + Sell higher strike CALL)
- **BEARISH MARKET**: Bear Put Spread (Buy higher strike PUT + Sell lower strike PUT)
- **LOW PREMIUM FOCUS**: Net premium should be 0.5-2% of strike price (very affordable)
- **EXPIRY**: Use NEAREST weekly expiry (${formattedExpiry})

📊 ANALYSIS FRAMEWORK:

**1. Market Direction Analysis:**
- Use moving averages (SMA5, SMA10, SMA20) to determine trend
- RSI for momentum (>70 overbought, <30 oversold)
- MACD for trend confirmation
- Price action and volume patterns
- Support/resistance levels

**2. Decision Logic:**
- If price > SMA20 AND RSI < 70 AND MACD positive → BULLISH → Bull Call Spread
- If price < SMA20 AND RSI > 30 AND MACD negative → BEARISH → Bear Put Spread
- Strong uptrend (SMA5 > SMA10 > SMA20) → BULLISH → Bull Call Spread
- Strong downtrend (SMA5 < SMA10 < SMA20) → BEARISH → Bear Put Spread

**3. Strike Price Selection (Two Legs):**
FOR BULL CALL SPREAD (Bullish):
- BUY LEG: ATM or slightly OTM Call (premium: 1.5-2.5% of strike)
- SELL LEG: Further OTM Call, 3-5% above buy strike (premium: 0.8-1.5% of strike)
- NET COST: Buy premium - Sell premium = 0.5-1.5% of strike (LOW PREMIUM!)

FOR BEAR PUT SPREAD (Bearish):
- BUY LEG: ATM or slightly OTM Put (premium: 1.5-2.5% of strike)
- SELL LEG: Further OTM Put, 3-5% below buy strike (premium: 0.8-1.5% of strike)
- NET COST: Buy premium - Sell premium = 0.5-1.5% of strike (LOW PREMIUM!)

**4. Lot Size (Indian Options):**
- Nifty: 25 shares per lot
- Bank Nifty: 15 shares per lot
- Stock Options: 1 lot (check NSE/BSE for specific stock lot sizes, typically 500-1000)
- Calculate total investment: Net Premium × Lot Size

**5. Risk Management:**
- Max loss = Net Premium paid × Lot Size
- Max gain = (Difference between strikes - Net Premium) × Lot Size
- Target return: 50-100% of net premium
- Stop loss: Exit if premium drops 50%
- Time frame: 7 days (nearest weekly expiry)

📈 PROBABILITY FRAMEWORK:
- 65-75%: Strong trend, clear momentum, good technical setup
- 55-64%: Moderate trend, decent indicators
- 45-54%: Weak signals, mixed indicators

🚨 CRITICAL RULES:
- ALWAYS use TWO-LEG spread strategies
- Premium must be LOW (net cost 0.5-2% of strike)
- Use NEAREST weekly expiry: ${formattedExpiry}
- Include lot size in all calculations
- Breakeven = Buy Strike + Net Premium (CALL SPREAD) OR Buy Strike - Net Premium (PUT SPREAD)`;

    const userPrompt = `Analyze ${type === 'share' ? 'stock' : 'index'} options for ${name} (${symbol}) and provide a TWO-LEG SPREAD STRATEGY with LOW PREMIUM cost based on current live market data.

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

Based on the LIVE data above, provide ONE two-leg spread strategy with LOW PREMIUM cost:

**IF BULLISH (uptrend detected):**
- Strategy: "Bull Call Spread"
- BUY CALL at lower strike (ATM or slightly OTM)
- SELL CALL at higher strike (3-5% above)
- Action Signal: "BUY CALL SPREAD"

**IF BEARISH (downtrend detected):**
- Strategy: "Bear Put Spread"
- BUY PUT at higher strike (ATM or slightly OTM)
- SELL PUT at lower strike (3-5% below)
- Action Signal: "BUY PUT SPREAD"

**Provide these details:**

1. **Strategy Name**: MUST be "Bull Call Spread" OR "Bear Put Spread"

2. **Strike Price**: Display the BUY leg strike price (format: "₹<number>")

3. **Option Type**: "CALL" for Bull Call Spread, "PUT" for Bear Put Spread

4. **Expiry Date**: Use NEAREST weekly expiry: "${formattedExpiry}"

5. **Entry Price**: Net premium cost per share (Buy premium - Sell premium, in ₹)

6. **Target Price**: Expected underlying price target (in ₹)

7. **Stop Loss**: Exit underlying price if trade goes wrong (in ₹)

8. **Expected Return**: 50-100% of net premium (as percentage number without % symbol)

9. **Probability**: Success probability (45-75%)

10. **Max Loss**: Net premium × Lot Size (in ₹)

11. **Max Gain**: (Strike difference - Net premium) × Lot Size (in ₹)

12. **Breakeven**: Buy Strike ± Net Premium (format: "₹<number>")

13. **Premium Details**:
    - buyLeg: Premium paid for BUY leg (₹ per share)
    - sellLeg: Premium received for SELL leg (₹ per share)
    - netCost: buyLeg - sellLeg (should be LOW: 0.5-2% of strike)
    - description: "Bull Call Spread: Buy <strike1> Call @ ₹X, Sell <strike2> Call @ ₹Y, Net Cost: ₹Z per share"

14. **Lot Size**: 
    - Nifty: 25
    - Bank Nifty: 15
    - Stocks: 500-1000 (use 500 as default)

15. **Total Investment**: Net premium × Lot Size (in ₹)

16. **IV Rank**: 0-100 (estimated volatility rank)

17. **Greeks** (net position):
    - delta: 0.20-0.40 (lower for spreads)
    - gamma: Small positive number
    - theta: Slightly negative (less decay than single leg)
    - vega: Lower sensitivity (spread reduces vega)

18. **Reasoning**: 150-200 words explaining:
    - Market direction (bullish/bearish) based on live data
    - Why two-leg spread reduces cost
    - Technical indicators supporting the trade
    - Strike selection and net premium calculation
    - Risk and reward with lot size
    - Key price levels to watch

19. **Risk Level**: "Low" or "Medium" (spreads are lower risk)

20. **Time Frame**: "7 days" (weekly expiry)

21. **Technical Score**: 0-10 (quality of setup)

22. **Action Signal**: "BUY CALL SPREAD" or "BUY PUT SPREAD"

**JSON OUTPUT FORMAT**:
{
  "strategy": "Bull Call Spread" | "Bear Put Spread",
  "actionSignal": "BUY CALL SPREAD" | "BUY PUT SPREAD",
  "strikePrice": "₹<buy_leg_strike>",
  "sellStrike": "₹<sell_leg_strike>",
  "optionType": "CALL" | "PUT",
  "expiryDate": "${formattedExpiry}",
  "entryPrice": <net_premium_per_share>,
  "targetPrice": <underlying_target>,
  "stopLoss": <underlying_stop>,
  "expectedReturn": <percentage_without_symbol>,
  "probability": "<percentage>%",
  "maxLoss": <net_premium_times_lot>,
  "maxGain": <max_profit_with_lot>,
  "breakeven": "₹<breakeven_price>",
  "premium": {
    "buyLeg": <buy_premium_per_share>,
    "sellLeg": <sell_premium_per_share>,
    "netCost": <buyLeg_minus_sellLeg>,
    "description": "<strategy explanation with strikes and premiums>"
  },
  "lotSize": <25_or_15_or_500>,
  "totalInvestment": <netCost_times_lotSize>,
  "ivRank": <0-100>,
  "greeks": {
    "delta": <0.20-0.40>,
    "gamma": <small_positive>,
    "theta": <slightly_negative>,
    "vega": <low_positive>
  },
  "reasoning": "<150-200_words>",
  "riskLevel": "Low" | "Medium",
  "timeFrame": "7 days",
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
