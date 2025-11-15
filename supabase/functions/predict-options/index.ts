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
    
    // Get current week Tuesday expiry (weekly options - changed from Thursday as per NSE circular effective Aug 28, 2025)
    const today = new Date();
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
    const expiryDate = tuesday.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    }).toUpperCase();
    
    const expiryDateISO = tuesday.toISOString().split('T')[0]; // YYYY-MM-DD format for Upstox

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
    
    const systemPrompt = `You are an options trading expert. Provide SIMPLE INTRADAY options strategies with EXACT PRICE LEVELS.
    
RULES:
- BULLISH: Recommend BUY CALL only
- BEARISH: Recommend BUY PUT only
- Premium per lot: ₹50-150 range
- Expiry: ${expiryDate}
- Lot Size: ${lotSize}
- Provide SPECIFIC entry, target, and stop loss prices`;

    const userPrompt = `Analyze ${name} (${symbol}). Current Price: ₹${analysis.current}, RSI: ${analysis.rsi}, Trend: ${analysis.trend}

News Sentiment Analysis:
Overall Sentiment: ${newsSentiment.overall}
Summary: ${newsSentiment.summary}
Articles: ${JSON.stringify(newsSentiment.articles)}

Provide realistic options strategy with EXACT PRICES:
{
  "strategy": "Long Call" | "Long Put",
  "strikePrice": <realistic strike near current price>,
  "optionType": "CALL" | "PUT",
  "expiryDate": "${expiryDate}",
  "lotSize": ${lotSize},
  "premium": {
    "buyLeg": <50-150 per lot>,
    "sellLeg": null,
    "netCost": <same as buyLeg>,
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
      throw new Error('Could not parse AI response');
    }

    const prediction = JSON.parse(jsonMatch[0]);

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
