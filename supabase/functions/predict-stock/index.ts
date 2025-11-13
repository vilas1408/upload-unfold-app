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
    
    console.log('Predicting stock:', symbol, companyName);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Fetch data
    const historicalData = await fetchStockData(symbol);
    const analysis = analyzeData(historicalData);

    const systemPrompt = `You are a stock market analyst. Provide accurate stock predictions based on technical analysis.`;

    const userPrompt = `Analyze ${companyName} (${symbol}).
    
Current Price: ₹${analysis.current}
RSI: ${analysis.rsi}
SMA20: ₹${analysis.sma20}
Trend: ${analysis.trend}

Provide JSON prediction:
{
  "predictedPrice": <number>,
  "targetPrice": <number>,
  "stopLoss": <number>,
  "direction": "up|down|sideways",
  "confidence": "<percentage>%",
  "reason": "<analysis>",
  "predictionDate": "<tomorrow YYYY-MM-DD>",
  "technicalScore": <0-6>,
  "trendAlignment": "bullish|bearish|neutral",
  "riskFactors": "<factors>"
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
        temperature: 0.1,
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
  
  // RSI
  const changes = closes.slice(1).map((p, i) => p - closes[i]);
  const gains = changes.map(c => c > 0 ? c : 0);
  const losses = changes.map(c => c < 0 ? -c : 0);
  const avgGain = gains.slice(-14).reduce((a, b) => a + b, 0) / 14;
  const avgLoss = losses.slice(-14).reduce((a, b) => a + b, 0) / 14;
  const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  
  // SMA
  const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const trend = current > sma20 ? 'Bullish' : 'Bearish';
  
  return { current, rsi: Math.round(rsi), sma20: Math.round(sma20), trend };
}
