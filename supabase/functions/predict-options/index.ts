import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// NSE API Configuration
const NSE_BASE_URL = "https://www.nseindia.com";
const NSE_OPTION_CHAIN_URL = "https://www.nseindia.com/api/option-chain-indices";

const NSE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
};

// Get current time in IST (UTC + 5:30)
function getCurrentISTTime(): Date {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes
  return new Date(now.getTime() + istOffset);
}

// Check if market is closed (after 3:15 PM IST)
function isMarketClosed(): boolean {
  const istTime = getCurrentISTTime();
  const hours = istTime.getUTCHours();
  const minutes = istTime.getUTCMinutes();
  const currentTimeInMinutes = hours * 60 + minutes;
  const marketCloseTime = 15 * 60 + 15; // 3:15 PM
  
  return currentTimeInMinutes >= marketCloseTime;
}

// Get cookies by visiting NSE homepage
async function getNSECookies(): Promise<string> {
  try {
    const response = await fetch(NSE_BASE_URL, {
      headers: NSE_HEADERS,
    });
    
    const cookies = response.headers.get('set-cookie');
    return cookies || '';
  } catch (error) {
    console.error('Error getting NSE cookies:', error);
    return '';
  }
}

// Fetch option chain data from NSE
async function fetchNSEOptionChain(symbol: string, type: 'index' | 'share'): Promise<any> {
  try {
    console.log(`Fetching NSE option chain for ${type}:`, symbol);
    
    // Get fresh cookies
    const cookies = await getNSECookies();
    
    // Use different API endpoint based on type
    const baseUrl = type === 'index' 
      ? 'https://www.nseindia.com/api/option-chain-indices'
      : 'https://www.nseindia.com/api/option-chain-equities';
    
    // Fetch option chain data
    const url = `${baseUrl}?symbol=${symbol}`;
    const response = await fetch(url, {
      headers: {
        ...NSE_HEADERS,
        'Cookie': cookies,
      },
    });
    
    if (!response.ok) {
      console.error(`NSE API returned status ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    console.log('Successfully fetched NSE option chain data');
    return data;
  } catch (error) {
    console.error('Error fetching NSE option chain:', error);
    return null;
  }
}

// Extract ATM premium from NSE option chain data
function extractATMPremium(optionChainData: any, currentPrice: number, optionType: 'CE' | 'PE'): number | null {
  try {
    const records = optionChainData?.records?.data || [];
    
    if (records.length === 0) return null;
    
    // Find ATM strike - different intervals for indices vs stocks
    let strikeInterval: number;
    if (currentPrice > 30000) {
      strikeInterval = 100; // Bank Nifty, high-priced indices
    } else if (currentPrice > 10000) {
      strikeInterval = 50; // Nifty
    } else if (currentPrice > 1000) {
      strikeInterval = 10; // Reliance (₹1520), most stocks
    } else {
      strikeInterval = 5; // Low-priced stocks
    }
    
    const atmStrike = Math.round(currentPrice / strikeInterval) * strikeInterval;
    
    // Find the option data for ATM strike
    const atmData = records.find((record: any) => record.strikePrice === atmStrike);
    
    if (!atmData) {
      console.log(`ATM strike ${atmStrike} not found, trying nearby strikes`);
      // Try nearest strikes
      const sortedRecords = records.sort((a: any, b: any) => 
        Math.abs(a.strikePrice - currentPrice) - Math.abs(b.strikePrice - currentPrice)
      );
      const nearestData = sortedRecords[0];
      const premium = optionType === 'CE' ? nearestData.CE?.ltp : nearestData.PE?.ltp;
      return premium || null;
    }
    
    // Log NSE data for debugging
    console.log(`NSE Data for ${optionType} at strike ${atmStrike}:`, {
      ltp: atmData[optionType]?.ltp,
      lastPrice: atmData[optionType]?.lastPrice,
      strikePrice: atmData.strikePrice
    });
    
    // Extract premium based on option type (use ltp - Last Traded Price)
    const premium = optionType === 'CE' ? atmData.CE?.ltp : atmData.PE?.ltp;
    
    console.log(`${optionType} ATM premium at strike ${atmStrike}: ₹${premium}`);
    return premium || null;
  } catch (error) {
    console.error('Error extracting ATM premium:', error);
    return null;
  }
}

// Calculate estimated premium with time value multiplier (fallback)
function calculateEstimatedPremium(baseMin: number, baseMax: number, daysToExpiry: number) {
  let multiplier = 1.0;
  
  if (daysToExpiry >= 8) multiplier = 2.0;
  else if (daysToExpiry >= 5) multiplier = 1.7;
  else if (daysToExpiry >= 2) multiplier = 1.4;
  
  return {
    min: Math.round(baseMin * multiplier),
    max: Math.round(baseMax * multiplier),
    mid: Math.round(((baseMin + baseMax) / 2) * multiplier),
  };
}

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
    
    // Calculate expiry date based on option type with IST timezone and market hours
    const istTime = getCurrentISTTime();
    const marketClosed = isMarketClosed();
    let expiryDate: string;
    let expiryDateISO: string;
    let isExpiryToday = false;
    let daysToExpiry = 0;
    
    if (type === 'index') {
      // Indices have weekly expiry on Tuesday (as per NSE circular effective Aug 28, 2025)
      const currentDay = istTime.getUTCDay(); // 0 = Sunday, 2 = Tuesday
      let daysUntilTuesday;
      
      if (currentDay <= 2) {
        // If today is Sun-Tue, get this Tuesday
        daysUntilTuesday = 2 - currentDay;
      } else {
        // If today is Wed-Sat, get next Tuesday
        daysUntilTuesday = 7 - currentDay + 2;
      }
      
      // If today is Tuesday but market is closed, skip to next Tuesday
      if (daysUntilTuesday === 0 && marketClosed) {
        daysUntilTuesday = 7;
        console.log('Market closed on expiry day, moving to next Tuesday');
      }
      
      const tuesday = new Date(istTime);
      tuesday.setUTCDate(istTime.getUTCDate() + daysUntilTuesday);
      expiryDateISO = tuesday.toISOString().split('T')[0];
      daysToExpiry = daysUntilTuesday;
      isExpiryToday = daysUntilTuesday === 0;
      
      if (isExpiryToday) {
        expiryDate = `TODAY (${tuesday.toLocaleDateString('en-GB', { 
          day: '2-digit', 
          month: 'short', 
          year: 'numeric' 
        }).toUpperCase()}) - EXIT BEFORE 3:15 PM`;
      } else {
        expiryDate = tuesday.toLocaleDateString('en-GB', { 
          day: '2-digit', 
          month: 'short', 
          year: 'numeric' 
        }).toUpperCase();
      }
    } else {
      // Shares have monthly expiry on last Thursday of the month
      const currentMonth = istTime.getUTCMonth();
      const currentYear = istTime.getUTCFullYear();
      const currentDate = istTime.getUTCDate();
      
      // Find the last Thursday of the current month
      let lastThursday = null;
      for (let day = 31; day >= 1; day--) {
        const testDate = new Date(Date.UTC(currentYear, currentMonth, day));
        if (testDate.getUTCMonth() === currentMonth && testDate.getUTCDay() === 4) {
          lastThursday = testDate;
          break;
        }
      }
      
      // If the last Thursday is today but market closed, or has already passed, use next month's last Thursday
      const isLastThursdayToday = lastThursday && 
        lastThursday.getUTCDate() === currentDate && 
        lastThursday.getUTCMonth() === currentMonth;
      
      if (!lastThursday || lastThursday < istTime || (isLastThursdayToday && marketClosed)) {
        // Move to next month
        const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
        const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
        
        for (let day = 31; day >= 1; day--) {
          const testDate = new Date(Date.UTC(nextYear, nextMonth, day));
          if (testDate.getUTCMonth() === nextMonth && testDate.getUTCDay() === 4) {
            lastThursday = testDate;
            break;
          }
        }
      }
      
      if (lastThursday) {
        expiryDateISO = lastThursday.toISOString().split('T')[0];
        daysToExpiry = Math.ceil((lastThursday.getTime() - istTime.getTime()) / (1000 * 60 * 60 * 24));
      } else {
        // Fallback to 28 days from now
        const fallbackDate = new Date(istTime);
        fallbackDate.setUTCDate(istTime.getUTCDate() + 28);
        expiryDateISO = fallbackDate.toISOString().split('T')[0];
        daysToExpiry = 28;
      }
      
      isExpiryToday = daysToExpiry === 0 && !marketClosed;
      
      if (isExpiryToday) {
        expiryDate = `TODAY (${lastThursday!.toLocaleDateString('en-GB', { 
          day: '2-digit', 
          month: 'short', 
          year: 'numeric' 
        }).toUpperCase()}) - EXIT BEFORE 3:15 PM`;
      } else {
        expiryDate = lastThursday!.toLocaleDateString('en-GB', { 
          day: '2-digit', 
          month: 'short', 
          year: 'numeric' 
        }).toUpperCase();
      }
    }

    // Determine lot size (as per NSE Circular - updated Nov 2025)
    let lotSize = 500;
    let nseSymbol = '';
    if (symbol === 'NIFTY' || symbol === '^NSEI') {
      lotSize = 75;
      nseSymbol = 'NIFTY';
    } else if (symbol === 'BANKNIFTY' || symbol === '^NSEBANK') {
      lotSize = 35;
      nseSymbol = 'BANKNIFTY';
    } else if (symbol === 'FINNIFTY') {
      lotSize = 40;
      nseSymbol = 'FINNIFTY';
    } else if (symbol === 'MIDCPNIFTY') {
      lotSize = 140;
      nseSymbol = 'MIDCPNIFTY';
    }

    // Try to fetch real option chain data from NSE
    let realCallPremium: number | null = null;
    let realPutPremium: number | null = null;
    let dataSource = 'AI_ESTIMATED';
    
    // Use mapped NSE symbol for indices, original symbol for stocks
    const nseSymbolToFetch = nseSymbol || symbol;
    
    console.log(`Fetching real option chain data from NSE for ${nseSymbolToFetch}`);
    const optionChainData = await fetchNSEOptionChain(nseSymbolToFetch, type);
    
    if (optionChainData) {
      realCallPremium = extractATMPremium(optionChainData, analysis.current, 'CE');
      realPutPremium = extractATMPremium(optionChainData, analysis.current, 'PE');
      
      if (realCallPremium && realPutPremium) {
        dataSource = 'NSE_LIVE';
        console.log(`Successfully fetched NSE data - Call: ₹${realCallPremium}, Put: ₹${realPutPremium}`);
      }
    }

    // Use AI prediction with real or estimated premium data
    console.log(`Generating AI prediction with ${dataSource === 'NSE_LIVE' ? 'real NSE' : 'estimated'} premium data`);
    
    const GOOGLE_GEMINI_API_KEY = Deno.env.get('GOOGLE_GEMINI_API_KEY');
    if (!GOOGLE_GEMINI_API_KEY) {
      throw new Error('GOOGLE_GEMINI_API_KEY is not configured');
    }
    
    // Calculate realistic premium ranges
    let expectedPremiumMin, expectedPremiumMax, expectedPremiumMid;
    
    if (type === 'index') {
      // Index options - base ranges before time value adjustment
      if (symbol === 'NIFTY' || symbol === '^NSEI') {
        expectedPremiumMin = 60;
        expectedPremiumMax = 150;
        expectedPremiumMid = 100;
      } else if (symbol === 'BANKNIFTY' || symbol === '^NSEBANK') {
        expectedPremiumMin = 100;
        expectedPremiumMax = 300;
        expectedPremiumMid = 180;
      } else if (symbol === 'FINNIFTY') {
        expectedPremiumMin = 70;
        expectedPremiumMax = 180;
        expectedPremiumMid = 120;
      } else if (symbol === 'MIDCPNIFTY') {
        expectedPremiumMin = 40;
        expectedPremiumMax = 120;
        expectedPremiumMid = 70;
      } else {
        // Default for other indices
        expectedPremiumMin = 50;
        expectedPremiumMax = 200;
        expectedPremiumMid = 100;
      }
    } else {
      // Stock options: 0.5-2% of stock price
      expectedPremiumMin = Math.round(analysis.current * 0.005);
      expectedPremiumMax = Math.round(analysis.current * 0.02);
      expectedPremiumMid = Math.round(analysis.current * 0.012);
    }
    
    // Apply time value multiplier if using estimated premiums
    if (dataSource === 'AI_ESTIMATED') {
      const estimated = calculateEstimatedPremium(expectedPremiumMin, expectedPremiumMax, daysToExpiry);
      expectedPremiumMin = estimated.min;
      expectedPremiumMax = estimated.max;
      expectedPremiumMid = estimated.mid;
      console.log(`Applied time value multiplier for ${daysToExpiry} days: ₹${expectedPremiumMin}-${expectedPremiumMax}`);
    }
    
    // Build premium context for AI
    const premiumContext = dataSource === 'NSE_LIVE' && realCallPremium && realPutPremium
      ? `REAL OPTION PREMIUMS (from NSE Live Data):
- ATM Call Premium: ₹${realCallPremium} per lot
- ATM Put Premium: ₹${realPutPremium} per lot
- Data Source: Live NSE Option Chain
- Days to Expiry: ${daysToExpiry}

Use these REAL premiums for your recommendation. Suggest strikes near ATM based on market view.`
      : `ESTIMATED PREMIUMS (NSE data unavailable):
- Premium Range: ₹${expectedPremiumMin}-${expectedPremiumMax} per lot
- ATM Premium: Around ₹${expectedPremiumMid} per lot
- Days to Expiry: ${daysToExpiry}
- Time Value: ${daysToExpiry >= 5 ? 'High' : daysToExpiry >= 2 ? 'Medium' : 'Low'} (${daysToExpiry} days remaining)

Use realistic estimated premiums based on time value principles.`;
    
    const systemPrompt = `You are an options trading expert analyzing ${dataSource === 'NSE_LIVE' ? 'REAL' : 'ESTIMATED'} market data. Provide SIMPLE INTRADAY options strategies with REALISTIC PREMIUMS.
    
MARKET DATA:
- Current Price: ₹${analysis.current}
- Expiry: ${expiryDate}
- Lot Size: ${lotSize}
${isExpiryToday ? '- ⚠️ TODAY IS EXPIRY DAY - Intraday only, exit before 3:15 PM IST' : `- Days to Expiry: ${daysToExpiry}`}

${premiumContext}

RULES:
- BULLISH: Recommend BUY CALL only
- BEARISH: Recommend BUY PUT only
- Provide SPECIFIC entry, target, and stop loss prices
- Consider time decay (theta) impact given ${daysToExpiry} days to expiry
${dataSource === 'NSE_LIVE' ? '- Use REAL premiums from NSE data' : '- Use ESTIMATED premiums with realistic time value'}`;

    const userPrompt = `Analyze ${name} (${symbol}). Current Price: ₹${analysis.current}, RSI: ${analysis.rsi}, Trend: ${analysis.trend}

News Sentiment Analysis:
Overall Sentiment: ${newsSentiment.overall}
Summary: ${newsSentiment.summary}
Articles: ${JSON.stringify(newsSentiment.articles)}

${isExpiryToday ? '⚠️ ALERT: TODAY IS EXPIRY DAY - Exit all positions before 3:15 PM IST' : ''}

Provide realistic options strategy:
{
  "strategy": "Long Call" | "Long Put",
  "strikePrice": <realistic strike near ₹${analysis.current}>,
  "optionType": "CALL" | "PUT",
  "expiryDate": "${expiryDate}",
  "lotSize": ${lotSize},
  "premium": {
    "buyLeg": <${dataSource === 'NSE_LIVE' ? `Use real premium: Call ₹${realCallPremium}, Put ₹${realPutPremium}` : `Between ₹${expectedPremiumMin}-${expectedPremiumMax}, around ₹${expectedPremiumMid} for ATM`}>,
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
    
    // Only validate AI estimates, NEVER validate real NSE data
    if (dataSource === 'AI_ESTIMATED') {
      // Validate and correct premium if outside realistic range
      let minPremium, maxPremium, defaultPremium;
      
      if (type === 'index') {
        minPremium = expectedPremiumMin;
        maxPremium = expectedPremiumMax;
        defaultPremium = expectedPremiumMid;
      } else {
        minPremium = analysis.current * 0.005; // 0.5% for stocks
        maxPremium = analysis.current * 0.02; // 2% for stocks
        defaultPremium = Math.round(analysis.current * 0.012); // 1.2% default for stocks
      }
      
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
    } else {
      // For NSE_LIVE: Trust the real market data completely
      console.log(`✓ Using real NSE premium: ₹${prediction.premium?.buyLeg} (no validation)`);
    }
    
    // Ensure totalInvestment is recalculated with corrected premium
    prediction.totalInvestment = prediction.premium.buyLeg * prediction.lotSize;

    return new Response(
      JSON.stringify({ 
        success: true, 
        prediction, 
        historicalData,
        dataSource,
        realPremiums: dataSource === 'NSE_LIVE' && realCallPremium && realPutPremium ? {
          callPremium: realCallPremium,
          putPremium: realPutPremium,
        } : null,
        expiryInfo: {
          date: expiryDateISO,
          formatted: expiryDate,
          daysToExpiry,
          isExpiryToday,
        },
        isLiveData: dataSource === 'NSE_LIVE',
        premiumSource: dataSource === 'NSE_LIVE' ? "nse-live" : "ai-estimate",
      }),
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
