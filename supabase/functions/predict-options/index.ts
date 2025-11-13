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
    
    // Get today's date and calculate nearest Thursday expiry for intraday
    const today = new Date();
    const nearestThursday = new Date(today);
    const daysUntilThursday = (4 - today.getDay() + 7) % 7;
    nearestThursday.setDate(today.getDate() + (daysUntilThursday === 0 ? 7 : daysUntilThursday));
    const expiryDate = nearestThursday.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    }).toUpperCase();

    // Determine lot size based on symbol
    let lotSize = 500; // Default for stocks
    if (symbol === 'NIFTY' || symbol === '^NSEI') {
      lotSize = 25;
    } else if (symbol === 'BANKNIFTY' || symbol === '^NSEBANK') {
      lotSize = 15;
    } else if (symbol === 'FINNIFTY') {
      lotSize = 40;
    } else if (symbol === 'MIDCPNIFTY') {
      lotSize = 50;
    }

    const systemPrompt = `You are an elite INTRADAY options trading expert for Indian markets. You provide SIMPLE, DIRECTIONAL intraday options strategies.

🎯 INTRADAY STRATEGY RULES:
- **BULLISH INTRADAY**: Recommend BUY CALL options ONLY
- **BEARISH INTRADAY**: Recommend BUY PUT options ONLY  
- **NO COMPLEX STRATEGIES**: No spreads, straddles, or hedging
- **INTRADAY FOCUS**: Trades to be executed and closed same day
- **LOW PREMIUM FOCUS**: Recommend options with premium ≤ 100-150 rupees per lot to keep risk manageable

📊 INTRADAY ANALYSIS:
**Market Direction (Intraday):**
- Focus on immediate price action and momentum
- Use 5-min and 15-min chart patterns
- RSI for momentum (>70 overbought, <30 oversold)
- Volume surge indicators
- Opening range breakouts

**Strike Selection (Intraday):**
- ATM or 1-2 strikes OTM for quick moves
- Prefer strikes with good liquidity
- Premium should be 50-150 rupees (keeping total cost low)

**Premium & P&L Calculation:**
- Premium per lot: Keep it under ₹100-150 to minimize risk
- Total Investment = Premium × Lot Size
- Profit Calculation = (Exit Premium - Entry Premium) × Lot Size
- Target: 30-50% return on premium (intraday)
- Stop Loss: 20-30% loss on premium (exit quickly)

**Lot Size Information:**
- Nifty 50: 25 lots
- Bank Nifty: 15 lots
- Fin Nifty: 40 lots
- Midcap Nifty: 50 lots
- Individual Stocks: 500 lots (varies by stock)

**Expiry Date:**
- Current Week Expiry: ${expiryDate}
- Focus on current week expiry for intraday trades

🚨 CRITICAL INTRADAY RULES:
- ONE simple trade: Either BUY CALL or BUY PUT
- Exit before 3:15 PM to avoid end-of-day volatility
- Premium must be realistic (₹50-150 range preferred)
- Provide exact P&L calculations with lot size
- Breakeven = Strike + Premium (CALL) OR Strike - Premium (PUT)`;

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

**Provide these details for INTRADAY trade:**

1. **Strategy Name**: MUST be "Long Call" OR "Long Put"

2. **Strike Price**: ATM or 1-2 strikes OTM for quick intraday moves

3. **Option Type**: "CALL" or "PUT"

4. **Expiry Date**: ${expiryDate}

5. **Lot Size**: ${lotSize} units

6. **Premium**: Keep between ₹50-150 per lot (low premium strategy)

7. **Total Investment**: Premium × Lot Size

8. **P&L Calculations**:
   - Target Profit: (Exit Premium - Entry Premium) × Lot Size
   - Stop Loss: (Stop Premium - Entry Premium) × Lot Size (negative)
   - Breakeven: Strike + Premium (CALL) OR Strike - Premium (PUT)

9. **Target Price**: Realistic intraday target

10. **Stop Loss**: Quick exit at 20-30% loss

11. **Expected Return**: 30-50% (intraday realistic)

12. **Probability**: Success probability (50-75%)

13. **Time Frame**: "Intraday (Exit before 3:15 PM)"

14. **Reasoning**: Explain intraday momentum, technical setup, entry/exit timing

15. **Risk Level**: "Low", "Medium", or "High"

16. **Technical Score**: 0-100 (quality of intraday setup)

**JSON OUTPUT FORMAT**:
{
  "strategy": "Long Call" | "Long Put",
  "strikePrice": <number>,
  "optionType": "CALL" | "PUT",
  "expiryDate": "${expiryDate}",
  "lotSize": ${lotSize},
  "premium": {
    "buyLeg": <number 50-150>,
    "sellLeg": null,
    "netCost": <number 50-150>,
    "description": "<brief explanation>"
  },
  "totalInvestment": <premium × lotSize>,
  "profitLoss": {
    "target": <(target premium - entry premium) × lotSize>,
    "stopLoss": <(stop loss premium - entry premium) × lotSize, negative value>,
    "breakeven": <strike + premium (CALL) or strike - premium (PUT)>
  },
  "targetPrice": <number>,
  "stopLoss": <number>,
  "expectedReturn": <30-50 for intraday>,
  "probability": "<percentage>%",
  "maxLoss": <equals totalInvestment>,
  "maxGain": <realistic based on target>,
  "breakeven": <strike + premium (CALL) or strike - premium (PUT)>,
  "ivRank": <0-100>,
  "greeks": {
    "delta": <0.40-0.60>,
    "gamma": <small positive>,
    "theta": <negative>,
    "vega": <positive>
  },
  "reasoning": "<Explain intraday trend, technical setup, entry/exit timing, exit before 3:15 PM>",
  "riskLevel": "Low" | "Medium" | "High",
  "timeFrame": "Intraday (Exit before 3:15 PM)",
  "technicalScore": <0-100>
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
