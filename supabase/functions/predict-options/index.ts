import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

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

    // Fetch historical data
    const historicalData = await fetchStockData(symbol);
    const analysis = analyzeData(historicalData);
    
    // Fetch news sentiment using Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    let newsSentiment = { overall: 'neutral', summary: 'No recent news available', articles: [] };
    
    if (LOVABLE_API_KEY) {
      try {
        const newsResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: 'You are a financial news analyst. Search for and analyze recent news about the given stock. Return ONLY valid JSON.'
              },
              {
                role: 'user',
                content: `Search for recent news (last 3 days) about ${name} (${symbol}). Analyze the sentiment and return JSON:
{
  "overall": "positive" | "negative" | "neutral",
  "summary": "brief summary of news sentiment",
  "articles": [{"title": "string", "sentiment": "positive/negative/neutral", "impact": "high/medium/low"}]
}`
              }
            ],
            temperature: 0.3,
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
    }
    
    // Calculate expiry date based on option type
    const today = new Date();
    let expiryDate: string;
    let expiryDateISO: string;
    
    if (type === 'index') {
      // Indices have weekly expiry on Tuesday (as per NSE circular effective Aug 28, 2025)
      const currentDay = today.getDay(); // 0 = Sunday, 2 = Tuesday
      let daysUntilTuesday;
      
      if (currentDay <= 2) {
        // If today is Sun-Tue, get this Tuesday
        daysUntilTuesday = 2 - currentDay;
      } else {
        // If today is Wed-Sat, get next Tuesday
        daysUntilTuesday = 7 - currentDay + 2;
      }
      
      const tuesday = new Date(today);
      tuesday.setDate(today.getDate() + daysUntilTuesday);
      expiryDate = tuesday.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
      }).toUpperCase();
      expiryDateISO = tuesday.toISOString().split('T')[0];
    } else {
      // Shares have monthly expiry on last Thursday of the month
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      
      // Get last day of current month
      const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
      const lastDay = lastDayOfMonth.getDate();
      
      // Find last Thursday of the month
      let lastThursday = null;
      for (let day = lastDay; day >= 1; day--) {
        const checkDate = new Date(currentYear, currentMonth, day);
        if (checkDate.getDay() === 4) { // 4 = Thursday
          lastThursday = checkDate;
          break;
        }
      }
      
      // If last Thursday already passed or is today, get next month's last Thursday
      if (!lastThursday || lastThursday <= today) {
        const nextMonth = currentMonth + 1;
        const nextYear = nextMonth > 11 ? currentYear + 1 : currentYear;
        const adjustedMonth = nextMonth > 11 ? 0 : nextMonth;
        
        const lastDayOfNextMonth = new Date(nextYear, adjustedMonth + 1, 0);
        const lastDayNext = lastDayOfNextMonth.getDate();
        
        for (let day = lastDayNext; day >= 1; day--) {
          const checkDate = new Date(nextYear, adjustedMonth, day);
          if (checkDate.getDay() === 4) { // 4 = Thursday
            lastThursday = checkDate;
            break;
          }
        }
      }
      
      expiryDate = lastThursday!.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
      }).toUpperCase();
      expiryDateISO = lastThursday!.toISOString().split('T')[0];
    }

    // Determine lot size (as per NSE Circular - updated Nov 2025)
    let lotSize = 500;
    let upstoxSymbol = '';
    if (symbol === 'NIFTY' || symbol === '^NSEI') {
      lotSize = 75;
      upstoxSymbol = 'NSE_INDEX|Nifty 50';
    } else if (symbol === 'BANKNIFTY' || symbol === '^NSEBANK') {
      lotSize = 35;
      upstoxSymbol = 'NSE_INDEX|Nifty Bank';
    } else if (symbol === 'FINNIFTY') {
      lotSize = 40;
      upstoxSymbol = 'NSE_INDEX|Nifty Fin Service';
    } else if (symbol === 'MIDCPNIFTY') {
      lotSize = 140;
      upstoxSymbol = 'NSE_INDEX|NIFTY MID SELECT';
    }

    // Use AI prediction with Yahoo Finance data
    console.log('Generating AI prediction with Yahoo Finance data');
    
    const GOOGLE_GEMINI_API_KEY = Deno.env.get('GOOGLE_GEMINI_API_KEY');
    if (!GOOGLE_GEMINI_API_KEY) {
      throw new Error('GOOGLE_GEMINI_API_KEY is not configured');
    }
    
    // Calculate expected premium range based on stock price
    const expectedPremiumMin = Math.round(analysis.current * 0.02); // 2% of stock price
    const expectedPremiumMax = Math.round(analysis.current * 0.05); // 5% of stock price
    const expectedPremiumMid = Math.round(analysis.current * 0.035); // 3.5% typical ATM premium
    
    const systemPrompt = `You are an options trading expert. Provide SIMPLE INTRADAY options strategies with EXACT PRICE LEVELS.
    
RULES:
- BULLISH: Recommend BUY CALL only
- BEARISH: Recommend BUY PUT only
- Stock Price: ₹${analysis.current}
- Premium must be realistic: ₹${expectedPremiumMin}-${expectedPremiumMax} per lot (2-5% of stock price)
- For ATM options: Around ₹${expectedPremiumMid} per lot
- For OTM options: Slightly lower (₹${expectedPremiumMin}-${Math.round(expectedPremiumMid * 0.9)} per lot)
- For ITM options: Slightly higher (₹${Math.round(expectedPremiumMid * 1.1)}-${expectedPremiumMax} per lot)
- Expiry: ${expiryDate}
- Lot Size: ${lotSize}
- Provide SPECIFIC entry, target, and stop loss prices
- Premium MUST scale with stock price - DO NOT use generic values`;

    const userPrompt = `Analyze ${name} (${symbol}). Current Price: ₹${analysis.current}, RSI: ${analysis.rsi}, Trend: ${analysis.trend}

News Sentiment Analysis:
Overall Sentiment: ${newsSentiment.overall}
Summary: ${newsSentiment.summary}
Articles: ${JSON.stringify(newsSentiment.articles)}

CRITICAL PREMIUM CALCULATION GUIDELINES:
- Stock trading at ₹${analysis.current}
- ATM option premium should be around ₹${expectedPremiumMid} per lot (3.5% of stock price)
- Valid premium range: ₹${expectedPremiumMin}-${expectedPremiumMax} per lot
- DO NOT use generic values like ₹50, ₹100, ₹150 for all stocks
- Premium MUST be proportional to the stock price
- Higher stock price = Higher premium (e.g., ₹1500 stock needs ₹45-75 premium, not ₹100)
- Lower stock price = Lower premium (e.g., ₹500 stock needs ₹15-25 premium, not ₹100)

Provide realistic options strategy with EXACT PRICES based on ₹${analysis.current} stock price:
{
  "strategy": "Long Call" | "Long Put",
  "strikePrice": <realistic strike near ₹${analysis.current}>,
  "optionType": "CALL" | "PUT",
  "expiryDate": "${expiryDate}",
  "lotSize": ${lotSize},
  "premium": {
    "buyLeg": <MUST be between ₹${expectedPremiumMin}-${expectedPremiumMax}, typically around ₹${expectedPremiumMid} for ATM>,
    "sellLeg": null,
    "netCost": <same as buyLeg>,
    "targetPremium": <buyLeg + 20-50% gain, realistic for intraday>,
    "stopLossPremium": <buyLeg - 25-40% loss>,
    "description": "Premium per lot for entry"
  },
  "totalInvestment": <buyLeg × lotSize>,
  "entryPrice": <strikePrice for entry>,
  "targetExitPrice": <realistic target price for profit>,
  "stopLossPrice": <realistic stop loss price>,
  "profitLoss": {
    "target": <profit amount in rupees>,
    "stopLoss": <loss amount as negative>,
    "breakeven": <strike ± premium>
  },
  "expectedReturn": <30-50 percentage>,
  "probability": "<40-70>%",
  "maxLoss": <totalInvestment>,
  "maxGain": <realistic gain in rupees>,
  "breakeven": <strike ± premium>,
  "ivRank": <0-100>,
  "greeks": {"delta": <0.4-0.6>, "gamma": <0.01-0.05>, "theta": <-10 to -50>, "vega": <50-150>},
  "reasoning": "Brief analysis (2-3 lines) including news sentiment impact",
  "riskLevel": "Low|Medium|High",
  "timeFrame": "Intraday (Exit before 3:15 PM)",
  "technicalScore": <0-100>,
  "newsSentiment": {
    "overall": "${newsSentiment.overall}",
    "summary": "${newsSentiment.summary}",
    "articles": ${JSON.stringify(newsSentiment.articles)}
  }
}`;

    const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GOOGLE_GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${systemPrompt}\n\n${userPrompt}`
          }]
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096
        }
      })
    });

    if (!aiResponse.ok) {
      const errorData = await aiResponse.json();
      console.error('Google Gemini API error:', aiResponse.status, errorData);
      
      let errorMessage = 'Failed to generate prediction. Please try again.';
      
      if (aiResponse.status === 429) {
        errorMessage = 'Google API rate limit reached. Please wait a moment and try again.';
      } else if (aiResponse.status === 400) {
        errorMessage = 'Invalid request to AI service.';
      } else if (errorData.error?.message) {
        errorMessage = errorData.error.message;
      }
      
      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      throw new Error('No response from AI');
    }
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.error('AI response without JSON:', content);
      throw new Error('Could not parse AI response');
    }

    let prediction;
    try {
      prediction = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Content to parse:', jsonMatch[0]);
      throw new Error('Invalid JSON in AI response');
    }
    
    // Validate and correct premium if outside realistic range
    const minPremium = analysis.current * 0.015; // 1.5% minimum
    const maxPremium = analysis.current * 0.08; // 8% maximum
    const defaultPremium = Math.round(analysis.current * 0.035); // 3.5% default
    
    if (!prediction.premium?.buyLeg || 
        prediction.premium.buyLeg < minPremium || 
        prediction.premium.buyLeg > maxPremium) {
      console.warn(`Premium ${prediction.premium?.buyLeg} out of range [${minPremium}-${maxPremium}], adjusting to ${defaultPremium}`);
      prediction.premium = prediction.premium || {};
      prediction.premium.buyLeg = defaultPremium;
      prediction.premium.netCost = defaultPremium;
      
      // Recalculate target and stop loss if needed
      if (!prediction.premium.targetPremium) {
        prediction.premium.targetPremium = Math.round(defaultPremium * 1.35); // +35% gain
      }
      if (!prediction.premium.stopLossPremium) {
        prediction.premium.stopLossPremium = Math.round(defaultPremium * 0.7); // -30% loss
      }
    }
    
    // Ensure totalInvestment is recalculated with corrected premium
    prediction.totalInvestment = prediction.premium.buyLeg * prediction.lotSize;

    return new Response(
      JSON.stringify({ success: true, prediction, historicalData }),
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
    const startDate = endDate - (30 * 24 * 60 * 60);
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

function analyzeData(data: any[]) {
  const closes = data.map(d => d.close);
  const current = closes[closes.length - 1];
  
  // Simple RSI
  const changes = closes.slice(1).map((p, i) => p - closes[i]);
  const gains = changes.map(c => c > 0 ? c : 0);
  const losses = changes.map(c => c < 0 ? -c : 0);
  const avgGain = gains.slice(-14).reduce((a, b) => a + b, 0) / 14;
  const avgLoss = losses.slice(-14).reduce((a, b) => a + b, 0) / 14;
  const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  
  // Simple trend
  const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const trend = current > sma20 ? 'Bullish' : 'Bearish';
  
  return { current, rsi: Math.round(rsi), trend };
}
