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
    const { symbol, name, type } = await req.json();
    
    if (!symbol || !name || !type) {
      throw new Error('Symbol, name, and type are required');
    }
    
    console.log('Predicting options for:', symbol, name, type);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Fetch historical data
    const historicalData = await fetchStockData(symbol);
    const analysis = analyzeData(historicalData);
    
    // Get current week Thursday expiry
    const today = new Date();
    const daysUntilThursday = (4 - today.getDay() + 7) % 7;
    const thursday = new Date(today);
    thursday.setDate(today.getDate() + (daysUntilThursday === 0 ? 7 : daysUntilThursday));
    const expiryDate = thursday.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    }).toUpperCase();

    // Determine lot size
    let lotSize = 500;
    if (symbol === 'NIFTY' || symbol === '^NSEI') lotSize = 25;
    else if (symbol === 'BANKNIFTY' || symbol === '^NSEBANK') lotSize = 15;
    else if (symbol === 'FINNIFTY') lotSize = 40;
    else if (symbol === 'MIDCPNIFTY') lotSize = 50;

    const systemPrompt = `You are an options trading expert. Provide SIMPLE INTRADAY options strategies.
    
RULES:
- BULLISH: Recommend BUY CALL only
- BEARISH: Recommend BUY PUT only
- Premium: ₹50-150 range
- Expiry: ${expiryDate}
- Lot Size: ${lotSize}`;

    const userPrompt = `Analyze ${name} (${symbol}). Current: ₹${analysis.current}, RSI: ${analysis.rsi}, Trend: ${analysis.trend}

Provide JSON:
{
  "strategy": "Long Call" | "Long Put",
  "strikePrice": <number>,
  "optionType": "CALL" | "PUT",
  "expiryDate": "${expiryDate}",
  "lotSize": ${lotSize},
  "premium": {
    "buyLeg": <50-150>,
    "sellLeg": null,
    "netCost": <50-150>,
    "description": "Premium for entry"
  },
  "totalInvestment": <premium × lotSize>,
  "profitLoss": {
    "target": <number>,
    "stopLoss": <negative number>,
    "breakeven": <strike ± premium>
  },
  "targetPrice": <number>,
  "stopLoss": <number>,
  "expectedReturn": <30-50>,
  "probability": "<percentage>%",
  "maxLoss": <totalInvestment>,
  "maxGain": <realistic>,
  "breakeven": <strike ± premium>,
  "ivRank": <0-100>,
  "greeks": {"delta": <0.4-0.6>, "gamma": <small>, "theta": <negative>, "vega": <positive>},
  "reasoning": "Brief analysis",
  "riskLevel": "Low|Medium|High",
  "timeFrame": "Intraday (Exit before 3:15 PM)",
  "technicalScore": <0-100>
}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 4096
      })
    });

    if (!aiResponse.ok) {
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;
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
