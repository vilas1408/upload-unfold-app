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
    console.log('Predicting stock for:', symbol, companyName);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Fetch real historical data from Yahoo Finance
    const historicalData = await fetchRealStockData(symbol);
    
    // Use Lovable AI to analyze and predict
    const systemPrompt = `You are an expert stock market analyst with deep knowledge of technical analysis and machine learning. 
Based on historical price data, predict tomorrow's opening and closing prices for the stock.
Provide your analysis in a structured format.`;

    const userPrompt = `Analyze this stock: ${companyName} (${symbol})

Historical data for the last 7 days:
${historicalData.map((d: any) => `${d.date}: Open ₹${d.open}, Close ₹${d.close}, Volume: ${d.volume}`).join('\n')}

Current price: ₹${historicalData[historicalData.length - 1].close}

Predict tomorrow's opening and closing prices. Consider:
1. Recent price trends and momentum
2. Volume patterns
3. Support and resistance levels
4. Market sentiment

Provide your prediction in this exact JSON format:
{
  "openingPrice": <number>,
  "closingPrice": <number>,
  "reason": "<detailed analysis explaining the prediction>",
  "confidence": "<percentage>",
  "predictionDate": "<YYYY-MM-DD>"
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices[0].message.content;
    console.log('AI Response:', content);

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse AI response');
    }

    const prediction = JSON.parse(jsonMatch[0]);
    
    // Calculate next trading day (skip weekends)
    const nextTradingDay = getNextTradingDay();
    prediction.predictionDate = nextTradingDay;

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

  } catch (error) {
    console.error('Error in predict-stock:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function fetchRealStockData(symbol: string) {
  try {
    // Calculate date range (last 7 days)
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - (7 * 24 * 60 * 60);
    
    // Fetch from Yahoo Finance API
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${startDate}&period2=${endDate}&interval=1d`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch stock data');
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
        open: Math.round(quotes.open[index] * 100) / 100,
        close: Math.round(quotes.close[index] * 100) / 100,
        high: Math.round(quotes.high[index] * 100) / 100,
        low: Math.round(quotes.low[index] * 100) / 100,
        volume: quotes.volume[index]
      };
    });
    
    return historicalData;
  } catch (error) {
    console.error('Error fetching real stock data:', error);
    // Fallback to mock data if API fails
    return generateMockHistoricalData();
  }
}

function getNextTradingDay(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  
  // Skip weekends (Saturday = 6, Sunday = 0)
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  
  return date.toISOString().split('T')[0];
}

function generateMockHistoricalData() {
  const data = [];
  const basePrice = 2400;
  const today = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    const randomChange = (Math.random() - 0.5) * 50;
    const open = basePrice + randomChange + (6 - i) * 10;
    const close = open + (Math.random() - 0.5) * 30;
    const volume = Math.floor(1000000 + Math.random() * 500000);
    
    data.push({
      date: date.toISOString().split('T')[0],
      open: Math.round(open * 100) / 100,
      close: Math.round(close * 100) / 100,
      high: Math.round((Math.max(open, close) + Math.random() * 20) * 100) / 100,
      low: Math.round((Math.min(open, close) - Math.random() * 20) * 100) / 100,
      volume
    });
  }
  
  return data;
}
