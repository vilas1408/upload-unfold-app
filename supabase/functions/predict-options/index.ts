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

    // Determine lot size (as per NSE Circular FAOP/64625 & SEBI guidelines - effective Oct 28, 2025)
    let lotSize = 500;
    let upstoxSymbol = '';
    if (symbol === 'NIFTY' || symbol === '^NSEI') {
      lotSize = 65; // Changed from 75 to 65
      upstoxSymbol = 'NSE_INDEX|Nifty 50';
    } else if (symbol === 'BANKNIFTY' || symbol === '^NSEBANK') {
      lotSize = 30; // Changed from 15 to 30
      upstoxSymbol = 'NSE_INDEX|Nifty Bank';
    } else if (symbol === 'FINNIFTY') {
      lotSize = 40;
      upstoxSymbol = 'NSE_INDEX|Nifty Fin Service';
    } else if (symbol === 'MIDCPNIFTY') {
      lotSize = 50;
      upstoxSymbol = 'NSE_INDEX|NIFTY MID SELECT';
    }

    // Try to fetch live option chain data from Upstox
    let liveOptionData = null;
    if (upstoxSymbol) {
      try {
        const UPSTOX_ACCESS_TOKEN = Deno.env.get('UPSTOX_ACCESS_TOKEN');
        
        if (UPSTOX_ACCESS_TOKEN) {
          console.log('Fetching live option chain from Upstox...');
          liveOptionData = await fetchUpstoxOptionChain(
            UPSTOX_ACCESS_TOKEN,
            upstoxSymbol,
            expiryDateISO
          );
          console.log('Live option data fetched:', liveOptionData ? 'Success' : 'Failed');
        } else {
          console.log('No Upstox access token configured');
        }
      } catch (error) {
        console.error('Error fetching Upstox data:', error);
      }
    }

    // If we have live data, use it directly
    if (liveOptionData) {
      console.log('Using live Upstox data for prediction');
      const prediction = buildPredictionFromLiveData(
        liveOptionData,
        analysis,
        newsSentiment,
        expiryDate,
        lotSize
      );
      
      return new Response(
        JSON.stringify({ success: true, prediction, historicalData, isLiveData: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fallback to AI prediction if no live data
    console.log('Using AI prediction (no live data available)');
    
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
      JSON.stringify({ success: true, prediction, historicalData, isLiveData: false }),
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

async function fetchUpstoxOptionChain(accessToken: string, instrumentKey: string, expiryDate: string) {
  try {
    const url = `https://api.upstox.com/v2/option/chain?instrument_key=${encodeURIComponent(instrumentKey)}&expiry_date=${expiryDate}`;
    console.log('Upstox API URL:', url);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Upstox API error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    console.log('Upstox response received, data points:', data.data?.length || 0);
    return data;
  } catch (error) {
    console.error('Error fetching Upstox option chain:', error);
    return null;
  }
}

function buildPredictionFromLiveData(
  upstoxData: any,
  analysis: any,
  newsSentiment: any,
  expiryDate: string,
  lotSize: number
) {
  const spotPrice = analysis.current;
  const trend = analysis.trend;
  
  // Find ATM or nearest strike
  const optionChain = upstoxData.data || [];
  let selectedOption = null;
  let minDiff = Infinity;
  
  for (const strike of optionChain) {
    const diff = Math.abs(strike.strike_price - spotPrice);
    if (diff < minDiff) {
      minDiff = diff;
      selectedOption = strike;
    }
  }
  
  if (!selectedOption) {
    throw new Error('No suitable option found in chain');
  }
  
  // Choose CALL for bullish, PUT for bearish
  const isBullish = trend === 'Bullish';
  const optionData = isBullish ? selectedOption.call_options : selectedOption.put_options;
  const optionType = isBullish ? 'CALL' : 'PUT';
  const strategy = isBullish ? 'Long Call' : 'Long Put';
  
  const premium = optionData.market_data.ltp;
  const strikePrice = selectedOption.strike_price;
  const greeks = optionData.option_greeks;
  
  // Calculate targets and stops
  const targetPremium = premium * 2; // 100% target
  const stopLossPremium = premium * 0.67; // 33% stop loss
  
  const totalInvestment = premium * lotSize;
  const targetProfit = (targetPremium - premium) * lotSize;
  const stopLoss = (stopLossPremium - premium) * lotSize;
  
  const breakeven = isBullish 
    ? strikePrice + premium 
    : strikePrice - premium;

  return {
    strategy,
    strikePrice,
    optionType,
    expiryDate,
    lotSize,
    premium: {
      buyLeg: Math.round(premium),
      sellLeg: null,
      netCost: Math.round(premium),
      description: "Live market premium per lot"
    },
    totalInvestment: Math.round(totalInvestment),
    entryPrice: strikePrice,
    targetExitPrice: Math.round(targetPremium),
    stopLossPrice: Math.round(stopLossPremium),
    profitLoss: {
      target: Math.round(targetProfit),
      stopLoss: Math.round(stopLoss),
      breakeven: Math.round(breakeven)
    },
    expectedReturn: 100,
    probability: `${Math.round(greeks.pop || 50)}%`,
    maxLoss: Math.round(totalInvestment),
    maxGain: Math.round(targetProfit),
    breakeven: Math.round(breakeven),
    ivRank: Math.round((greeks.iv / 3) || 30), // Rough IV rank estimation
    greeks: {
      delta: Number(greeks.delta.toFixed(4)),
      gamma: Number(greeks.gamma.toFixed(4)),
      theta: Number(greeks.theta.toFixed(2)),
      vega: Number(greeks.vega.toFixed(2))
    },
    reasoning: `${strategy} based on ${trend.toLowerCase()} trend (RSI: ${analysis.rsi}). Live market data shows ${optionType} premium at ₹${Math.round(premium)} with IV ${Math.round(greeks.iv)}%. News sentiment: ${newsSentiment.overall}.`,
    riskLevel: premium > 100 ? "Medium" : "Low",
    timeFrame: "Intraday (Exit before 3:15 PM)",
    technicalScore: analysis.rsi > 60 ? 75 : analysis.rsi < 40 ? 70 : 65,
    newsSentiment: {
      overall: newsSentiment.overall,
      summary: newsSentiment.summary,
      articles: newsSentiment.articles
    },
    liveData: {
      spotPrice: selectedOption.underlying_spot_price,
      openInterest: optionData.market_data.oi,
      volume: optionData.market_data.volume,
      bidPrice: optionData.market_data.bid_price,
      askPrice: optionData.market_data.ask_price
    }
  };
}

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
