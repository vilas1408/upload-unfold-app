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
    
    const systemPrompt = `You are an elite options trading strategist with 20+ years of experience in derivatives markets, specializing in Indian stock and index options. You combine advanced options pricing models, volatility analysis, and technical indicators to create high-probability trading strategies.

🎯 OPTIONS TRADING EXPERTISE:
- Deep understanding of option Greeks (Delta, Gamma, Theta, Vega)
- Volatility analysis (IV Rank, IV Percentile, Historical vs Implied Volatility)
- Options strategies (spreads, straddles, strangles, iron condors, butterflies)
- Risk management and position sizing
- Time decay analysis and optimal entry/exit timing
- Understanding of open interest and volume patterns

📊 ANALYSIS FRAMEWORK:

**1. Volatility Assessment:**
- Calculate current IV Rank (0-100 scale)
- Compare Historical Volatility vs Implied Volatility
- Identify if options are relatively cheap or expensive
- Determine if market expects significant moves

**2. Technical Analysis for Options:**
- Identify key support/resistance levels for strike selection
- Analyze trend strength (for directional strategies)
- Volume analysis (for confirmation)
- Price action patterns
- RSI, MACD for momentum confirmation

**3. Strike Price Selection:**
- ATM (At The Money) for maximum leverage
- ITM (In The Money) for higher probability
- OTM (Out of The Money) for speculative plays
- Consider delta (0.30-0.70 for balanced risk/reward)

**4. Strategy Recommendation:**
- Bullish: Buy Calls, Bull Call Spread, Cash-Secured Puts
- Bearish: Buy Puts, Bear Put Spread, Covered Calls
- Neutral: Iron Condor, Butterfly Spread, Calendar Spread
- High Volatility: Sell premium strategies (credit spreads)
- Low Volatility: Buy premium strategies (debit spreads)

**5. Risk Management:**
- Define max loss (limited to premium paid for debit strategies)
- Calculate max gain potential
- Determine breakeven points
- Set stop-loss based on technical levels
- Position sizing (never risk more than 2-5% of capital)

**6. Time Frame Selection:**
- Consider theta decay (time value erosion)
- Weekly options for short-term plays (high risk/reward)
- Monthly options for standard strategies
- LEAPS for long-term directional bets
- Balance between time value and liquidity

🚨 OPTIONS TRADING DISCIPLINE:
1. Options are wasting assets - time decay is constant
2. High leverage means high risk - position sizing is critical
3. IV is mean-reverting - buy when low, sell when high
4. Greeks change as price moves - monitor position dynamically
5. Probability of profit ≠ certainty - manage risk strictly
6. Liquidity matters - check open interest and volume
7. Never hold options till expiry (unless exercising)

📈 PROBABILITY FRAMEWORK (45-75%):
- 70-75%: High IV, clear technical setup, favorable Greeks, strong trend
- 60-69%: Good technical setup, decent IV levels, acceptable Greeks
- 50-59%: Mixed signals, moderate uncertainty, average setup
- 45-49%: High uncertainty, conflicting indicators, risky setup

⚠️ CRITICAL CONSTRAINTS:
- Strike prices must be realistic (ATM ±10% range typically)
- Premium calculations must be logical
- Greeks must follow standard options pricing relationships
- Max loss for debit strategies = premium paid
- Breakeven = Strike ± Premium (for simple strategies)
- Time frames should match volatility environment`;

    const userPrompt = `Analyze ${type === 'share' ? 'stock' : 'index'} options for ${name} (${symbol}) and recommend the BEST options trading strategy with precise parameters.

=== 📈 HISTORICAL PRICE DATA (Last 30 Days) ===
${historicalData.map((d: any) => 
  `${d.date}: Open ₹${d.open.toFixed(2)}, High ₹${d.high.toFixed(2)}, Low ₹${d.low.toFixed(2)}, Close ₹${d.close.toFixed(2)}, Vol: ${d.volume.toLocaleString()}`
).join('\n')}

=== 📊 TECHNICAL ANALYSIS ===
**Current Status:**
• Last Close: ₹${technicalAnalysis.currentPrice.toFixed(2)}
• 24h Change: ${technicalAnalysis.priceChange24h.toFixed(2)}%
• 7d Change: ${technicalAnalysis.priceChange7d.toFixed(2)}%
• Volatility (30d): ${technicalAnalysis.volatility.toFixed(2)}%

**Moving Averages:**
• SMA(5): ₹${technicalAnalysis.sma5.toFixed(2)}
• SMA(10): ₹${technicalAnalysis.sma10.toFixed(2)}
• SMA(20): ₹${technicalAnalysis.sma20.toFixed(2)}

**Momentum:**
• RSI(14): ${technicalAnalysis.rsi.toFixed(2)}
• MACD: ${technicalAnalysis.macd.histogram.toFixed(2)}

**Support/Resistance:**
• Resistance: ${technicalAnalysis.resistanceLevels.map((r: any) => `₹${r.toFixed(2)}`).join(', ')}
• Support: ${technicalAnalysis.supportLevels.map((s: any) => `₹${s.toFixed(2)}`).join(', ')}

=== 🎯 YOUR TASK ===

Provide a SINGLE, COMPREHENSIVE options trading recommendation with:

1. **Strategy Name**: Clear strategy name (e.g., "Bull Call Spread", "Long Call", "Iron Condor")

2. **Strike Price**: Optimal strike price for the recommended strategy

3. **Option Type**: CALL or PUT

4. **Target Price**: Expected underlying price target

5. **Stop Loss**: Price level to exit position

6. **Expected Return**: Realistic percentage return (based on premium)

7. **Probability**: Success probability (45-75% range)

8. **Max Loss**: Maximum possible loss (in ₹)

9. **Max Gain**: Maximum possible gain (in ₹)

10. **Breakeven**: Breakeven price point

11. **Premium Details**: Estimated option premiums for each leg
    - For single options: Single premium value
    - For spreads: Premium for buy leg and sell leg
    - Include net debit/credit

12. **IV Rank**: Estimated Implied Volatility Rank (0-100)

13. **Greeks** (estimated):
    - Delta: 0.00 to 1.00 (rate of change)
    - Gamma: (delta sensitivity)
    - Theta: (daily time decay)
    - Vega: (volatility sensitivity)

14. **Reasoning**: 150-200 word analysis explaining:
    - Why this strategy is optimal
    - Volatility environment assessment
    - Technical setup supporting the trade
    - Risk/reward justification
    - Key price levels to monitor
    - What could go wrong

14. **Risk Level**: Low/Medium/High

15. **Time Frame**: Recommended holding period (e.g., "7-14 days", "1 month", "Weekly expiry")

16. **Technical Score**: 0-10 (based on technical setup quality)

**IMPORTANT:**
- Strike price should be realistic (within ±10% of current price for ATM strategies)
- Calculate realistic premium based on intrinsic value + time value
- For ITM options: Premium = (Current Price - Strike) + Time Value (typically 1-2% of strike)
- For ATM options: Premium ≈ 2-4% of strike price (depending on volatility)
- For OTM options: Premium = Time Value only (1-3% of strike)
- For spreads, specify both buy and sell leg premiums
- Expected return should be achievable (typically 20-100% for debit strategies)
- Greeks should follow standard options relationships
- Max loss for long options = premium paid
- Probability should reflect actual market conditions
- Time frame should match volatility and trend strength

**JSON OUTPUT**:
{
  "strategy": "<strategy name>",
  "strikePrice": "<string describing all strikes>",
  "optionType": "CALL" | "PUT" | "Mixed (Call & Put)",
  "targetPrice": "<string or number>",
  "stopLoss": <number>,
  "expectedReturn": <percentage number>,
  "probability": "<percentage as string>",
  "maxLoss": <number>,
  "maxGain": <number>,
  "breakeven": "<string describing breakeven(s)>",
  "premium": {
    "buyLeg": <number>,
    "sellLeg": <number or null>,
    "netCost": <number>,
    "description": "<string explaining premium structure>"
  },
  "ivRank": <0-100>,
  "greeks": {
    "delta": <number>,
    "gamma": <number>,
    "theta": <number>,
    "vega": <number>
  },
  "reasoning": "<150-200 words>",
  "riskLevel": "Low" | "Medium" | "High",
  "timeFrame": "<string>",
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

// Helper function to fetch real stock data
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
    
    // Calculate date range (last 30 days)
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - (30 * 24 * 60 * 60);
    
    // Fetch from Yahoo Finance Chart API (more reliable than download)
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?period1=${startDate}&period2=${endDate}&interval=1d`;
    
    console.log(`Fetching ${symbol} as ${yahooSymbol} (is numeric: ${/^\d+$/.test(symbol)})`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch data for ${symbol} (tried ${yahooSymbol})`);
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
        open: quotes.open[index] || 0,
        high: quotes.high[index] || 0,
        low: quotes.low[index] || 0,
        close: quotes.close[index] || 0,
        volume: quotes.volume[index] || 0
      };
    }).filter((d: any) => d.close > 0); // Filter out invalid entries

    return historicalData;
  } catch (error) {
    console.error('Error fetching stock data:', error);
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
