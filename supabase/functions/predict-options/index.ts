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

// Emergency fallback lot sizes (updated Nov 2025 from NSE circular)
const CURRENT_LOT_SIZES: { [key: string]: number } = {
  'SBIN': 1500,
  'RELIANCE': 505,
  'HDFCBANK': 550,
  'ICICIBANK': 1375,
  'INFY': 300,
  'TCS': 125,
  'ITC': 1600,
  'AXISBANK': 1200,
  'KOTAKBANK': 400,
  'BHARTIARTL': 1820,
  'LT': 300,
  'TATAMOTORS': 1700,
  'BAJFINANCE': 125,
  'MARUTI': 100,
  'HCLTECH': 700,
  'WIPRO': 1200,
  'ADANIPORTS': 1200,
  'TATASTEEL': 2850,
  'SUNPHARMA': 700,
  'ONGC': 3700,
};

// Fetch lot size from NiftyTrader website
async function fetchLotSizeFromNiftyTrader(symbol: string): Promise<number | null> {
  try {
    console.log(`Fetching lot size from NiftyTrader for: ${symbol}`);
    
    const response = await fetch('https://www.niftytrader.in/nse-fo-lot-size', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      console.error(`NiftyTrader returned status ${response.status}`);
      return null;
    }

    const html = await response.text();
    
    // Try multiple patterns for flexibility
    const patterns = [
      new RegExp(`>${symbol}<`, 'i'),           // Original
      new RegExp(`>${symbol}\\s*<`, 'i'),       // With whitespace
      new RegExp(`title="${symbol}"`, 'i'),     // In title attribute
      new RegExp(`>${symbol.toUpperCase()}<`, 'i'), // Uppercase only
      new RegExp(`data-symbol="${symbol}"`, 'i'), // Data attribute
    ];
    
    let symbolMatch = null;
    for (const pattern of patterns) {
      symbolMatch = html.match(pattern);
      if (symbolMatch) break;
    }
    
    if (!symbolMatch) {
      console.log(`Symbol ${symbol} not found in NiftyTrader data`);
      return null;
    }

    // Extract the row containing this symbol
    const symbolIndex = symbolMatch.index!;
    const rowStart = html.lastIndexOf('<tr', symbolIndex);
    const rowEnd = html.indexOf('</tr>', symbolIndex);
    
    if (rowStart === -1 || rowEnd === -1) {
      console.log(`Could not extract row for ${symbol}`);
      return null;
    }

    const row = html.substring(rowStart, rowEnd);
    
    // Extract all <td> cells from the row
    const cellPattern = /<td[^>]*>(.*?)<\/td>/gi;
    const cells: string[] = [];
    let cellMatch;
    
    while ((cellMatch = cellPattern.exec(row)) !== null) {
      // Remove HTML tags and clean the text
      const cellText = cellMatch[1]
        .replace(/<[^>]+>/g, '') // Remove all HTML tags
        .replace(/,/g, '')        // Remove commas
        .trim();
      cells.push(cellText);
    }

    // Lot size is typically in the second or third column after symbol
    // Try to find a numeric value that looks like a lot size (10-5000 range)
    for (const cell of cells) {
      const lotSize = parseInt(cell, 10);
      if (!isNaN(lotSize) && lotSize >= 10 && lotSize <= 10000) {
        console.log(`✓ Found lot size from NiftyTrader for ${symbol}: ${lotSize} units`);
        return lotSize;
      }
    }

    console.log(`Could not parse lot size from cells: ${cells.join(', ')}`);
    return null;
  } catch (error) {
    console.error('Error fetching lot size from NiftyTrader:', error);
    return null;
  }
}

// Fetch option chain data from NSE and extract marketLot
async function fetchNSEOptionChain(symbol: string, type: 'index' | 'share'): Promise<{ data: any, marketLot: number | null }> {
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
      return { data: null, marketLot: null };
    }
    
    const data = await response.json();
    console.log('Successfully fetched NSE option chain data');
    
    // Extract marketLot from first record
    const records = data?.records?.data || [];
    let marketLot: number | null = null;
    
    if (records.length > 0 && records[0].marketLot) {
      marketLot = records[0].marketLot;
      console.log(`✓ NSE API marketLot extracted: ${marketLot} units`);
    }
    
    return { data, marketLot };
  } catch (error) {
    console.error('Error fetching NSE option chain:', error);
    return { data: null, marketLot: null };
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
      const nearestLeg = optionType === 'CE' ? nearestData.CE : nearestData.PE;
      const premium = nearestLeg?.ltp ?? nearestLeg?.lastPrice ?? null;
      return premium;
    }
    
    // Log NSE data for debugging
    const leg = atmData[optionType];
    console.log(`NSE Data for ${optionType} at strike ${atmStrike}:`, {
      ltp: leg?.ltp,
      lastPrice: leg?.lastPrice,
      strikePrice: atmData.strikePrice
    });
    
    // Extract premium (use ltp first, fallback to lastPrice)
    const premium = leg?.ltp ?? leg?.lastPrice ?? null;
    
    console.log(`${optionType} ATM premium at strike ${atmStrike}: ₹${premium}`);
    return premium;
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
    let analysis = analyzeData(historicalData); // Will be re-analyzed after news fetch
    
    // Fetch news with multiple sources and fallbacks
    const NEWS_API_KEY = Deno.env.get('NEWS_API_KEY');
    let newsSentiment = { 
      overall: 'neutral', 
      strength: 'neutral' as 'strong_positive' | 'positive' | 'neutral' | 'negative' | 'strong_negative',
      confidence: 0,
      summary: 'No recent news available', 
      articles: [] as any[],
      weightedScore: 0
    };
    
    // Source Credibility Tiers
    const SOURCE_CREDIBILITY = {
      'economictimes.com': { tier: 1, weight: 1.0, name: 'Economic Times' },
      'moneycontrol.com': { tier: 1, weight: 1.0, name: 'Moneycontrol' },
      'livemint.com': { tier: 1, weight: 1.0, name: 'LiveMint' },
      'business-standard.com': { tier: 1, weight: 1.0, name: 'Business Standard' },
      'financialexpress.com': { tier: 2, weight: 0.8, name: 'Financial Express' },
      'ndtv.com': { tier: 2, weight: 0.8, name: 'NDTV' },
      'thehindubusinessline.com': { tier: 2, weight: 0.8, name: 'Hindu BusinessLine' },
      'google': { tier: 3, weight: 0.5, name: 'Google News' }
    };
    
    // Calculate article recency multiplier
    const getRecencyMultiplier = (publishedAt: string): number => {
      const articleDate = new Date(publishedAt);
      const now = new Date();
      const hoursDiff = (now.getTime() - articleDate.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff < 6) return 1.5;      // < 6 hours
      if (hoursDiff < 24) return 1.2;     // 6-24 hours
      if (hoursDiff < 72) return 1.0;     // 1-3 days
      if (hoursDiff < 168) return 0.7;    // 3-7 days
      return 0.3;                          // > 7 days (very stale)
    };
    
    // Get source credibility
    const getSourceCredibility = (url: string, sourceName: string) => {
      for (const [domain, cred] of Object.entries(SOURCE_CREDIBILITY)) {
        if (url?.includes(domain) || sourceName?.toLowerCase().includes(cred.name.toLowerCase())) {
          return cred;
        }
      }
      return { tier: 3, weight: 0.5, name: sourceName || 'Unknown' };
    };
    
    // Helper function to fetch and parse Google News RSS
    const fetchGoogleNewsRSS = async (query: string): Promise<any[]> => {
      try {
        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
        console.log(`Fetching Google News RSS for: ${query}`);
        
        const response = await fetch(rssUrl);
        if (!response.ok) return [];
        
        const xmlText = await response.text();
        
        // Parse RSS XML to extract articles
        const titleMatches = xmlText.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>/g);
        const linkMatches = xmlText.matchAll(/<link>(.*?)<\/link>/g);
        const pubDateMatches = xmlText.matchAll(/<pubDate>(.*?)<\/pubDate>/g);
        
        const titles = Array.from(titleMatches).map(m => m[1]);
        const links = Array.from(linkMatches).map(m => m[1]);
        const dates = Array.from(pubDateMatches).map(m => m[1]);
        
        // Skip first item (channel title/link)
        const articles = [];
        for (let i = 1; i < Math.min(titles.length, 11); i++) {
          if (titles[i] && !titles[i].includes('Google News')) {
            articles.push({
              title: titles[i],
              url: links[i] || '',
              publishedAt: dates[i] || new Date().toISOString(),
              source: { name: 'Google News' }
            });
          }
        }
        
        console.log(`✓ Found ${articles.length} articles from Google News RSS`);
        return articles;
      } catch (error) {
        console.error('Google News RSS fetch failed:', error);
        return [];
      }
    };
    
    if (NEWS_API_KEY) {
      try {
        // Calculate date range (last 7 days for better coverage)
        const toDate = new Date();
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 7);
        
        const formatDate = (date: Date) => date.toISOString().split('T')[0];
        
        // Build broader search queries
        const cleanSymbol = symbol.replace(/\^/g, '').replace('.NS', '');
        const queries = [
          // Primary: Use broader Indian market terms
          `(${name} OR ${cleanSymbol}) AND (India OR NSE OR BSE OR "stock market")`,
          // Fallback 1: Just the name and symbol
          `${name} ${cleanSymbol}`,
          // Fallback 2: Symbol only
          cleanSymbol
        ];
        
        let articles: any[] = [];
        let queryUsed = '';
        
        // Try queries in order until we get results
        for (const query of queries) {
          if (articles.length > 0) break;
          
          console.log(`Trying NewsAPI query: ${query}`);
          
          const newsResponse = await fetch(
            `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&from=${formatDate(fromDate)}&to=${formatDate(toDate)}&sortBy=publishedAt&language=en&domains=economictimes.com,moneycontrol.com,livemint.com,business-standard.com,financialexpress.com,ndtv.com&apiKey=${NEWS_API_KEY}`,
            {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            }
          );

          if (newsResponse.ok) {
            const newsData = await newsResponse.json();
            articles = newsData.articles || [];
            if (articles.length > 0) {
              queryUsed = query;
              console.log(`✓ Found ${articles.length} articles from NewsAPI with query: ${query}`);
            }
          }
        }
        
        // Fallback to Google News RSS if NewsAPI returns no results
        if (articles.length === 0) {
          console.log('NewsAPI returned 0 results, trying Google News RSS fallback...');
          const rssQueries = [
            `${name} ${cleanSymbol} India stock`,
            `${name} share price`,
            `${cleanSymbol} NSE`
          ];
          
          for (const rssQuery of rssQueries) {
            if (articles.length > 0) break;
            articles = await fetchGoogleNewsRSS(rssQuery);
          }
          
          if (articles.length > 0) {
            console.log(`✓ Using ${articles.length} articles from Google News RSS fallback`);
          }
        }
        
        // Analyze sentiment if we have articles
        if (articles.length > 0) {
          // Use Lovable AI to analyze sentiment with enhanced weighted scoring
          const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
          if (LOVABLE_API_KEY) {
            // Enrich articles with credibility and recency data
            const enrichedArticles = articles.slice(0, 10).map((a: any) => {
              const cred = getSourceCredibility(a.url, a.source?.name);
              const recency = getRecencyMultiplier(a.publishedAt);
              return {
                title: a.title,
                description: a.description || a.title,
                source: cred.name,
                credibilityTier: cred.tier,
                credibilityWeight: cred.weight,
                recencyMultiplier: recency,
                publishedAt: a.publishedAt,
                url: a.url
              };
            });
            
            // Calculate age descriptions for AI context
            const articleAges = enrichedArticles.map(a => {
              const hours = (new Date().getTime() - new Date(a.publishedAt).getTime()) / (1000 * 60 * 60);
              if (hours < 1) return 'just now';
              if (hours < 6) return `${Math.floor(hours)}h ago`;
              if (hours < 24) return 'today';
              if (hours < 48) return 'yesterday';
              return `${Math.floor(hours / 24)}d ago`;
            });
            
            console.log('\n📰 NEWS ANALYSIS INPUT:');
            enrichedArticles.forEach((a, i) => {
              console.log(`  ${i + 1}. [Tier ${a.credibilityTier}, ${articleAges[i]}] ${a.source}: "${a.title.substring(0, 60)}..."`);
            });
            
            const sentimentResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
                    content: `You are a financial news sentiment analyzer for Indian stock markets. 
                    
CRITICAL INSTRUCTIONS:
1. Be DECISIVE - avoid "neutral" unless sentiment is genuinely mixed
2. Consider article credibility (Tier 1 = most reliable, Tier 3 = least)
3. Weight recent articles (< 24 hours) higher than old ones
4. Detect major events: earnings, RBI policy, regulatory changes, management shifts
5. Look for sector-wide trends vs individual stock news
6. Return sentiment STRENGTH (strong_positive, positive, neutral, negative, strong_negative)
7. Provide confidence score 0-100 based on article quality, consistency, and credibility

Return ONLY valid JSON with no markdown.`
                  },
                  {
                    role: 'user',
                    content: `Analyze sentiment for ${name} (${symbol}):

ARTICLES (with credibility & recency weights):
${JSON.stringify(enrichedArticles, null, 2)}

Return JSON format:
{
  "strength": "strong_positive" | "positive" | "neutral" | "negative" | "strong_negative",
  "confidence": <0-100 number>,
  "summary": "<1-2 sentence summary explaining WHY this sentiment>",
  "articles": [
    {
      "title": "string",
      "sentiment": "positive" | "negative" | "neutral",
      "impact": "high" | "medium" | "low",
      "majorEvent": false | "earnings" | "rbi_policy" | "regulatory" | "management" | "sector_news"
    }
  ],
  "reasoning": "<Why this strength level? What influenced confidence?>"
}

BE DECISIVE: Only use "neutral" if articles genuinely conflict or lack substance.`
                  }
                ],
                temperature: 0.2,
              }),
            });
            
            if (sentimentResponse.ok) {
              const sentimentData = await sentimentResponse.json();
              const content = sentimentData.choices?.[0]?.message?.content;
              if (content) {
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  const aiSentiment = JSON.parse(jsonMatch[0]);
                  
                  // Calculate weighted sentiment score
                  let weightedScore = 0;
                  const sentimentToScore: Record<string, number> = {
                    'strong_positive': 5,
                    'positive': 2,
                    'neutral': 0,
                    'negative': -2,
                    'strong_negative': -5
                  };
                  
                  // Apply article-level weights
                  enrichedArticles.forEach((article, i) => {
                    const articleSentiment = aiSentiment.articles?.[i]?.sentiment || 'neutral';
                    const baseScore = articleSentiment === 'positive' ? 1 : articleSentiment === 'negative' ? -1 : 0;
                    const weight = article.credibilityWeight * article.recencyMultiplier;
                    weightedScore += baseScore * weight;
                  });
                  
                  // Normalize weighted score
                  const maxPossibleScore = enrichedArticles.length * 1.5; // max credibility * max recency
                  const normalizedScore = weightedScore / maxPossibleScore;
                  
                  newsSentiment = {
                    overall: aiSentiment.strength === 'strong_positive' || aiSentiment.strength === 'positive' ? 'positive' :
                             aiSentiment.strength === 'strong_negative' || aiSentiment.strength === 'negative' ? 'negative' : 'neutral',
                    strength: aiSentiment.strength,
                    confidence: aiSentiment.confidence || 50,
                    summary: aiSentiment.summary,
                    articles: aiSentiment.articles || [],
                    weightedScore: Math.round(normalizedScore * 100) / 100
                  };
                  
                  console.log(`
📊 SENTIMENT ANALYSIS RESULT:
  Strength: ${newsSentiment.strength}
  Confidence: ${newsSentiment.confidence}%
  Weighted Score: ${newsSentiment.weightedScore}
  Articles Analyzed: ${articles.length}
  Source: ${queryUsed || 'Google News RSS'}
  Summary: ${newsSentiment.summary}
  Reasoning: ${aiSentiment.reasoning || 'N/A'}
`);
                }
              }
            }
          }
        } else {
          console.warn('No news articles found from any source, using neutral sentiment');
        }
      } catch (error) {
        console.error('News fetching error:', error);
      }
    } else {
      console.warn('NEWS_API_KEY not configured, skipping news sentiment analysis');
    }
    
    // Re-analyze data with news sentiment included
    analysis = analyzeData(historicalData, newsSentiment);
    
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

    // Determine lot size with multi-source priority
    let lotSize = 500; // Default fallback
    let nseSymbol = '';
    let lotSizeSource = 'default';
    let nseMarketLot: number | null = null;
    
    // Step 1: Set index-specific lot sizes (these are stable and official)
    if (symbol === 'NIFTY' || symbol === '^NSEI') {
      lotSize = 75;
      nseSymbol = 'NIFTY';
      lotSizeSource = 'index-config';
    } else if (symbol === 'BANKNIFTY' || symbol === '^NSEBANK') {
      lotSize = 35;
      nseSymbol = 'BANKNIFTY';
      lotSizeSource = 'index-config';
    } else if (symbol === 'FINNIFTY') {
      lotSize = 40;
      nseSymbol = 'FINNIFTY';
      lotSizeSource = 'index-config';
    } else if (symbol === 'MIDCPNIFTY') {
      lotSize = 140;
      nseSymbol = 'MIDCPNIFTY';
      lotSizeSource = 'index-config';
    }
    
    console.log(`Initial lot size for ${symbol} (${type}): ${lotSize} units (source: ${lotSizeSource})`);
    
    // Step 2: Fetch NSE option chain data (for both premiums AND lot size)
    let realCallPremium: number | null = null;
    let realPutPremium: number | null = null;
    let dataSource = 'AI_ESTIMATED';
    
    // Use mapped NSE symbol for indices, original symbol for stocks
    const nseSymbolToFetch = nseSymbol || symbol;
    
    console.log(`Fetching real option chain data from NSE for ${nseSymbolToFetch}`);
    const nseResult = await fetchNSEOptionChain(nseSymbolToFetch, type);
    
    if (nseResult.data) {
      realCallPremium = extractATMPremium(nseResult.data, analysis.current, 'CE');
      realPutPremium = extractATMPremium(nseResult.data, analysis.current, 'PE');
      nseMarketLot = nseResult.marketLot;
      
      if (realCallPremium || realPutPremium) {
        dataSource = 'NSE_LIVE';
        console.log(
          `Successfully fetched NSE data - Call: ₹${realCallPremium ?? 'N/A'}, ` +
          `Put: ₹${realPutPremium ?? 'N/A'}`
        );
      }
      
      // PRIORITY 1: Use NSE API marketLot if available (most authoritative)
      if (nseMarketLot && nseMarketLot > 0 && type === 'share') {
        lotSize = nseMarketLot;
        lotSizeSource = 'nse-api';
        console.log(`✓ Lot size from NSE API (PRIORITY 1): ${lotSize} units`);
      }
    }
    
    // Step 3: PRIORITY 2: Try NiftyTrader (only if NSE API didn't provide lot size)
    if (type === 'share' && lotSizeSource !== 'nse-api') {
      const niftyTraderLotSize = await fetchLotSizeFromNiftyTrader(symbol);
      if (niftyTraderLotSize && niftyTraderLotSize > 0) {
        lotSize = niftyTraderLotSize;
        lotSizeSource = 'niftytrader';
        console.log(`✓ Lot size from NiftyTrader (PRIORITY 2): ${lotSize} units`);
      } else {
        // Step 4: PRIORITY 3: Use hardcoded emergency mapping
        const emergencyLotSize = CURRENT_LOT_SIZES[symbol];
        if (emergencyLotSize) {
          lotSize = emergencyLotSize;
          lotSizeSource = 'emergency-mapping';
          console.log(`✓ Lot size from emergency mapping (PRIORITY 3): ${lotSize} units`);
        } else {
          console.log(`⚠️ No lot size found anywhere, using fallback: ${lotSize} units`);
          lotSizeSource = 'fallback';
        }
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
    let premiumContext: string;
    
    if (dataSource === 'NSE_LIVE' && realCallPremium && realPutPremium) {
      premiumContext = `REAL OPTION PREMIUMS (from NSE Live Data):
- ATM Call Premium: ₹${realCallPremium} per lot
- ATM Put Premium: ₹${realPutPremium} per lot
- Data Source: Live NSE Option Chain
- Days to Expiry: ${daysToExpiry}

Use these REAL premiums for your recommendation. Suggest strikes near ATM based on market view.`;
    } else if (dataSource === 'NSE_LIVE' && realCallPremium) {
      premiumContext = `REAL OPTION PREMIUM (from NSE Live Data):
- ATM Call Premium: ₹${realCallPremium} per lot
- Data Source: Live NSE Option Chain (Call side)
- Days to Expiry: ${daysToExpiry}

Use this REAL CALL premium for your recommendation.`;
    } else if (dataSource === 'NSE_LIVE' && realPutPremium) {
      premiumContext = `REAL OPTION PREMIUM (from NSE Live Data):
- ATM Put Premium: ₹${realPutPremium} per lot
- Data Source: Live NSE Option Chain (Put side)
- Days to Expiry: ${daysToExpiry}

Use this REAL PUT premium for your recommendation.`;
    } else {
      premiumContext = `ESTIMATED PREMIUMS (NSE data unavailable):
- Premium Range: ₹${expectedPremiumMin}-${expectedPremiumMax} per lot
- ATM Premium: Around ₹${expectedPremiumMid} per lot
- Days to Expiry: ${daysToExpiry}
- Time Value: ${daysToExpiry >= 5 ? 'High' : daysToExpiry >= 2 ? 'Medium' : 'Low'} (${daysToExpiry} days remaining)

Use realistic estimated premiums based on time value principles.`;
    }
    
    const systemPrompt = `You are an options trading expert analyzing ${dataSource === 'NSE_LIVE' ? 'REAL' : 'ESTIMATED'} market data. Provide SIMPLE INTRADAY options strategies with REALISTIC PREMIUMS.
    
MARKET DATA:
- Current Price: ₹${analysis.current}
- Expiry: ${expiryDate}
- Lot Size: ${lotSize}
${isExpiryToday ? '- ⚠️ TODAY IS EXPIRY DAY - Intraday only, exit before 3:15 PM IST' : `- Days to Expiry: ${daysToExpiry}`}

${premiumContext}

⚠️ CRITICAL RULE: NEWS SENTIMENT STRENGTH OVERRIDES TECHNICAL ANALYSIS
- If NEWS SENTIMENT is "strong_negative" or "negative" with high confidence → RECOMMEND "Long Put" (BEARISH)
- If NEWS SENTIMENT is "strong_positive" or "positive" with high confidence → RECOMMEND "Long Call" (BULLISH)
- If NEWS SENTIMENT is "neutral" or low confidence → Use technical analysis to decide

SENTIMENT WEIGHTING:
- Strong sentiment + high confidence (>70%) = ALWAYS override technicals
- Moderate sentiment + medium confidence (50-70%) = Consider but don't force override
- Weak sentiment or low confidence (<50%) = Rely on technical analysis

SECONDARY RULES (only if sentiment is neutral):
- BULLISH technical signals: Recommend BUY CALL
- BEARISH technical signals: Recommend BUY PUT
- Provide SPECIFIC entry, target, and stop loss prices
- Consider time decay (theta) impact given ${daysToExpiry} days to expiry
${dataSource === 'NSE_LIVE' ? '- Use REAL premiums from NSE data' : '- Use ESTIMATED premiums with realistic time value'}`;

    const userPrompt = `Analyze ${name} (${symbol}). 

TECHNICAL ANALYSIS (Multi-Indicator):
- Current Price: ₹${analysis.current}
- RSI: ${analysis.rsi} (${analysis.rsi > 70 ? 'Overbought' : analysis.rsi < 30 ? 'Oversold' : 'Neutral'})
- SMA20: ₹${analysis.sma20}
- EMA12: ₹${analysis.ema12}, EMA26: ₹${analysis.ema26}, EMA50: ₹${analysis.ema50}

MACD ANALYSIS:
- MACD: ${analysis.macd} | Signal: ${analysis.macdSignal} | Histogram: ${analysis.macdHistogram}
- MACD Trend: ${analysis.macdTrend}

BOLLINGER BANDS:
- Upper: ₹${analysis.upperBand} | Lower: ₹${analysis.lowerBand}
- BB Position: ${analysis.bbPosition}% (${analysis.bbSignal})

VOLUME & VOLATILITY:
- Volume Ratio: ${analysis.volumeRatio}x (${analysis.volumeSignal})
- ATR: ₹${analysis.atr} (${analysis.atrPercent}% of price)
- Historical Volatility (7D): ${analysis.hv7d}%
- Historical Volatility (30D): ${analysis.hv30d}%

SUPPORT & RESISTANCE:
- Support: ₹${analysis.support}
- Resistance: ₹${analysis.resistance}

OVERALL TREND: ${analysis.trend} (Score: ${analysis.trendScore}/10)

NEWS SENTIMENT: ${newsSentiment.strength} (${newsSentiment.confidence}% confidence) - ${newsSentiment.summary}

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
  "reasoning": "Brief analysis (2-3 lines) including news sentiment impact and technical factors",
  "riskLevel": "Low|Medium|High",
  "timeFrame": "Intraday (Exit before 3:15 PM)",
  "technicalScore": <0-100>,
  "newsSentiment": {
    "overall": "${newsSentiment.overall}",
    "strength": "${newsSentiment.strength}",
    "confidence": ${newsSentiment.confidence},
    "summary": "${newsSentiment.summary}",
    "weightedScore": ${newsSentiment.weightedScore},
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
    
    // CRITICAL: Validate sentiment-strategy alignment with weighted decision
    let strategyAutoCorrect = false;
    const isStrongSentiment = newsSentiment.strength === 'strong_positive' || newsSentiment.strength === 'strong_negative';
    const isHighConfidence = newsSentiment.confidence >= 70;
    const shouldOverride = isStrongSentiment || (isHighConfidence && newsSentiment.strength !== 'neutral');
    
    console.log(`
🔍 STRATEGY VALIDATION:
  Sentiment Strength: ${newsSentiment.strength}
  Confidence: ${newsSentiment.confidence}%
  Should Override: ${shouldOverride}
  AI Recommended: ${prediction.optionType}
`);
    
    // Override only on strong sentiment or high confidence non-neutral sentiment
    if (shouldOverride) {
      if ((newsSentiment.strength === 'negative' || newsSentiment.strength === 'strong_negative') && prediction.optionType === 'CALL') {
        console.error(`❌ STRATEGY CONFLICT: ${newsSentiment.strength} sentiment (${newsSentiment.confidence}% confidence) but AI recommended CALL!`);
        console.log('🔄 Auto-correcting strategy to PUT...');
        
        prediction.strategy = 'Long Put';
        prediction.optionType = 'PUT';
        prediction.reasoning = `${prediction.reasoning} [AUTO-CORRECTED: ${newsSentiment.strength} news sentiment (${newsSentiment.confidence}% confidence) overrides technical bullish signals]`;
        strategyAutoCorrect = true;
      }
      
      if ((newsSentiment.strength === 'positive' || newsSentiment.strength === 'strong_positive') && prediction.optionType === 'PUT') {
        console.error(`❌ STRATEGY CONFLICT: ${newsSentiment.strength} sentiment (${newsSentiment.confidence}% confidence) but AI recommended PUT!`);
        console.log('🔄 Auto-correcting strategy to CALL...');
        
        prediction.strategy = 'Long Call';
        prediction.optionType = 'CALL';
        prediction.reasoning = `${prediction.reasoning} [AUTO-CORRECTED: ${newsSentiment.strength} news sentiment (${newsSentiment.confidence}% confidence) overrides technical bearish signals]`;
        strategyAutoCorrect = true;
      }
    } else {
      console.log('✓ No override needed: Weak sentiment or low confidence, trusting technical analysis');
    }
    
    // Override with real NSE premium if available
    if (dataSource === 'NSE_LIVE' && realCallPremium && prediction.optionType === 'CALL') {
      prediction.premium = prediction.premium || {} as any;
      prediction.premium.buyLeg = realCallPremium;
      prediction.premium.netCost = realCallPremium;
      prediction.totalInvestment = realCallPremium * prediction.lotSize;
      console.log(`Overriding entry premium with REAL NSE call premium: ₹${realCallPremium}`);
    } else if (dataSource === 'NSE_LIVE' && realPutPremium && prediction.optionType === 'PUT') {
      prediction.premium = prediction.premium || {} as any;
      prediction.premium.buyLeg = realPutPremium;
      prediction.premium.netCost = realPutPremium;
      prediction.totalInvestment = realPutPremium * prediction.lotSize;
      console.log(`Overriding entry premium with REAL NSE put premium: ₹${realPutPremium}`);
    }
    
    // Log enhanced prediction decision flow
    console.log(`
📊 PREDICTION DECISION FLOW:
  1. News Sentiment: ${newsSentiment.overall} (${newsSentiment.strength}, ${newsSentiment.confidence}% confidence)
  2. Weighted Score: ${newsSentiment.weightedScore}
  3. Technical Trend: ${analysis.trend}
  4. Trend Score (with sentiment): ${analysis.trendScore}
  5. MACD Trend: ${analysis.macdTrend}
  6. RSI: ${analysis.rsi}
  7. AI Recommended: ${prediction.optionType}
  8. Override Triggered: ${shouldOverride ? '✅ YES' : '❌ NO'}
  9. Auto-Corrected: ${strategyAutoCorrect ? '✅ YES' : '❌ NO'}
  10. Final Decision: ${prediction.optionType}
  11. Validation: ${strategyAutoCorrect ? '⚠️ CONFLICT DETECTED & CORRECTED' : '✅ ALIGNED'}
`);
    
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
    
    // Store premium snapshot for historical tracking (if NSE live data available)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (supabaseUrl && supabaseKey && dataSource === 'NSE_LIVE') {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const premium = prediction.optionType === 'CALL' ? realCallPremium : realPutPremium;
      
      if (premium) {
        try {
          await supabase.from('option_premiums').insert({
            symbol,
            option_type: type,
            strike_price: prediction.strikePrice,
            contract_type: prediction.optionType === 'CALL' ? 'CE' : 'PE',
            premium,
            underlying_price: analysis.current,
            days_to_expiry: daysToExpiry,
            expiry_date: expiryDateISO,
            implied_volatility: calculateImpliedVolatility(premium, analysis.current, prediction.strikePrice, daysToExpiry, prediction.optionType === 'CALL' ? 'CE' : 'PE')
          });
          console.log('✓ Premium snapshot stored for historical tracking');
        } catch (error) {
          console.error('Failed to store premium snapshot:', error);
        }
      }
      
      // Track prediction for backtesting
      try {
        await supabase.from('prediction_tracking').insert({
          symbol,
          option_type: type,
          prediction_json: prediction,
          predicted_strategy: prediction.strategy,
          predicted_direction: prediction.optionType,
          predicted_strike: prediction.strikePrice,
          predicted_entry_premium: prediction.premium.buyLeg,
          predicted_target_premium: prediction.premium.targetPremium,
          predicted_sl_premium: prediction.premium.stopLossPremium,
          expiry_date: expiryDateISO,
          technical_score: analysis.trendScore,
          trend_at_prediction: analysis.trend,
          rsi_at_prediction: analysis.rsi,
          tracked_until: new Date(new Date().getTime() + Math.min(daysToExpiry, 7) * 24 * 60 * 60 * 1000).toISOString()
        });
        console.log('✓ Prediction tracked for backtesting');
      } catch (error) {
        console.error('Failed to track prediction:', error);
      }
    }
    
    // Final confirmation log
    console.log(`
📊 FINAL LOT SIZE DETERMINATION:
  Symbol: ${symbol}
  Type: ${type}
  Lot Size: ${lotSize} units
  Source: ${lotSizeSource}
  Premium Source: ${dataSource}
  Total Investment: ₹${prediction.totalInvestment}
`);

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
        lotSizeSource,
        technicalAnalysis: {
          macd: analysis.macd,
          macdTrend: analysis.macdTrend,
          bollingerBands: {
            upper: analysis.upperBand,
            lower: analysis.lowerBand,
            position: analysis.bbPosition,
            signal: analysis.bbSignal
          },
          volume: {
            ratio: analysis.volumeRatio,
            signal: analysis.volumeSignal
          },
          volatility: {
            hv7d: analysis.hv7d,
            hv30d: analysis.hv30d,
            atr: analysis.atr,
            atrPercent: analysis.atrPercent
          },
          supportResistance: {
            support: analysis.support,
            resistance: analysis.resistance
          }
        }
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

// Calculate Historical Volatility (using log returns)
function calculateHistoricalVolatility(prices: number[], period: number = 30): number {
  if (prices.length < period + 1) return 0;
  
  const recentPrices = prices.slice(-period - 1);
  const logReturns: number[] = [];
  
  for (let i = 1; i < recentPrices.length; i++) {
    const logReturn = Math.log(recentPrices[i] / recentPrices[i - 1]);
    logReturns.push(logReturn);
  }
  
  const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const variance = logReturns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / logReturns.length;
  const stdDev = Math.sqrt(variance);
  
  const annualizedVol = stdDev * Math.sqrt(252) * 100;
  
  return Math.round(annualizedVol * 100) / 100;
}

// Calculate IV Rank (where current IV sits in the 52-week range)
async function calculateIVRank(supabase: any, symbol: string): Promise<number> {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  
  const { data, error } = await supabase
    .from('volatility_metrics')
    .select('implied_volatility_avg')
    .eq('symbol', symbol)
    .gte('date', oneYearAgo.toISOString().split('T')[0])
    .order('date', { ascending: false });
  
  if (error || !data || data.length === 0) return 50;
  
  const ivValues = data.map((d: any) => d.implied_volatility_avg).filter((v: number) => v !== null);
  if (ivValues.length === 0) return 50;
  
  const currentIV = ivValues[0];
  const minIV = Math.min(...ivValues);
  const maxIV = Math.max(...ivValues);
  
  if (maxIV === minIV) return 50;
  
  const ivRank = ((currentIV - minIV) / (maxIV - minIV)) * 100;
  return Math.round(ivRank);
}

// Black-Scholes simplified IV calculation
function calculateImpliedVolatility(
  premium: number,
  spot: number,
  strike: number,
  daysToExpiry: number,
  optionType: 'CE' | 'PE'
): number {
  const timeToExpiry = daysToExpiry / 365;
  const moneyness = spot / strike;
  
  const atmPremiumPercent = (premium / spot) * 100;
  const ivEstimate = atmPremiumPercent * Math.sqrt(252 / daysToExpiry);
  
  return Math.round(ivEstimate * 100) / 100;
}

function analyzeData(data: any[], newsSentiment?: { overall: string; strength?: string; confidence?: number; weightedScore?: number }) {
  const closes = data.map(d => d.close);
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const volumes = data.map(d => d.volume);
  const current = closes[closes.length - 1];
  
  // === RSI ===
  const changes = closes.slice(1).map((p, i) => p - closes[i]);
  const gains = changes.map(c => c > 0 ? c : 0);
  const losses = changes.map(c => c < 0 ? -c : 0);
  const avgGain = gains.slice(-14).reduce((a, b) => a + b, 0) / 14;
  const avgLoss = losses.slice(-14).reduce((a, b) => a + b, 0) / 14;
  const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  
  // === SMA ===
  const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  
  // === EMA (Exponential Moving Average) ===
  function calculateEMA(prices: number[], period: number): number {
    const k = 2 / (period + 1);
    let ema = prices[0];
    for (let i = 1; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }
    return ema;
  }
  
  const ema12 = calculateEMA(closes.slice(-26), 12);
  const ema26 = calculateEMA(closes.slice(-26), 26);
  const ema50 = closes.length >= 70 ? calculateEMA(closes.slice(-70), 50) : sma20;
  
  // === MACD ===
  const macd = ema12 - ema26;
  const macdSignalLine = calculateEMA(
    closes.slice(-35).map((_, i, arr) => {
      if (i < 26) return 0;
      const e12 = calculateEMA(arr.slice(0, i + 1).slice(-26), 12);
      const e26 = calculateEMA(arr.slice(0, i + 1).slice(-26), 26);
      return e12 - e26;
    }).filter(v => v !== 0),
    9
  );
  const macdHistogram = macd - macdSignalLine;
  const macdTrend = macdHistogram > 0 ? 'Bullish' : 'Bearish';
  
  // === Bollinger Bands ===
  const sma20_bb = sma20;
  const variance = closes.slice(-20)
    .reduce((sum, price) => sum + Math.pow(price - sma20_bb, 2), 0) / 20;
  const stdDev = Math.sqrt(variance);
  const upperBand = sma20_bb + (2 * stdDev);
  const lowerBand = sma20_bb - (2 * stdDev);
  const bbPosition = ((current - lowerBand) / (upperBand - lowerBand)) * 100;
  
  let bbSignal = 'Neutral';
  if (current > upperBand) bbSignal = 'Overbought';
  else if (current < lowerBand) bbSignal = 'Oversold';
  else if (bbPosition > 70) bbSignal = 'Near Overbought';
  else if (bbPosition < 30) bbSignal = 'Near Oversold';
  
  // === Volume Analysis ===
  const avgVolume20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const currentVolume = volumes[volumes.length - 1];
  const volumeRatio = currentVolume / avgVolume20;
  const volumeSignal = volumeRatio > 1.5 ? 'High Volume' : 
                       volumeRatio < 0.5 ? 'Low Volume' : 'Normal Volume';
  
  // === ATR (Average True Range) ===
  const trueRanges = [];
  for (let i = 1; i < data.length; i++) {
    const high = highs[i];
    const low = lows[i];
    const prevClose = closes[i - 1];
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }
  const atr = trueRanges.slice(-14).reduce((a, b) => a + b, 0) / 14;
  const atrPercent = (atr / current) * 100;
  
  // === Support & Resistance ===
  const recentLows = lows.slice(-20);
  const recentHighs = highs.slice(-20);
  const support = Math.min(...recentLows);
  const resistance = Math.max(...recentHighs);
  
  // === Multi-factor Trend Analysis (with Weighted News Sentiment Priority) ===
  let trendScore = 0;
  
  // HIGHEST PRIORITY: Weighted News Sentiment (overrides technical signals)
  if (newsSentiment) {
    const sentiment = newsSentiment as any;
    const strength = sentiment.strength || sentiment.overall;
    
    // Apply sentiment strength scoring
    if (strength === 'strong_positive') trendScore += 5;
    else if (strength === 'positive') trendScore += 2;
    else if (strength === 'negative') trendScore -= 2;
    else if (strength === 'strong_negative') trendScore -= 5;
    // neutral adds 0
    
    console.log(`  Sentiment contribution to trend: ${strength} = ${
      strength === 'strong_positive' ? '+5' :
      strength === 'positive' ? '+2' :
      strength === 'negative' ? '-2' :
      strength === 'strong_negative' ? '-5' : '0'
    } points`);
  }
  
  // Technical indicators (secondary)
  if (current > sma20) trendScore += 2;
  if (current > ema50) trendScore += 2;
  if (macdTrend === 'Bullish') trendScore += 2;
  if (rsi > 50 && rsi < 70) trendScore += 1;
  if (rsi > 70) trendScore -= 1;
  if (rsi < 30) trendScore += 1;
  if (volumeRatio > 1.2) trendScore += 1;
  
  const overallTrend = trendScore >= 4 ? 'Strong Bullish' :
                       trendScore >= 2 ? 'Bullish' :
                       trendScore <= -4 ? 'Strong Bearish' :
                       trendScore <= -2 ? 'Bearish' : 'Neutral';
  
  // Calculate historical volatility
  const hv7d = calculateHistoricalVolatility(closes, 7);
  const hv30d = calculateHistoricalVolatility(closes, 30);
  
  return {
    current: Math.round(current * 100) / 100,
    
    // Trend Indicators
    rsi: Math.round(rsi),
    sma20: Math.round(sma20 * 100) / 100,
    ema12: Math.round(ema12 * 100) / 100,
    ema26: Math.round(ema26 * 100) / 100,
    ema50: Math.round(ema50 * 100) / 100,
    
    // MACD
    macd: Math.round(macd * 100) / 100,
    macdSignal: Math.round(macdSignalLine * 100) / 100,
    macdHistogram: Math.round(macdHistogram * 100) / 100,
    macdTrend,
    
    // Bollinger Bands
    upperBand: Math.round(upperBand * 100) / 100,
    lowerBand: Math.round(lowerBand * 100) / 100,
    bbPosition: Math.round(bbPosition),
    bbSignal,
    
    // Volume
    avgVolume20: Math.round(avgVolume20),
    currentVolume: Math.round(currentVolume),
    volumeRatio: Math.round(volumeRatio * 100) / 100,
    volumeSignal,
    
    // Volatility
    atr: Math.round(atr * 100) / 100,
    atrPercent: Math.round(atrPercent * 100) / 100,
    hv7d,
    hv30d,
    
    // Support/Resistance
    support: Math.round(support * 100) / 100,
    resistance: Math.round(resistance * 100) / 100,
    
    // Overall Assessment
    trend: overallTrend,
    trendScore,
  };
}
