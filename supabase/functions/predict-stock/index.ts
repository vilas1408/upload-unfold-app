import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, companyName } = await req.json();
    
    if (!symbol || !companyName) {
      throw new Error('Symbol and companyName are required');
    }
    
    console.log('🔍 Professional stock analysis for:', symbol, companyName);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Fetch historical data
    const historicalData = await fetchStockData(symbol);
    
    // Calculate advanced technicals
    const technicals = calculateAdvancedTechnicals(historicalData);
    
    // Fetch news sentiment using Lovable AI
    let newsSentiment = { overall: 'neutral', summary: 'No recent news available', articles: [] };
    
    try {
      const newsPrompt = `Search for recent news (last 3 days) about ${companyName} (${symbol}) Indian stock. Analyze the sentiment and return JSON:
{
  "overall": "positive" | "negative" | "neutral",
  "summary": "brief summary of news sentiment",
  "articles": [{"title": "string", "sentiment": "positive/negative/neutral", "impact": "high/medium/low"}]
}`;

      const newsResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LOVABLE_API_KEY}`
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: newsPrompt }],
        }),
      });

      if (newsResponse.ok) {
        const newsData = await newsResponse.json();
        const content = newsData.choices?.[0]?.message?.content;
        if (content) {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            newsSentiment = JSON.parse(jsonMatch[0]);
          }
        }
      }
    } catch (error) {
      console.error('News sentiment error:', error);
    }

    // Professional AI prompt
    const systemPrompt = `You are a SENIOR INDIAN STOCK MARKET RESEARCH ANALYST with 25 years of experience at a top domestic brokerage. You have worked with institutional desks, mutual funds, and proprietary trading firms.

YOUR EXPERTISE:
- Deep understanding of NSE/BSE market microstructure
- FII/DII flow analysis and impact assessment
- RBI policy impact on banking and NBFC stocks
- Sector rotation and thematic investing
- Corporate governance and promoter behavior analysis
- Event-driven trading (earnings, AGMs, corporate actions)

YOUR COMMUNICATION STYLE:
- Professional, crisp, research-report language
- NO vague statements like "might go up or down"
- NO disclaimers like "I'm just an AI"
- ALWAYS provide specific price levels with reasoning
- ALWAYS give a clear BUY / HOLD / SELL recommendation
- Use industry terminology appropriately`;

    const userPrompt = `Analyze ${companyName} (${symbol}) for trading.

## STOCK DATA
- Current Price: ₹${technicals.currentPrice}
- Previous Close: ₹${technicals.previousClose}
- Day Change: ${technicals.dayChange}%
- 52-Week High: ₹${technicals.high52Week}
- 52-Week Low: ₹${technicals.low52Week}

## TECHNICAL INDICATORS
- Trend: ${technicals.trend} (Strength: ${technicals.trendStrength})
- RSI (14): ${technicals.rsi} - ${technicals.rsiSignal}
- MACD: ${technicals.macd.value} | Signal: ${technicals.macd.signal} | Histogram: ${technicals.macd.histogram} | Status: ${technicals.macd.status}
- ADX: ${technicals.adx} (${technicals.adxInterpretation})
- Stochastic: %K=${technicals.stochastic.k} | %D=${technicals.stochastic.d} | ${technicals.stochastic.signal}
- 20 DMA: ₹${technicals.sma20} | 50 DMA: ₹${technicals.sma50} | 100 DMA: ₹${technicals.sma100} | 200 DMA: ₹${technicals.sma200}
- EMA 12: ₹${technicals.ema12} | EMA 26: ₹${technicals.ema26}
- Bollinger Bands: Upper ₹${technicals.bollingerBands.upper} | Middle ₹${technicals.bollingerBands.middle} | Lower ₹${technicals.bollingerBands.lower}
- Bollinger Position: ${technicals.bollingerBands.position}
- ATR (14): ₹${technicals.atr}
- Volume vs 20-day Avg: ${technicals.volumeRatio}x
- Volume Signal: ${technicals.volumeSignal}

## SUPPORT & RESISTANCE
- Pivot: ₹${technicals.pivotPoints.pivot}
- R1: ₹${technicals.pivotPoints.r1} | R2: ₹${technicals.pivotPoints.r2}
- S1: ₹${technicals.pivotPoints.s1} | S2: ₹${technicals.pivotPoints.s2}
- Fibonacci 38.2%: ₹${technicals.fibonacci.fib38}
- Fibonacci 50%: ₹${technicals.fibonacci.fib50}
- Fibonacci 61.8%: ₹${technicals.fibonacci.fib61}

## NEWS SENTIMENT
- Overall: ${newsSentiment.overall}
- Summary: ${newsSentiment.summary}
- Key Articles: ${JSON.stringify(newsSentiment.articles)}

Provide a comprehensive professional research report as JSON:
{
  "marketContext": "<2 sentences on current Indian market conditions, Nifty trend, sector outlook>",
  "technicalOutlook": "<detailed technical analysis with key levels>",
  "fundamentalView": "<valuation and growth assessment based on available data>",
  "recommendation": {
    "action": "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL",
    "entryPrice": <optimal entry price>,
    "target1": <first target>,
    "target2": <second target>,
    "stopLoss": <stop loss level>,
    "holdingPeriod": "<suggested holding period>",
    "reasoning": "<crisp reasoning for recommendation>"
  },
  "forecasts": {
    "shortTerm": {
      "timeframe": "1-7 Days",
      "bias": "Bullish" | "Bearish" | "Neutral",
      "target": <price target>,
      "support": <support level>,
      "stopLoss": <stop loss>,
      "probability": <0-100>,
      "keyDrivers": ["<driver1>", "<driver2>"]
    },
    "mediumTerm": {
      "timeframe": "1-3 Months",
      "bias": "Bullish" | "Bearish" | "Neutral",
      "target": <price target>,
      "support": <support level>,
      "stopLoss": <stop loss>,
      "probability": <0-100>,
      "keyDrivers": ["<driver1>", "<driver2>"]
    },
    "longTerm": {
      "timeframe": "6-12 Months",
      "bias": "Bullish" | "Bearish" | "Neutral",
      "target": <price target>,
      "support": <support level>,
      "stopLoss": <stop loss>,
      "probability": <0-100>,
      "keyDrivers": ["<driver1>", "<driver2>"]
    }
  },
  "scenarios": {
    "bullCase": {
      "probability": <0-100>,
      "targetPrice": <price>,
      "percentChange": <percentage>,
      "catalyst": "<what triggers this scenario>",
      "conditions": ["<condition1>", "<condition2>"]
    },
    "baseCase": {
      "probability": <0-100>,
      "targetPrice": <price>,
      "percentChange": <percentage>,
      "catalyst": "<what triggers this scenario>",
      "conditions": ["<condition1>", "<condition2>"]
    },
    "bearCase": {
      "probability": <0-100>,
      "targetPrice": <price>,
      "percentChange": <percentage>,
      "catalyst": "<what triggers this scenario>",
      "conditions": ["<condition1>", "<condition2>"]
    }
  },
  "riskFactors": ["<risk1>", "<risk2>", "<risk3>"],
  "riskLevel": "Low" | "Medium" | "High",
  "confidence": <0-100>,
  "openingPrice": <predicted opening price for tomorrow>,
  "closingPrice": <predicted closing price for tomorrow>,
  "direction": "up" | "down" | "sideways",
  "reason": "<comprehensive analysis paragraph>",
  "trendAlignment": "bullish" | "bearish" | "neutral",
  "technicalScore": <0-6>,
  "predictionDate": "<tomorrow's date YYYY-MM-DD>"
}

Use ₹ symbol for all prices. Be specific with numbers. No vague language.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
      })
    });

    if (!aiResponse.ok) {
      const errorData = await aiResponse.json();
      console.error('Lovable AI error:', aiResponse.status, errorData);
      
      let errorMessage = 'Failed to generate prediction. Please try again.';
      
      if (aiResponse.status === 429) {
        errorMessage = 'Rate limit reached. Please wait a moment and try again.';
      } else if (aiResponse.status === 402) {
        errorMessage = 'Payment required. Please add funds to your Lovable workspace.';
      } else if (aiResponse.status === 400) {
        errorMessage = 'Invalid request to AI service.';
      } else if (errorData.error?.message) {
        errorMessage = errorData.error.message;
      }
      
      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { status: aiResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No response from AI');
    }
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('Could not parse AI response');
    }

    const prediction = JSON.parse(jsonMatch[0]);

    // Calculate next trading day (skip weekends)
    const today = new Date();
    let nextDay = new Date(today);
    nextDay.setDate(nextDay.getDate() + 1);
    
    while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
      nextDay.setDate(nextDay.getDate() + 1);
    }
    
    prediction.predictionDate = nextDay.toISOString().split('T')[0];
    prediction.newsSentiment = newsSentiment;
    prediction.technicals = technicals;

    return new Response(
      JSON.stringify({ success: true, prediction, historicalData, technicals }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function fetchStockData(symbol: string) {
  try {
    let yahooSymbol = symbol;
    if (!symbol.includes('.') && !symbol.startsWith('^')) {
      yahooSymbol = /^\d+$/.test(symbol) ? `${symbol}.BO` : `${symbol}.NS`;
    }
    
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - (100 * 24 * 60 * 60); // 100 days for better analysis
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?period1=${startDate}&period2=${endDate}&interval=1d`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch data');
    
    const data = await response.json();
    const result = data.chart.result[0];
    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];
    
    return timestamps.map((ts: number, i: number) => ({
      date: new Date(ts * 1000).toISOString().split('T')[0],
      open: quotes.open[i] || 0,
      high: quotes.high[i] || 0,
      low: quotes.low[i] || 0,
      close: quotes.close[i] || 0,
      volume: quotes.volume[i] || 0
    })).filter((d: any) => d.close > 0);
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}

function calculateAdvancedTechnicals(data: any[]) {
  const closes = data.map(d => d.close);
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const volumes = data.map(d => d.volume);
  
  const currentPrice = closes[closes.length - 1];
  const previousClose = closes[closes.length - 2] || currentPrice;
  const dayChange = ((currentPrice - previousClose) / previousClose * 100).toFixed(2);
  
  // 52-week high/low
  const high52Week = Math.max(...highs.slice(-252));
  const low52Week = Math.min(...lows.slice(-252));
  
  // RSI (14)
  const rsi = calculateRSI(closes, 14);
  let rsiSignal = 'Neutral';
  if (rsi > 70) rsiSignal = 'Overbought - Potential reversal';
  else if (rsi > 60) rsiSignal = 'Strong momentum';
  else if (rsi < 30) rsiSignal = 'Oversold - Potential bounce';
  else if (rsi < 40) rsiSignal = 'Weak momentum';
  
  // Moving Averages
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const sma100 = calculateSMA(closes, 100);
  const sma200 = closes.length >= 200 ? calculateSMA(closes, 200) : sma100;
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  
  // MACD
  const macdLine = ema12 - ema26;
  const signalLine = calculateEMA([...Array(26).fill(0), macdLine], 9);
  const histogram = macdLine - signalLine;
  const macdStatus = macdLine > signalLine ? 'Bullish crossover' : 'Bearish crossover';
  
  // ADX
  const adx = calculateADX(highs, lows, closes, 14);
  let adxInterpretation = 'Weak trend';
  if (adx > 40) adxInterpretation = 'Very strong trend';
  else if (adx > 25) adxInterpretation = 'Strong trend';
  else if (adx > 20) adxInterpretation = 'Moderate trend';
  
  // Stochastic
  const stochastic = calculateStochastic(highs, lows, closes, 14, 3);
  let stochSignal = 'Neutral';
  if (stochastic.k > 80 && stochastic.d > 80) stochSignal = 'Overbought';
  else if (stochastic.k < 20 && stochastic.d < 20) stochSignal = 'Oversold';
  else if (stochastic.k > stochastic.d) stochSignal = 'Bullish momentum';
  else stochSignal = 'Bearish momentum';
  
  // Bollinger Bands
  const bbMiddle = sma20;
  const stdDev = calculateStdDev(closes.slice(-20));
  const bbUpper = bbMiddle + (stdDev * 2);
  const bbLower = bbMiddle - (stdDev * 2);
  let bbPosition = 'Middle band';
  if (currentPrice > bbUpper) bbPosition = 'Above upper band - Overbought';
  else if (currentPrice < bbLower) bbPosition = 'Below lower band - Oversold';
  else if (currentPrice > bbMiddle) bbPosition = 'Upper half - Bullish';
  else bbPosition = 'Lower half - Bearish';
  
  // ATR
  const atr = calculateATR(highs, lows, closes, 14);
  
  // Volume analysis
  const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const currentVolume = volumes[volumes.length - 1];
  const volumeRatio = (currentVolume / avgVolume).toFixed(2);
  let volumeSignal = 'Normal volume';
  if (parseFloat(volumeRatio) > 2) volumeSignal = 'Very high volume - Strong interest';
  else if (parseFloat(volumeRatio) > 1.5) volumeSignal = 'Above average - Increased activity';
  else if (parseFloat(volumeRatio) < 0.5) volumeSignal = 'Low volume - Weak conviction';
  
  // Pivot Points
  const lastHigh = highs[highs.length - 1];
  const lastLow = lows[lows.length - 1];
  const lastClose = closes[closes.length - 1];
  const pivot = (lastHigh + lastLow + lastClose) / 3;
  const r1 = (2 * pivot) - lastLow;
  const r2 = pivot + (lastHigh - lastLow);
  const s1 = (2 * pivot) - lastHigh;
  const s2 = pivot - (lastHigh - lastLow);
  
  // Fibonacci levels
  const recentHigh = Math.max(...highs.slice(-30));
  const recentLow = Math.min(...lows.slice(-30));
  const fibRange = recentHigh - recentLow;
  const fib38 = recentHigh - (fibRange * 0.382);
  const fib50 = recentHigh - (fibRange * 0.5);
  const fib61 = recentHigh - (fibRange * 0.618);
  
  // Trend determination
  let trend = 'Neutral';
  let trendStrength = 'Moderate';
  let bullishSignals = 0;
  let bearishSignals = 0;
  
  if (currentPrice > sma20) bullishSignals++;
  if (currentPrice > sma50) bullishSignals++;
  if (currentPrice > sma200) bullishSignals++;
  if (rsi > 50) bullishSignals++;
  if (macdLine > signalLine) bullishSignals++;
  
  if (currentPrice < sma20) bearishSignals++;
  if (currentPrice < sma50) bearishSignals++;
  if (currentPrice < sma200) bearishSignals++;
  if (rsi < 50) bearishSignals++;
  if (macdLine < signalLine) bearishSignals++;
  
  if (bullishSignals >= 4) { trend = 'Bullish'; trendStrength = adx > 25 ? 'Strong' : 'Moderate'; }
  else if (bearishSignals >= 4) { trend = 'Bearish'; trendStrength = adx > 25 ? 'Strong' : 'Moderate'; }
  else { trend = 'Neutral'; trendStrength = 'Weak'; }
  
  return {
    currentPrice: round(currentPrice),
    previousClose: round(previousClose),
    dayChange,
    high52Week: round(high52Week),
    low52Week: round(low52Week),
    trend,
    trendStrength,
    rsi: Math.round(rsi),
    rsiSignal,
    sma20: round(sma20),
    sma50: round(sma50),
    sma100: round(sma100),
    sma200: round(sma200),
    ema12: round(ema12),
    ema26: round(ema26),
    macd: {
      value: round(macdLine),
      signal: round(signalLine),
      histogram: round(histogram),
      status: macdStatus,
    },
    adx: Math.round(adx),
    adxInterpretation,
    stochastic: {
      k: Math.round(stochastic.k),
      d: Math.round(stochastic.d),
      signal: stochSignal,
    },
    bollingerBands: {
      upper: round(bbUpper),
      middle: round(bbMiddle),
      lower: round(bbLower),
      position: bbPosition,
    },
    atr: round(atr),
    volumeRatio,
    volumeSignal,
    pivotPoints: {
      pivot: round(pivot),
      r1: round(r1),
      r2: round(r2),
      s1: round(s1),
      s2: round(s2),
    },
    fibonacci: {
      fib38: round(fib38),
      fib50: round(fib50),
      fib61: round(fib61),
    },
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function calculateRSI(closes: number[], period: number): number {
  if (closes.length < period + 1) return 50;
  
  const changes = closes.slice(1).map((p, i) => p - closes[i]);
  const gains = changes.map(c => c > 0 ? c : 0);
  const losses = changes.map(c => c < 0 ? -c : 0);
  
  const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateSMA(data: number[], period: number): number {
  if (data.length < period) return data[data.length - 1] || 0;
  return data.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function calculateEMA(data: number[], period: number): number {
  if (data.length < period) return calculateSMA(data, data.length);
  
  const multiplier = 2 / (period + 1);
  let ema = calculateSMA(data.slice(0, period), period);
  
  for (let i = period; i < data.length; i++) {
    ema = (data[i] - ema) * multiplier + ema;
  }
  
  return ema;
}

function calculateStdDev(data: number[]): number {
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const squaredDiffs = data.map(x => Math.pow(x - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / data.length);
}

function calculateATR(highs: number[], lows: number[], closes: number[], period: number): number {
  if (highs.length < period + 1) return (highs[highs.length - 1] - lows[lows.length - 1]);
  
  const trueRanges = [];
  for (let i = 1; i < highs.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trueRanges.push(tr);
  }
  
  return trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function calculateADX(highs: number[], lows: number[], closes: number[], period: number): number {
  if (highs.length < period * 2) return 25;
  
  // Simplified ADX calculation
  const changes = closes.slice(1).map((c, i) => Math.abs(c - closes[i]));
  const avgChange = changes.slice(-period).reduce((a, b) => a + b, 0) / period;
  const range = Math.max(...highs.slice(-period)) - Math.min(...lows.slice(-period));
  
  if (range === 0) return 25;
  return Math.min(50, (avgChange / range) * 100 * period);
}

function calculateStochastic(highs: number[], lows: number[], closes: number[], kPeriod: number, dPeriod: number): { k: number; d: number } {
  if (closes.length < kPeriod) return { k: 50, d: 50 };
  
  const recentHighs = highs.slice(-kPeriod);
  const recentLows = lows.slice(-kPeriod);
  const currentClose = closes[closes.length - 1];
  
  const highestHigh = Math.max(...recentHighs);
  const lowestLow = Math.min(...recentLows);
  
  if (highestHigh === lowestLow) return { k: 50, d: 50 };
  
  const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
  const d = k; // Simplified
  
  return { k, d };
}
