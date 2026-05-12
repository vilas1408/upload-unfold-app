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

// PRIORITY 6: News Source Credibility Weights
const NEWS_SOURCE_WEIGHTS: { [key: string]: number } = {
  'economictimes.com': 1.0,
  'moneycontrol.com': 1.0,
  'livemint.com': 1.0,
  'business-standard.com': 1.0,
  'financialexpress.com': 0.8,
  'ndtv.com': 0.8,
  'reuters.com': 0.8,
  'bloomberg.com': 0.8,
  'Google News': 0.5,
  'default': 0.3
};

// PRIORITY 6: Sector correlation mapping
const SECTOR_MAPPING: { [key: string]: string[] } = {
  'ICICIBANK': ['banking sector India', 'HDFC Bank', 'SBI'],
  'HDFCBANK': ['banking sector India', 'ICICI Bank', 'SBI'],
  'SBIN': ['banking sector India', 'ICICI Bank', 'HDFC Bank'],
  'AXISBANK': ['banking sector India', 'ICICI Bank', 'Kotak'],
  'RELIANCE': ['oil sector India', 'energy stocks India', 'petrochemical'],
  'TCS': ['IT sector India', 'Infosys', 'Wipro'],
  'INFY': ['IT sector India', 'TCS', 'HCL Tech'],
  'WIPRO': ['IT sector India', 'TCS', 'Infosys'],
  'TATAMOTORS': ['auto sector India', 'automobile India', 'Maruti'],
  'MARUTI': ['auto sector India', 'automobile India', 'Mahindra']
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

// Format date for NSE API (DD-MMM-YYYY format e.g., "09-Dec-2025")
function formatExpiryForNSE(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = date.getUTCDate().toString().padStart(2, '0');
  const month = months[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

// Fetch option chain data from NSE and extract marketLot
async function fetchNSEOptionChain(
  symbol: string, 
  type: 'index' | 'share',
  expiryDateNSE?: string  // Format 'DD-MMM-YYYY' e.g., '09-Dec-2025'
): Promise<{ data: any, marketLot: number | null, availableExpiries: string[], usedExpiry: string | null }> {
  try {
    console.log(`Fetching NSE option chain for ${type}: ${symbol}${expiryDateNSE ? ` (expiry: ${expiryDateNSE})` : ''}`);
    
    // Get fresh cookies
    const cookies = await getNSECookies();
    
    // Use different API endpoint based on type
    const baseUrl = type === 'index' 
      ? 'https://www.nseindia.com/api/option-chain-indices'
      : 'https://www.nseindia.com/api/option-chain-equities';
    
    // Build URL with expiry filter if provided
    let url = `${baseUrl}?symbol=${symbol}`;
    
    // Fetch option chain data
    const response = await fetch(url, {
      headers: {
        ...NSE_HEADERS,
        'Cookie': cookies,
      },
    });
    
    if (!response.ok) {
      console.error(`NSE API returned status ${response.status}`);
      return { data: null, marketLot: null, availableExpiries: [], usedExpiry: null };
    }
    
    const data = await response.json();
    console.log('Successfully fetched NSE option chain data');
    
    // Extract available expiry dates from NSE response
    const availableExpiries: string[] = data?.records?.expiryDates || [];
    console.log(`Available expiries from NSE: ${availableExpiries.slice(0, 5).join(', ')}${availableExpiries.length > 5 ? '...' : ''}`);
    
    // Determine which expiry to use
    let usedExpiry: string | null = null;
    let filteredData = data;
    
    if (expiryDateNSE && availableExpiries.length > 0) {
      // Check if requested expiry is available
      if (availableExpiries.includes(expiryDateNSE)) {
        usedExpiry = expiryDateNSE;
        console.log(`✓ Using requested expiry: ${expiryDateNSE}`);
      } else {
        // Find nearest available expiry
        const requestedDate = new Date(expiryDateNSE.replace(/-/g, ' '));
        let nearestExpiry = availableExpiries[0];
        let minDiff = Infinity;
        
        for (const expiry of availableExpiries) {
          const expiryDate = new Date(expiry.replace(/-/g, ' '));
          const diff = Math.abs(expiryDate.getTime() - requestedDate.getTime());
          if (diff < minDiff) {
            minDiff = diff;
            nearestExpiry = expiry;
          }
        }
        usedExpiry = nearestExpiry;
        console.log(`⚠️ Requested expiry ${expiryDateNSE} not available, using nearest: ${nearestExpiry}`);
      }
      
      // Filter records to only include the selected expiry
      if (usedExpiry && data?.records?.data) {
        const originalCount = data.records.data.length;
        filteredData = {
          ...data,
          records: {
            ...data.records,
            data: data.records.data.filter((record: any) => record.expiryDate === usedExpiry)
          }
        };
        console.log(`Filtered records: ${filteredData.records.data.length} of ${originalCount} for expiry ${usedExpiry}`);
      }
    } else if (availableExpiries.length > 0) {
      usedExpiry = availableExpiries[0]; // Default to nearest expiry
      console.log(`Using default nearest expiry: ${usedExpiry}`);
    }
    
    // Extract marketLot from first record
    const records = filteredData?.records?.data || [];
    let marketLot: number | null = null;
    
    if (records.length > 0 && records[0].marketLot) {
      marketLot = records[0].marketLot;
      console.log(`✓ NSE API marketLot extracted: ${marketLot} units`);
    }
    
    return { data: filteredData, marketLot, availableExpiries, usedExpiry };
  } catch (error) {
    console.error('❌ CRITICAL: NSE API CALL FAILED:', error);
    console.error('⚠️ Possible causes:');
    console.error('  - NSE rate limiting or blocking requests');
    console.error('  - Cookie expired or missing');
    console.error('  - Incorrect symbol format');
    console.error('  - Network timeout');
    console.error('📊 System will fall back to AI_ESTIMATED mode with approximate premiums');
    return { data: null, marketLot: null, availableExpiries: [], usedExpiry: null };
  }
}

// PRIORITY 2: Calculate Put-Call Ratio (PCR) from option chain data
function calculatePCR(optionChainData: any): { pcr: number | null, pcrOI: number | null, interpretation: string } {
  try {
    const records = optionChainData?.records?.data || [];
    if (records.length === 0) return { pcr: null, pcrOI: null, interpretation: 'N/A' };

    let totalCallOI = 0;
    let totalPutOI = 0;
    let totalCallVolume = 0;
    let totalPutVolume = 0;

    for (const record of records) {
      if (record.CE) {
        totalCallOI += record.CE.openInterest || 0;
        totalCallVolume += record.CE.totalTradedVolume || 0;
      }
      if (record.PE) {
        totalPutOI += record.PE.openInterest || 0;
        totalPutVolume += record.PE.totalTradedVolume || 0;
      }
    }

    const pcrOI = totalCallOI > 0 ? totalPutOI / totalCallOI : null;
    const pcrVolume = totalCallVolume > 0 ? totalPutVolume / totalCallVolume : null;

    let interpretation = 'Neutral';
    if (pcrOI !== null) {
      if (pcrOI > 1.2) interpretation = 'Bullish (High put writing = support expected)';
      else if (pcrOI > 1.0) interpretation = 'Mildly Bullish';
      else if (pcrOI > 0.8) interpretation = 'Neutral';
      else if (pcrOI > 0.6) interpretation = 'Mildly Bearish';
      else interpretation = 'Bearish (High call writing = resistance expected)';
    }

    console.log(`PCR Analysis: OI=${pcrOI?.toFixed(2)}, Volume=${pcrVolume?.toFixed(2)}, Signal=${interpretation}`);

    return { pcr: pcrVolume, pcrOI, interpretation };
  } catch (error) {
    console.error('Error calculating PCR:', error);
    return { pcr: null, pcrOI: null, interpretation: 'N/A' };
  }
}

// PRIORITY 3: Calculate Fibonacci Retracement Levels
function calculateFibonacciLevels(high: number, low: number, trend: string): { levels: { [key: string]: number }, interpretation: string } {
  const diff = high - low;
  
  // Fibonacci retracement levels
  const levels = {
    '0%': trend === 'Bullish' ? high : low,
    '23.6%': trend === 'Bullish' ? high - (diff * 0.236) : low + (diff * 0.236),
    '38.2%': trend === 'Bullish' ? high - (diff * 0.382) : low + (diff * 0.382),
    '50%': trend === 'Bullish' ? high - (diff * 0.5) : low + (diff * 0.5),
    '61.8%': trend === 'Bullish' ? high - (diff * 0.618) : low + (diff * 0.618),
    '78.6%': trend === 'Bullish' ? high - (diff * 0.786) : low + (diff * 0.786),
    '100%': trend === 'Bullish' ? low : high
  };

  const interpretation = trend === 'Bullish' 
    ? 'Look for buying opportunities at 38.2% or 61.8% retracement levels'
    : 'Look for selling opportunities at 38.2% or 61.8% retracement levels';

  console.log(`Fibonacci Levels (${trend}): 38.2%=${levels['38.2%'].toFixed(2)}, 50%=${levels['50%'].toFixed(2)}, 61.8%=${levels['61.8%'].toFixed(2)}`);

  return { levels, interpretation };
}

// PRIORITY 3: Calculate Daily Pivot Points
function calculatePivotPoints(high: number, low: number, close: number): { 
  pivot: number, 
  r1: number, r2: number, r3: number, 
  s1: number, s2: number, s3: number,
  interpretation: string 
} {
  const pivot = (high + low + close) / 3;
  
  // Standard Pivot Point formula
  const r1 = (2 * pivot) - low;
  const r2 = pivot + (high - low);
  const r3 = high + 2 * (pivot - low);
  
  const s1 = (2 * pivot) - high;
  const s2 = pivot - (high - low);
  const s3 = low - 2 * (high - pivot);

  let interpretation: string;
  if (close > pivot) {
    interpretation = `Price above pivot (₹${pivot.toFixed(2)}) - Bullish bias. R1: ₹${r1.toFixed(2)}, R2: ₹${r2.toFixed(2)}`;
  } else {
    interpretation = `Price below pivot (₹${pivot.toFixed(2)}) - Bearish bias. S1: ₹${s1.toFixed(2)}, S2: ₹${s2.toFixed(2)}`;
  }

  console.log(`Pivot Points: P=${pivot.toFixed(2)}, R1=${r1.toFixed(2)}, R2=${r2.toFixed(2)}, S1=${s1.toFixed(2)}, S2=${s2.toFixed(2)}`);

  return { pivot, r1, r2, r3, s1, s2, s3, interpretation };
}

// PRIORITY 2: Calculate Max Pain (strike with maximum OI loss for option writers)
function calculateMaxPain(optionChainData: any): { maxPain: number | null, interpretation: string } {
  try {
    const records = optionChainData?.records?.data || [];
    if (records.length === 0) return { maxPain: null, interpretation: 'N/A' };

    // Get unique strikes
    const strikesSet = new Set<number>();
    for (const r of records) {
      if (typeof r.strikePrice === 'number') {
        strikesSet.add(r.strikePrice);
      }
    }
    const strikes = Array.from(strikesSet).sort((a, b) => a - b);
    
    let minPain = Infinity;
    let maxPainStrike: number | null = null;

    for (const testStrike of strikes) {
      let totalPain = 0;

      for (const record of records) {
        const strike = record.strikePrice as number;
        const callOI = record.CE?.openInterest || 0;
        const putOI = record.PE?.openInterest || 0;

        // Call option pain (intrinsic value if ITM)
        if (testStrike > strike) {
          totalPain += callOI * (testStrike - strike);
        }

        // Put option pain (intrinsic value if ITM)
        if (testStrike < strike) {
          totalPain += putOI * (strike - testStrike);
        }
      }

      if (totalPain < minPain) {
        minPain = totalPain;
        maxPainStrike = testStrike;
      }
    }

    const interpretation = maxPainStrike 
      ? `Max Pain at ₹${maxPainStrike} - Price tends to gravitate here by expiry`
      : 'Unable to calculate Max Pain';

    console.log(`Max Pain: ${maxPainStrike}`);

    return { maxPain: maxPainStrike, interpretation };
  } catch (error) {
    console.error('Error calculating Max Pain:', error);
    return { maxPain: null, interpretation: 'N/A' };
  }
}

// Extract premium for a SPECIFIC strike from NSE option chain data
function extractPremiumForStrike(
  optionChainData: any, 
  strikePrice: number, 
  optionType: 'CE' | 'PE'
): { premium: number | null, iv: number | null } {
  try {
    const records = optionChainData?.records?.data || [];
    
    if (records.length === 0) {
      console.warn(`No records in option chain data`);
      return { premium: null, iv: null };
    }
    
    // Find the exact strike in option chain
    const strikeData = records.find((record: any) => record.strikePrice === strikePrice);
    
    if (!strikeData) {
      console.warn(`Strike ${strikePrice} not found in option chain. Available strikes: ${records.slice(0, 5).map((r: any) => r.strikePrice).join(', ')}...`);
      return { premium: null, iv: null };
    }
    
    const leg = strikeData[optionType];
    if (!leg) {
      console.warn(`${optionType} data not found for strike ${strikePrice}`);
      return { premium: null, iv: null };
    }
    
    const premium = leg.lastPrice ?? leg.ltp ?? null;
    const iv = leg.impliedVolatility ?? null;
    
    console.log(`✓ Premium for ${optionType} at strike ${strikePrice}: ₹${premium}, IV: ${iv}%`);
    return { premium, iv };
  } catch (error) {
    console.error('Error extracting premium for strike:', error);
    return { premium: null, iv: null };
  }
}

// Get list of available strikes from option chain (nearest to current price)
function getAvailableStrikes(optionChainData: any, currentPrice: number, count: number = 10): number[] {
  try {
    const records = optionChainData?.records?.data || [];
    if (records.length === 0) return [];
    
    const strikes = records
      .map((r: any) => r.strikePrice)
      .filter((s: number) => typeof s === 'number')
      .sort((a: number, b: number) => Math.abs(a - currentPrice) - Math.abs(b - currentPrice));
    
    return strikes.slice(0, count);
  } catch (error) {
    console.error('Error getting available strikes:', error);
    return [];
  }
}

// Extract ATM premium and IV from NSE option chain data
function extractATMPremiumAndIV(optionChainData: any, currentPrice: number, optionType: 'CE' | 'PE'): { premium: number | null, iv: number | null, atmStrike: number } {
  try {
    const records = optionChainData?.records?.data || [];
    
    if (records.length === 0) return { premium: null, iv: null, atmStrike: 0 };
    
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
      const iv = nearestLeg?.impliedVolatility ?? null;
      return { premium, iv, atmStrike };
    }
    
    // Log NSE data for debugging
    const leg = atmData[optionType];
    console.log(`NSE Data for ${optionType} at strike ${atmStrike}:`, {
      ltp: leg?.ltp,
      lastPrice: leg?.lastPrice,
      impliedVolatility: leg?.impliedVolatility,
      strikePrice: atmData.strikePrice
    });
    
    // Extract premium and IV (use ltp first, fallback to lastPrice)
    const premium = leg?.ltp ?? leg?.lastPrice ?? null;
    const iv = leg?.impliedVolatility ?? null;
    
    console.log(`${optionType} ATM at strike ${atmStrike}: Premium ₹${premium}, IV ${iv}%`);
    return { premium, iv, atmStrike };
  } catch (error) {
    console.error('Error extracting ATM data:', error);
    return { premium: null, iv: null, atmStrike: 0 };
  }
}

// Calculate IV percentile from historical IV data
async function calculateIVPercentile(symbol: string, currentIV: number, supabaseUrl: string, supabaseKey: string): Promise<{ ivRank: number, ivPercentile: number }> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Fetch last 30 days of IV data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: historicalIV, error } = await supabase
      .from('volatility_metrics')
      .select('implied_volatility_avg')
      .eq('symbol', symbol)
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
      .not('implied_volatility_avg', 'is', null)
      .order('date', { ascending: false });
    
    if (error || !historicalIV || historicalIV.length === 0) {
      console.log('No historical IV data found, using default rank of 50');
      return { ivRank: 50, ivPercentile: 50 };
    }
    
    // Calculate IV percentile
    const ivValues = historicalIV.map(d => d.implied_volatility_avg).filter(v => v !== null);
    const belowCurrent = ivValues.filter(v => v < currentIV).length;
    const ivPercentile = (belowCurrent / ivValues.length) * 100;
    
    // IV Rank is similar to percentile but normalized 0-100
    const ivRank = Math.round(ivPercentile);
    
    console.log(`IV Analysis: Current=${currentIV}%, Rank=${ivRank}, Percentile=${ivPercentile.toFixed(1)}% (based on ${ivValues.length} days)`);
    
    return { ivRank, ivPercentile };
  } catch (error) {
    console.error('Error calculating IV percentile:', error);
    return { ivRank: 50, ivPercentile: 50 };
  }
}

// Store IV metrics in database
async function storeIVMetrics(symbol: string, iv: number, ivRank: number, ivPercentile: number, supabaseUrl: string, supabaseKey: string) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const today = new Date().toISOString().split('T')[0];
    
    const { error } = await supabase
      .from('volatility_metrics')
      .upsert({
        symbol,
        date: today,
        implied_volatility_avg: iv,
        iv_rank: ivRank,
        iv_percentile: ivPercentile,
      }, {
        onConflict: 'symbol,date'
      });
    
    if (error) {
      console.error('Error storing IV metrics:', error);
    } else {
      console.log(`✓ Stored IV metrics for ${symbol}: IV=${iv}%, Rank=${ivRank}`);
    }
  } catch (error) {
    console.error('Error in storeIVMetrics:', error);
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

// PRIORITY 6: Check if article is high quality
function isHighQualityArticle(article: any): boolean {
  const title = article.title?.toLowerCase() || '';
  
  if (title.includes('shocking') || title.includes('you won\'t believe') || 
      title.includes('breaking:') || title.includes('!!!')) {
    return false;
  }
  
  if (title.length < 20) return false;
  
  const articleDate = new Date(article.publishedAt);
  const daysDiff = (Date.now() - articleDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysDiff > 7) return false;
  
  return true;
}

// PRIORITY 6: Detect major events from article text
function detectMajorEvents(article: any): { hasEvent: boolean, eventType: string | null, impact: string } {
  const text = `${article.title} ${article.description || ''}`.toLowerCase();
  
  const events = {
    'earnings': ['earnings', 'quarterly results', 'q1', 'q2', 'q3', 'q4', 'profit', 'revenue', 'results'],
    'rbi_policy': ['rbi', 'monetary policy', 'interest rate', 'repo rate', 'central bank'],
    'corporate_action': ['merger', 'acquisition', 'buyback', 'dividend', 'rights issue', 'split'],
    'regulatory': ['sebi', 'regulatory', 'investigation', 'penalty', 'compliance'],
    'management': ['ceo', 'cfo', 'resignation', 'appointment', 'founder']
  };
  
  for (const [eventType, keywords] of Object.entries(events)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      const impact = eventType === 'earnings' || eventType === 'rbi_policy' ? 'high' : 'medium';
      return { hasEvent: true, eventType, impact };
    }
  }
  
  return { hasEvent: false, eventType: null, impact: 'none' };
}

// PRIORITY 6: Get source credibility weight
function getSourceWeight(sourceName: string): number {
  for (const [source, weight] of Object.entries(NEWS_SOURCE_WEIGHTS)) {
    if (sourceName.toLowerCase().includes(source.toLowerCase())) {
      return weight;
    }
  }
  return NEWS_SOURCE_WEIGHTS['default'];
}

// PRIORITY 7: Calculate Black-Scholes Greeks
interface GreeksResult {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

function calculateBlackScholesGreeks(
  spot: number,
  strike: number,
  timeToExpiry: number,
  volatility: number,
  riskFreeRate: number,
  optionType: 'CE' | 'PE'
): GreeksResult {
  const S = spot;
  const K = strike;
  const T = timeToExpiry;
  const sigma = volatility;
  const r = riskFreeRate;
  
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  
  const N = (x: number) => {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - prob : prob;
  };
  
  const n = (x: number) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
  
  let delta: number, gamma: number, theta: number, vega: number, rho: number;
  
  if (optionType === 'CE') {
    delta = N(d1);
    gamma = n(d1) / (S * sigma * Math.sqrt(T));
    theta = (-(S * n(d1) * sigma) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * N(d2)) / 365;
    vega = S * n(d1) * Math.sqrt(T) / 100;
    rho = K * T * Math.exp(-r * T) * N(d2) / 100;
  } else {
    delta = N(d1) - 1;
    gamma = n(d1) / (S * sigma * Math.sqrt(T));
    theta = (-(S * n(d1) * sigma) / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * N(-d2)) / 365;
    vega = S * n(d1) * Math.sqrt(T) / 100;
    rho = -K * T * Math.exp(-r * T) * N(-d2) / 100;
  }
  
  return {
    delta: Math.round(delta * 1000) / 1000,
    gamma: Math.round(gamma * 10000) / 10000,
    theta: Math.round(theta * 100) / 100,
    vega: Math.round(vega * 100) / 100,
    rho: Math.round(rho * 100) / 100
  };
}

// PRIORITY 7: Validate prediction with Greeks
function validatePredictionWithGreeks(
  greeks: GreeksResult,
  daysToExpiry: number,
  ivRank: number
): { warnings: string[], riskAdjustment: number } {
  const warnings: string[] = [];
  let riskAdjustment = 0;
  
  if (Math.abs(greeks.delta) < 0.3) {
    warnings.push('Low delta (<0.3) - option may not move much with underlying');
    riskAdjustment -= 10;
  }
  
  if (daysToExpiry <= 5 && greeks.theta < -50) {
    warnings.push(`High time decay (₹${Math.abs(greeks.theta)}/day) - rapid premium erosion`);
    riskAdjustment -= 15;
  }
  
  if (ivRank > 70 && greeks.vega > 100) {
    warnings.push('High vega + elevated IV - premium may collapse if volatility drops');
    riskAdjustment -= 10;
  }
  
  if (greeks.gamma > 0.05) {
    warnings.push('High gamma - delta will change rapidly, requires active monitoring');
  }
  
  if (ivRank < 30 && greeks.vega > 80) {
    warnings.push('✓ Low IV + high vega - good setup for volatility expansion');
    riskAdjustment += 10;
  }
  
  return { warnings, riskAdjustment };
}

// PRIORITY 7: Position sizing recommendation
function getPositionSizeRecommendation(
  greeks: GreeksResult,
  ivRank: number,
  daysToExpiry: number
): { sizeMultiplier: number, reasoning: string } {
  let sizeMultiplier = 1.0;
  const reasons: string[] = [];
  
  if (greeks.theta < -50 && daysToExpiry <= 5) {
    sizeMultiplier *= 0.7;
    reasons.push('Reduced due to high time decay');
  }
  
  if (ivRank > 70) {
    sizeMultiplier *= 0.8;
    reasons.push('Reduced due to elevated IV');
  }
  
  if (Math.abs(greeks.delta) > 0.5 && greeks.theta > -30 && ivRank < 40) {
    sizeMultiplier *= 1.2;
    reasons.push('Increased due to favorable risk/reward');
  }
  
  return {
    sizeMultiplier: Math.round(sizeMultiplier * 100) / 100,
    reasoning: reasons.length > 0 ? reasons.join('; ') : 'Standard position size'
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

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Extract user from JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Check user's plan and daily limit
    const { data: planData, error: planError } = await supabase
      .from('user_plans')
      .select('plan, daily_prediction_limit')
      .eq('user_id', user.id)
      .single();

    if (planError || !planData) {
      console.error('Plan fetch error:', planError);
      return new Response(
        JSON.stringify({ error: 'User plan not found. Please contact support.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Count today's predictions (IST timezone)
    const istNow = getCurrentISTTime();
    const todayIST = istNow.toISOString().split('T')[0];

    const { count: todayCount, error: countError } = await supabase
      .from('prediction_tracking')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('predicted_at', `${todayIST}T00:00:00`)
      .lt('predicted_at', `${todayIST}T23:59:59`);

    if (countError) {
      console.error('Count error:', countError);
    }

    const predictionsUsed = todayCount || 0;

    // Check if limit exceeded (premium users have -1 = unlimited)
    if (planData.daily_prediction_limit !== -1 && predictionsUsed >= planData.daily_prediction_limit) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Daily prediction limit reached (${predictionsUsed}/${planData.daily_prediction_limit})`,
          limit: planData.daily_prediction_limit,
          used: predictionsUsed,
          plan: planData.plan,
          message: `You've used all ${planData.daily_prediction_limit} free predictions today. Upgrade to Premium for unlimited predictions or try again tomorrow.`
        }),
        { status: 429, headers: corsHeaders }
      );
    }

    console.log(`✅ User ${user.email} quota check: ${predictionsUsed}/${planData.daily_prediction_limit} used today`);

    // PHASE 3: Fetch auto-learning tuning parameters
    const currentDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][istNow.getUTCDay()];
    const { data: tuningData } = await supabase
      .from('prediction_tuning')
      .select('*')
      .in('tuning_key', [symbol, currentDay]);
    
    let symbolAdjustment = 0;
    let dayAdjustment = 0;
    let learningContext = '';
    
    if (tuningData && tuningData.length > 0) {
      for (const tuning of tuningData) {
        if (tuning.tuning_type === 'symbol' && tuning.tuning_key === symbol) {
          symbolAdjustment = tuning.confidence_adjustment || 0;
          learningContext += `\n- ${symbol} historical accuracy: ${tuning.accuracy_rate?.toFixed(1)}% (${tuning.sample_size} predictions, confidence: ${symbolAdjustment > 0 ? '+' : ''}${symbolAdjustment}%)`;
        }
        if (tuning.tuning_type === 'day' && tuning.tuning_key === currentDay) {
          dayAdjustment = tuning.confidence_adjustment || 0;
          learningContext += `\n- ${currentDay} historical accuracy: ${tuning.accuracy_rate?.toFixed(1)}% (${tuning.sample_size} predictions, confidence: ${dayAdjustment > 0 ? '+' : ''}${dayAdjustment}%)`;
        }
      }
      console.log(`📚 Learning adjustments: Symbol ${symbolAdjustment}%, Day ${dayAdjustment}%`);
    }

    // Fetch historical data
    const historicalData = await fetchStockData(symbol);
    let analysis = analyzeData(historicalData); // Will be re-analyzed after news fetch
    
    // PRIORITY 4: Fetch Market Context (Nifty correlation, VIX, time-of-day)
    const marketContext = await fetchMarketContext(symbol, type);
    
    // PRIORITY 6: Enhanced news fetching with source credibility and event detection
    const NEWS_API_KEY = Deno.env.get('NEWS_API_KEY');
    let newsSentiment: { overall: string; summary: string; articles: any[]; confidence?: number } = { 
      overall: 'neutral', 
      summary: 'No recent news available', 
      articles: [],
      confidence: 50 
    };
    let detectedEvents: any[] = [];
    let sectorSentiment: string | null = null;
    
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
          // PRIORITY 6: Filter high-quality articles
          const qualityArticles = articles.filter(isHighQualityArticle);
          console.log(`Filtered ${qualityArticles.length}/${articles.length} high-quality articles`);
          
          // PRIORITY 6: Detect major events
          for (const article of qualityArticles.slice(0, 10)) {
            const eventInfo = detectMajorEvents(article);
            if (eventInfo.hasEvent) {
              detectedEvents.push({
                title: article.title,
                eventType: eventInfo.eventType,
                impact: eventInfo.impact
              });
              console.log(`⚠️ Event detected: ${eventInfo.eventType} (${eventInfo.impact} impact) - ${article.title}`);
            }
          }
          
          // Use Lovable AI Gateway to analyze sentiment of real news articles
          const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
          if (LOVABLE_API_KEY) {
            const articlesForAnalysis = qualityArticles.slice(0, 10).map((a: any) => ({
              title: a.title,
              description: a.description || a.title,
              source: a.source?.name,
              credibilityWeight: getSourceWeight(a.source?.name || 'default')
            }));
            
            // PRIORITY 6: Fetch sector-wide sentiment for correlation
            if (SECTOR_MAPPING[symbol]) {
              try {
                const sectorQuery = SECTOR_MAPPING[symbol][0];
                console.log(`Fetching sector sentiment for: ${sectorQuery}`);
                const sectorArticles = await fetchGoogleNewsRSS(sectorQuery);
                
                if (sectorArticles.length > 0) {
                  const sectorPrompt = `You are a financial sector sentiment analyzer. Return ONLY: "positive", "negative", or "neutral".\n\nAnalyze sector sentiment from these headlines:\n${sectorArticles.slice(0, 5).map((a: any) => a.title).join('\n')}`;
                  
                  const sectorSentimentResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                    method: 'POST',
                    headers: { 
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${LOVABLE_API_KEY}`
                    },
                    body: JSON.stringify({
                      model: "google/gemini-2.5-flash",
                      messages: [{ role: "user", content: sectorPrompt }],
                    }),
                  });
                  
                  if (sectorSentimentResponse.ok) {
                    const sectorData = await sectorSentimentResponse.json();
                    sectorSentiment = sectorData.choices?.[0]?.message?.content?.toLowerCase().trim();
                    console.log(`Sector sentiment: ${sectorSentiment}`);
                  }
                }
              } catch (error) {
                console.error('Sector sentiment fetch failed:', error);
              }
            }
            
            const newsPrompt = `You are a financial news sentiment analyzer with source credibility awareness. Higher credibility sources (economictimes.com, moneycontrol.com) should have more weight. Analyze sentiment and return ONLY valid JSON.

Analyze the sentiment of these news articles about ${name} (${symbol}). Consider source credibility weights and detected events:

Articles:
${JSON.stringify(articlesForAnalysis, null, 2)}

${detectedEvents.length > 0 ? `Detected Events: ${JSON.stringify(detectedEvents, null, 2)}` : ''}
${sectorSentiment ? `Sector Sentiment: ${sectorSentiment}` : ''}

Return this JSON format:
{
  "overall": "positive" | "negative" | "neutral",
  "summary": "brief summary considering source credibility and events (1-2 sentences)",
  "confidence": 0-100,
  "articles": [{"title": "string", "sentiment": "positive/negative/neutral", "impact": "high/medium/low"}]
}`;
            
            const sentimentResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            
            if (sentimentResponse.ok) {
              const sentimentData = await sentimentResponse.json();
              const content = sentimentData.choices?.[0]?.message?.content;
              if (content) {
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  newsSentiment = JSON.parse(jsonMatch[0]);
                  
                  // PRIORITY 6: Adjust confidence based on event detection and sector correlation
                  let confidenceAdjustment = 0;
                  if (detectedEvents.length > 0) {
                    confidenceAdjustment -= 15; // Reduce confidence during major events
                    console.log(`⚠️ Confidence reduced by 15% due to ${detectedEvents.length} detected event(s)`);
                  }
                  if (sectorSentiment && sectorSentiment !== newsSentiment.overall) {
                    confidenceAdjustment -= 10; // Sector conflict
                    console.log(`⚠️ Confidence reduced by 10% due to sector sentiment conflict`);
                  } else if (sectorSentiment && sectorSentiment === newsSentiment.overall) {
                    confidenceAdjustment += 10; // Sector alignment
                    console.log(`✓ Confidence increased by 10% due to sector sentiment alignment`);
                  }
                  
                  newsSentiment.confidence = Math.max(0, Math.min(100, (newsSentiment.confidence || 50) + confidenceAdjustment));
                  
                  console.log(`✓ News sentiment analyzed: ${newsSentiment.overall} (confidence: ${newsSentiment.confidence}%, ${qualityArticles.length} quality articles, source: ${queryUsed || 'Google News RSS'})`);
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
      
      if (currentDay < 2) {
        // Sun-Mon → this Tuesday
        daysUntilTuesday = 2 - currentDay;
      } else if (currentDay === 2) {
        // Today is Tuesday (expiry day) → roll to NEXT Tuesday for new entries
        // (today's contract is expiring; not safe to recommend a fresh buy)
        daysUntilTuesday = 7;
        console.log('Today is expiry day → rolling to next Tuesday for new entries');
      } else {
        // Wed-Sat → next Tuesday
        daysUntilTuesday = 7 - currentDay + 2;
      }
      
      const tuesday = new Date(istTime);
      tuesday.setUTCDate(istTime.getUTCDate() + daysUntilTuesday);
      expiryDateISO = tuesday.toISOString().split('T')[0];
      daysToExpiry = daysUntilTuesday;
      isExpiryToday = false;
      
      expiryDate = tuesday.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
      }).toUpperCase();
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

    // Create NSE format expiry date (DD-MMM-YYYY)
    // Parse the expiryDateISO (YYYY-MM-DD) to create NSE format
    const expiryParts = expiryDateISO.split('-');
    const expiryDateObj = new Date(Date.UTC(
      parseInt(expiryParts[0]),
      parseInt(expiryParts[1]) - 1,
      parseInt(expiryParts[2])
    ));
    const expiryDateNSE = formatExpiryForNSE(expiryDateObj);
    console.log(`Calculated expiry: ${expiryDate} (NSE format: ${expiryDateNSE}, Days to expiry: ${daysToExpiry})`);


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
    
    console.log(`Fetching real option chain data from NSE for ${nseSymbolToFetch} (expiry: ${expiryDateNSE})`);
    const nseResult = await fetchNSEOptionChain(nseSymbolToFetch, type, expiryDateNSE);
    
    // Log which expiry was actually used (may differ if requested wasn't available)
    if (nseResult.usedExpiry && nseResult.usedExpiry !== expiryDateNSE) {
      console.log(`⚠️ NSE returned data for expiry ${nseResult.usedExpiry} instead of requested ${expiryDateNSE}`);
    }
    
    // Initialize IV variables
    let realCallIV: number | null = null;
    let realPutIV: number | null = null;
    let ivRank = 50; // Default
    let ivPercentile = 50; // Default
    
    if (nseResult.data) {
      const callData = extractATMPremiumAndIV(nseResult.data, analysis.current, 'CE');
      const putData = extractATMPremiumAndIV(nseResult.data, analysis.current, 'PE');
      
      realCallPremium = callData.premium;
      realPutPremium = putData.premium;
      realCallIV = callData.iv;
      realPutIV = putData.iv;
      nseMarketLot = nseResult.marketLot;
      
      // Store ATM strike for later comparison with AI's recommended strike
      const atmStrikeFromNSE = callData.atmStrike || putData.atmStrike || 0;
      
      if (realCallPremium || realPutPremium) {
        dataSource = 'NSE_LIVE';
        console.log(
          `Successfully fetched NSE data - ATM Strike: ${atmStrikeFromNSE}, Call: ₹${realCallPremium ?? 'N/A'} (IV: ${realCallIV ?? 'N/A'}%), ` +
          `Put: ₹${realPutPremium ?? 'N/A'} (IV: ${realPutIV ?? 'N/A'}%)`
        );
      }
      
      // Calculate IV percentile and rank if we have IV data
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (supabaseUrl && supabaseKey && (realCallIV || realPutIV)) {
        const avgIV = realCallIV && realPutIV ? (realCallIV + realPutIV) / 2 : (realCallIV || realPutIV)!;
        const ivMetrics = await calculateIVPercentile(symbol, avgIV, supabaseUrl, supabaseKey);
        ivRank = ivMetrics.ivRank;
        ivPercentile = ivMetrics.ivPercentile;
        
        // Store IV metrics for future comparisons
        await storeIVMetrics(symbol, avgIV, ivRank, ivPercentile, supabaseUrl, supabaseKey);
      }
    }

    // PRIORITY 2 & 3: Calculate PCR, Max Pain, Fibonacci, and Pivot Points
    let pcrAnalysis = { pcr: null as number | null, pcrOI: null as number | null, interpretation: 'N/A' };
    let maxPainAnalysis = { maxPain: null as number | null, interpretation: 'N/A' };
    let fibonacciAnalysis = { levels: {} as { [key: string]: number }, interpretation: 'N/A' };
    let pivotAnalysis = { pivot: 0, r1: 0, r2: 0, r3: 0, s1: 0, s2: 0, s3: 0, interpretation: 'N/A' };

    // Calculate from NSE option chain data if available
    if (nseResult.data) {
      pcrAnalysis = calculatePCR(nseResult.data);
      maxPainAnalysis = calculateMaxPain(nseResult.data);
    }

    // Calculate Fibonacci from historical data
    if (historicalData.length > 0) {
      const highs = historicalData.map((d: any) => d.high);
      const lows = historicalData.map((d: any) => d.low);
      const recentHigh = Math.max(...highs.slice(-20));
      const recentLow = Math.min(...lows.slice(-20));
      fibonacciAnalysis = calculateFibonacciLevels(recentHigh, recentLow, analysis.trend.includes('Bullish') ? 'Bullish' : 'Bearish');

      // Calculate Pivot Points from yesterday's data
      const yesterdayData = historicalData[historicalData.length - 2];
      if (yesterdayData) {
        pivotAnalysis = calculatePivotPoints(yesterdayData.high, yesterdayData.low, yesterdayData.close);
      }
    }

    if (!nseResult.data) {
      // NSE data fetch failed - log detailed error
      console.error('❌ NSE DATA UNAVAILABLE for', symbol);
      console.error('⚠️ Falling back to AI_ESTIMATED mode with approximate premiums');
      console.error('📋 Possible causes:');
      console.error('  - NSE API rate limiting or blocking requests');
      console.error('  - Session cookies expired');
      console.error('  - Incorrect symbol format for NSE');
      console.error('  - Network timeout or connectivity issues');
      console.error('💡 Impact: Premiums will be estimated ranges, not live NSE prices');
    }
    
    // PRIORITY 1: Use NSE API marketLot if available (most authoritative)
    if (nseMarketLot && nseMarketLot > 0 && type === 'share') {
      lotSize = nseMarketLot;
      lotSizeSource = 'nse-api';
      console.log(`✓ Lot size from NSE API (PRIORITY 1): ${lotSize} units`);
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
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
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
    
    // Build IV context for AI
    let ivContext: string;
    const ivLevel = ivRank > 70 ? 'HIGH' : ivRank > 40 ? 'MODERATE' : 'LOW';
    const ivStrategy = ivRank > 70 ? 'Consider buying strategies - premiums are elevated' : 
                       ivRank > 40 ? 'Balanced approach - moderate premiums' : 
                       'Premium buying opportunities - IV is low';
    
    if (realCallIV || realPutIV) {
      const avgIV = realCallIV && realPutIV ? (realCallIV + realPutIV) / 2 : (realCallIV || realPutIV)!;
      ivContext = `IMPLIED VOLATILITY (Real NSE Data):
- Current IV: ${avgIV.toFixed(2)}% (Call: ${realCallIV?.toFixed(2) ?? 'N/A'}%, Put: ${realPutIV?.toFixed(2) ?? 'N/A'}%)
- IV Rank: ${ivRank}/100 (${ivLevel})
- IV Percentile: ${ivPercentile.toFixed(1)}%
- Strategy Guidance: ${ivStrategy}

IV Rank ${ivRank} means current IV is ${ivRank > 50 ? 'ABOVE' : 'BELOW'} average levels.`;
    } else {
      ivContext = `IMPLIED VOLATILITY (Estimated):
- IV Rank: ${ivRank}/100 (using historical averages)
- IV Level: MODERATE (default)

Note: Real IV data not available from NSE.`;
    }
    
    // Build premium context for AI
    let premiumContext: string;
    
    if (dataSource === 'NSE_LIVE' && realCallPremium && realPutPremium) {
      premiumContext = `REAL OPTION PREMIUMS (from NSE Live Data):
- ATM Call Premium: ₹${realCallPremium} per lot (IV: ${realCallIV?.toFixed(2) ?? 'N/A'}%)
- ATM Put Premium: ₹${realPutPremium} per lot (IV: ${realPutIV?.toFixed(2) ?? 'N/A'}%)
- Data Source: Live NSE Option Chain
- Days to Expiry: ${daysToExpiry}

Use these REAL premiums for your recommendation. Suggest strikes near ATM based on market view.`;
    } else if (dataSource === 'NSE_LIVE' && realCallPremium) {
      premiumContext = `REAL OPTION PREMIUM (from NSE Live Data):
- ATM Call Premium: ₹${realCallPremium} per lot (IV: ${realCallIV?.toFixed(2) ?? 'N/A'}%)
- Data Source: Live NSE Option Chain (Call side)
- Days to Expiry: ${daysToExpiry}

Use this REAL CALL premium for your recommendation.`;
    } else if (dataSource === 'NSE_LIVE' && realPutPremium) {
      premiumContext = `REAL OPTION PREMIUM (from NSE Live Data):
- ATM Put Premium: ₹${realPutPremium} per lot (IV: ${realPutIV?.toFixed(2) ?? 'N/A'}%)
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

${ivContext}

${premiumContext}

${learningContext ? `
HISTORICAL LEARNING DATA (Auto-tuned from past predictions):${learningContext}

Use this historical performance data to adjust your confidence. If accuracy is low (<50%), be more conservative.` : ''}

⚠️ CRITICAL RULE: NEWS SENTIMENT OVERRIDES TECHNICAL ANALYSIS
- If NEWS SENTIMENT is "negative" → YOU MUST RECOMMEND "Long Put" (BEARISH) with PUT option
- If NEWS SENTIMENT is "positive" → YOU MUST RECOMMEND "Long Call" (BULLISH) with CALL option
- If NEWS SENTIMENT is "neutral" → Use technical analysis to decide

SECONDARY RULES (only if sentiment is neutral):
- BULLISH technical signals: Recommend BUY CALL
- BEARISH technical signals: Recommend BUY PUT
- Provide SPECIFIC entry, target, and stop loss prices
- Consider time decay (theta) impact given ${daysToExpiry} days to expiry
${dataSource === 'NSE_LIVE' ? '- Use REAL premiums from NSE data' : '- Use ESTIMATED premiums with realistic time value'}

🔴 CRITICAL JSON FORMATTING RULE:
ALL numeric values in your JSON response MUST be CALCULATED NUMBERS, NOT mathematical expressions or formulas.
✅ CORRECT: "target": 1791
❌ WRONG: "target": 75 * (103.48 - 79.6)
Calculate all math operations and provide the final numeric result only.`;

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

OPTIONS FLOW ANALYSIS (PRIORITY 2):
- Put-Call Ratio (OI): ${pcrAnalysis.pcrOI?.toFixed(2) ?? 'N/A'} - ${pcrAnalysis.interpretation}
- Max Pain: ${maxPainAnalysis.maxPain ? `₹${maxPainAnalysis.maxPain}` : 'N/A'} - ${maxPainAnalysis.interpretation}

PIVOT POINTS (PRIORITY 3):
- Pivot: ₹${pivotAnalysis.pivot.toFixed(2)}
- Resistance 1: ₹${pivotAnalysis.r1.toFixed(2)}, R2: ₹${pivotAnalysis.r2.toFixed(2)}
- Support 1: ₹${pivotAnalysis.s1.toFixed(2)}, S2: ₹${pivotAnalysis.s2.toFixed(2)}
- ${pivotAnalysis.interpretation}

FIBONACCI LEVELS (PRIORITY 3):
- 38.2%: ₹${fibonacciAnalysis.levels['38.2%']?.toFixed(2) ?? 'N/A'}
- 50%: ₹${fibonacciAnalysis.levels['50%']?.toFixed(2) ?? 'N/A'}
- 61.8%: ₹${fibonacciAnalysis.levels['61.8%']?.toFixed(2) ?? 'N/A'}
- ${fibonacciAnalysis.interpretation}

OVERALL TREND: ${analysis.trend} (Score: ${analysis.trendScore}/10)

NEWS SENTIMENT: ${newsSentiment.overall} - ${newsSentiment.summary}

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
    "target": <CALCULATED profit number in rupees, e.g. 1791 NOT 75*(103.48-79.6)>,
    "stopLoss": <CALCULATED loss as negative number, e.g. -2388 NOT 75*(-31.8)>,
    "breakeven": <CALCULATED breakeven price, e.g. 26120.4 NOT 26100+20.4>
  },
  "expectedReturn": <30-50 percentage>,
  "probability": "<40-70>%",
  "maxLoss": <totalInvestment>,
  "maxGain": <realistic gain in rupees>,
  "breakeven": <strike ± premium>,
  "ivRank": ${ivRank},
  "greeks": {"delta": <0.4-0.6>, "gamma": <0.01-0.05>, "theta": <-10 to -50>, "vega": <50-150>},
  "reasoning": "Brief analysis (2-3 lines) including news sentiment impact and technical factors",
  "riskLevel": "Low|Medium|High",
  "timeFrame": "Intraday (Exit before 3:15 PM)",
  "technicalScore": <0-100>,
  "newsSentiment": {
    "overall": "${newsSentiment.overall}",
    "summary": "${newsSentiment.summary}",
    "articles": ${JSON.stringify(newsSentiment.articles)}
  }
}`;

    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
    
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
      console.error('AI response without JSON:', content);
      throw new Error('Could not parse AI response');
    }

    // Helper function to sanitize JSON by evaluating mathematical expressions
    const sanitizeJSON = (jsonString: string): string => {
      // Match and replace mathematical expressions like "75 * (103.48 - 79.6)" with calculated values
      return jsonString.replace(/:\s*([0-9]+(?:\.[0-9]+)?)\s*([+\-*/])\s*\(([^)]+)\)/g, (match, num1, operator, expression) => {
        try {
          // Safely evaluate simple math expressions
          const fullExpression = `${num1} ${operator} (${expression})`;
          const result = Function(`"use strict"; return (${fullExpression})`)();
          return `: ${result}`;
        } catch {
          return match; // Return original if evaluation fails
        }
      }).replace(/:\s*([0-9]+(?:\.[0-9]+)?)\s*([+\-*/])\s*([0-9]+(?:\.[0-9]+)?)/g, (match, num1, operator, num2) => {
        try {
          // Handle simple expressions like "26100 + 20.4"
          const result = Function(`"use strict"; return (${num1} ${operator} ${num2})`)();
          return `: ${result}`;
        } catch {
          return match;
        }
      });
    };

    let prediction;
    try {
      const sanitizedJSON = sanitizeJSON(jsonMatch[0]);
      prediction = JSON.parse(sanitizedJSON);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Content to parse:', jsonMatch[0]);
      throw new Error('Invalid JSON in AI response');
    }
    
    // PRIORITY 3: Weighted Confidence Scoring (40% sentiment, 40% technical, 20% volume)
    const sentimentWeight = 0.4;
    const technicalWeight = 0.4;
    const volumeWeight = 0.2;
    
    // Calculate sentiment score (-100 to +100)
    let sentimentScore = 0;
    let sentimentConfidence = 'low';
    
    if (newsSentiment.overall === 'positive') {
      sentimentScore = 70;
      sentimentConfidence = newsSentiment.articles?.some((a: any) => a.impact === 'high') ? 'high' : 'medium';
    } else if (newsSentiment.overall === 'negative') {
      sentimentScore = -70;
      sentimentConfidence = newsSentiment.articles?.some((a: any) => a.impact === 'high') ? 'high' : 'medium';
    }
    
    // Calculate technical score (-100 to +100) based on trend score
    const technicalScore = (analysis.trendScore / 10) * 100; // Normalize -10 to +10 range to -100 to +100
    
    // Calculate volume score (-100 to +100)
    const volumeScore = analysis.volumeRatio > 1.5 ? 50 : 
                        analysis.volumeRatio > 1.2 ? 30 :
                        analysis.volumeRatio < 0.8 ? -30 : 0;
    
    // Weighted confidence score
    const baseConfidenceScore = (sentimentScore * sentimentWeight) + 
                           (technicalScore * technicalWeight) + 
                           (volumeScore * volumeWeight);
    
    // PHASE 3: Apply auto-learning adjustments
    const confidenceScore = Math.max(0, Math.min(100, 
      baseConfidenceScore + symbolAdjustment + dayAdjustment
    ));
    
    if (symbolAdjustment !== 0 || dayAdjustment !== 0) {
      console.log(`📊 Confidence adjusted: Base ${baseConfidenceScore.toFixed(1)}% → Final ${confidenceScore.toFixed(1)}% (Symbol: ${symbolAdjustment > 0 ? '+' : ''}${symbolAdjustment}%, Day: ${dayAdjustment > 0 ? '+' : ''}${dayAdjustment}%)`);
    }
    
    // Strategy override logic (only when high confidence and conflicting signals)
    let strategyAutoCorrect = false;
    const shouldOverride = sentimentConfidence === 'high' && Math.abs(sentimentScore) > 60;
    
    if (shouldOverride && newsSentiment.overall === 'negative' && prediction.optionType === 'CALL') {
      console.error(`❌ STRATEGY CONFLICT: Strong negative sentiment (${sentimentScore}) but AI recommended CALL!`);
      console.log(`🔄 Auto-correcting strategy to PUT (confidence: ${confidenceScore.toFixed(1)})...`);
      
      prediction.strategy = 'Long Put';
      prediction.optionType = 'PUT';
      prediction.reasoning = `${prediction.reasoning} [AUTO-CORRECTED: High-confidence negative sentiment (${sentimentScore}) overrides technical signals]`;
      strategyAutoCorrect = true;
    }
    
    if (shouldOverride && newsSentiment.overall === 'positive' && prediction.optionType === 'PUT') {
      console.error(`❌ STRATEGY CONFLICT: Strong positive sentiment (${sentimentScore}) but AI recommended PUT!`);
      console.log(`🔄 Auto-correcting strategy to CALL (confidence: ${confidenceScore.toFixed(1)})...`);
      
      prediction.strategy = 'Long Call';
      prediction.optionType = 'CALL';
      prediction.reasoning = `${prediction.reasoning} [AUTO-CORRECTED: High-confidence positive sentiment (${sentimentScore}) overrides technical signals]`;
      strategyAutoCorrect = true;
    }
    
    // Add confidence score to prediction
    prediction.confidenceScore = Math.round(confidenceScore);
    prediction.sentimentWeight = Math.round(sentimentScore * sentimentWeight);
    prediction.technicalWeight = Math.round(technicalScore * technicalWeight);
    prediction.volumeWeight = Math.round(volumeScore * volumeWeight);
    
    // Override with real NSE premium for THE AI's RECOMMENDED STRIKE (not just ATM)
    // Get ATM strike for comparison logging
    const atmStrikeForLog = nseResult.data ? extractATMPremiumAndIV(nseResult.data, analysis.current, 'CE').atmStrike : 0;
    
    if (dataSource === 'NSE_LIVE' && nseResult.data && prediction.strikePrice) {
      const optionTypeCode = prediction.optionType === 'CALL' ? 'CE' : 'PE';
      const { premium: strikePremium, iv: strikeIV } = extractPremiumForStrike(
        nseResult.data, 
        prediction.strikePrice, 
        optionTypeCode
      );
      
      if (strikePremium) {
        prediction.premium = prediction.premium || {} as any;
        prediction.premium.buyLeg = strikePremium;
        prediction.premium.netCost = strikePremium;
        prediction.totalInvestment = strikePremium * prediction.lotSize;
        
        console.log(`
📊 PREMIUM RESOLUTION:
  ATM Strike: ${atmStrikeForLog} ${prediction.strikePrice === atmStrikeForLog ? '(same as recommended)' : ''}
  ATM Premium: ₹${prediction.optionType === 'CALL' ? realCallPremium : realPutPremium}
  AI Recommended Strike: ${prediction.strikePrice}
  Premium for Recommended Strike: ₹${strikePremium}
  ✓ Using premium for AI's recommended strike
`);
      } else {
        // Fallback to ATM premium if specific strike not found
        const atmPremium = prediction.optionType === 'CALL' ? realCallPremium : realPutPremium;
        if (atmPremium) {
          prediction.premium = prediction.premium || {} as any;
          prediction.premium.buyLeg = atmPremium;
          prediction.premium.netCost = atmPremium;
          prediction.totalInvestment = atmPremium * prediction.lotSize;
          console.warn(`⚠️ Strike ${prediction.strikePrice} premium not found, falling back to ATM premium: ₹${atmPremium}`);
        }
      }
    } else if (dataSource === 'NSE_LIVE') {
      // Legacy fallback if no specific strike lookup
      if (realCallPremium && prediction.optionType === 'CALL') {
        prediction.premium = prediction.premium || {} as any;
        prediction.premium.buyLeg = realCallPremium;
        prediction.premium.netCost = realCallPremium;
        prediction.totalInvestment = realCallPremium * prediction.lotSize;
        console.log(`Overriding entry premium with REAL NSE call premium: ₹${realCallPremium}`);
      } else if (realPutPremium && prediction.optionType === 'PUT') {
        prediction.premium = prediction.premium || {} as any;
        prediction.premium.buyLeg = realPutPremium;
        prediction.premium.netCost = realPutPremium;
        prediction.totalInvestment = realPutPremium * prediction.lotSize;
        console.log(`Overriding entry premium with REAL NSE put premium: ₹${realPutPremium}`);
      }
    }
    
    // Log prediction decision flow
    console.log(`
📊 PREDICTION DECISION FLOW:
  1. News Sentiment: ${newsSentiment.overall}
  2. Technical Trend: ${analysis.trend}
  3. Trend Score (with sentiment): ${analysis.trendScore}
  4. MACD Trend: ${analysis.macdTrend}
  5. RSI: ${analysis.rsi}
  6. AI Recommended: ${prediction.optionType}
  7. Auto-Corrected: ${strategyAutoCorrect ? '✅ YES' : '❌ NO'}
  8. Final Decision: ${prediction.optionType}
  9. Validation: ${strategyAutoCorrect ? '⚠️ CONFLICT DETECTED & CORRECTED' : '✅ ALIGNED'}
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
    
    // PRIORITY 7: Calculate real Black-Scholes Greeks
    const CURRENT_REPO_RATE = 0.065; // RBI repo rate 6.5%
    const avgIV = realCallIV && realPutIV ? (realCallIV + realPutIV) / 2 : (realCallIV || realPutIV || 25);
    
    const realGreeks = calculateBlackScholesGreeks(
      analysis.current,
      prediction.strikePrice,
      daysToExpiry / 365,
      avgIV / 100,
      CURRENT_REPO_RATE,
      prediction.optionType === 'CALL' ? 'CE' : 'PE'
    );
    
    // Validate prediction with Greeks
    const greeksValidation = validatePredictionWithGreeks(realGreeks, daysToExpiry, ivRank);
    
    // Get position sizing recommendation
    const positionSizing = getPositionSizeRecommendation(realGreeks, ivRank, daysToExpiry);
    
    // Apply Greeks risk adjustment to confidence
    const greeksAdjustedConfidence = Math.max(0, Math.min(100, 
      prediction.confidenceScore + greeksValidation.riskAdjustment
    ));
    
    // Override AI-estimated Greeks with calculated Black-Scholes Greeks
    prediction.greeks = {
      delta: realGreeks.delta,
      gamma: realGreeks.gamma,
      theta: realGreeks.theta,
      vega: realGreeks.vega,
      rho: realGreeks.rho,
      interpretation: {
        delta: `${Math.abs(realGreeks.delta * 100).toFixed(1)}% price sensitivity - option will move ₹${Math.abs(realGreeks.delta).toFixed(2)} for every ₹1 move in underlying`,
        theta: `Premium decays by ₹${Math.abs(realGreeks.theta).toFixed(2)} per day`,
        vega: `₹${realGreeks.vega.toFixed(2)} gain/loss per 1% IV change`,
        gamma: realGreeks.gamma > 0.03 ? 'High delta sensitivity - rapid changes' : 'Moderate delta sensitivity'
      }
    };
    
    // Add Greeks validation and position sizing to prediction
    prediction.greeksValidation = {
      warnings: greeksValidation.warnings,
      riskAdjustment: greeksValidation.riskAdjustment,
      adjustedConfidence: greeksAdjustedConfidence
    };
    
    prediction.positionSizing = {
      recommendedMultiplier: positionSizing.sizeMultiplier,
      recommendedLots: Math.max(1, Math.round(positionSizing.sizeMultiplier)),
      reasoning: positionSizing.reasoning,
      adjustedInvestment: Math.round(prediction.totalInvestment * positionSizing.sizeMultiplier)
    };
    
    console.log(`
📊 BLACK-SCHOLES GREEKS:
  Delta: ${realGreeks.delta.toFixed(3)} (${(realGreeks.delta * 100).toFixed(1)}% sensitivity)
  Gamma: ${realGreeks.gamma.toFixed(4)}
  Theta: ${realGreeks.theta.toFixed(2)} (₹${Math.abs(realGreeks.theta).toFixed(2)}/day decay)
  Vega: ${realGreeks.vega.toFixed(2)} (per 1% IV)
  
Greeks Validation:
  Warnings: ${greeksValidation.warnings.length > 0 ? greeksValidation.warnings.join('; ') : 'None'}
  Risk Adjustment: ${greeksValidation.riskAdjustment > 0 ? '+' : ''}${greeksValidation.riskAdjustment}
  Adjusted Confidence: ${greeksAdjustedConfidence}%
  
Position Sizing:
  Recommended Multiplier: ${positionSizing.sizeMultiplier}x
  ${positionSizing.reasoning}
`);
    
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
      
      // Track prediction for backtesting with market context
      try {
        await supabase.from('prediction_tracking').insert({
          user_id: user.id,
          symbol,
          option_type: type,
          prediction_json: {
            ...prediction,
            marketContext,
            confidenceBreakdown: {
              total: confidenceScore,
              sentiment: sentimentScore * sentimentWeight,
              technical: technicalScore * technicalWeight,
              volume: volumeScore * volumeWeight
            }
          },
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
          iv_rank_at_prediction: ivRank,
          tracked_until: new Date(new Date().getTime() + Math.min(daysToExpiry, 7) * 24 * 60 * 60 * 1000).toISOString()
        });
        console.log('✓ Prediction tracked for backtesting with market context');
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
        marketContext,
        confidenceBreakdown: {
          total: confidenceScore,
          sentiment: sentimentScore * sentimentWeight,
          technical: technicalScore * technicalWeight,
          volume: volumeScore * volumeWeight
        },
        // PRIORITY 6: Enhanced news analysis data
        newsAnalysis: {
          sentiment: newsSentiment.overall,
          summary: newsSentiment.summary,
          confidence: newsSentiment.confidence || 50,
          articles: newsSentiment.articles,
          detectedEvents: detectedEvents.length > 0 ? detectedEvents : null,
          sectorSentiment: sectorSentiment || null,
          sourceCredibility: 'weighted'
        },
        realPremiums: {
          callPremium: realCallPremium,
          putPremium: realPutPremium,
          callIV: realCallIV,
          putIV: realPutIV
        },
        ivAnalysis: {
          ivRank,
          ivPercentile,
          level: ivLevel,
          strategy: ivStrategy
        },
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
        },
        // PRIORITY 2: Options Flow Analysis
        optionsFlow: {
          pcr: pcrAnalysis.pcr,
          pcrOI: pcrAnalysis.pcrOI,
          pcrInterpretation: pcrAnalysis.interpretation,
          maxPain: maxPainAnalysis.maxPain,
          maxPainInterpretation: maxPainAnalysis.interpretation
        },
        // PRIORITY 3: Fibonacci & Pivot Points
        fibonacciLevels: fibonacciAnalysis.levels,
        fibonacciInterpretation: fibonacciAnalysis.interpretation,
        pivotPoints: {
          pivot: pivotAnalysis.pivot,
          r1: pivotAnalysis.r1,
          r2: pivotAnalysis.r2,
          r3: pivotAnalysis.r3,
          s1: pivotAnalysis.s1,
          s2: pivotAnalysis.s2,
          s3: pivotAnalysis.s3,
          interpretation: pivotAnalysis.interpretation
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

// Fetch market context: Nifty correlation, VIX, time-of-day analysis
async function fetchMarketContext(symbol: string, type: 'index' | 'share') {
  const istTime = getCurrentISTTime();
  const hour = istTime.getUTCHours();
  const minute = istTime.getUTCMinutes();
  
  // Time-of-day analysis
  const timeInMinutes = hour * 60 + minute;
  const marketOpen = 9 * 60 + 15; // 9:15 AM
  const firstHourEnd = 10 * 60 + 15; // 10:15 AM
  const lastHourStart = 14 * 60 + 30; // 2:30 PM
  const marketClose = 15 * 60 + 30; // 3:30 PM
  
  let timeOfDay: string;
  let timeContext: string;
  
  if (timeInMinutes < marketOpen || timeInMinutes > marketClose) {
    timeOfDay = 'Closed';
    timeContext = 'Market is closed';
  } else if (timeInMinutes <= firstHourEnd) {
    timeOfDay = 'Opening Hour';
    timeContext = 'High volatility expected, use wider stops';
  } else if (timeInMinutes >= lastHourStart) {
    timeOfDay = 'Closing Hour';
    timeContext = 'Increased volatility, consider intraday exits';
  } else {
    timeOfDay = 'Mid-Session';
    timeContext = 'Normal trading conditions';
  }
  
  // Fetch Nifty 50 data for correlation (if analyzing a stock)
  let niftyCorrelation = 'N/A';
  let niftyTrend = 'Unknown';
  
  if (type === 'share') {
    try {
      const niftyData = await fetchStockData('^NSEI');
      if (niftyData && niftyData.length > 0) {
        const niftyAnalysis = analyzeData(niftyData);
        niftyTrend = niftyAnalysis.trend;
        niftyCorrelation = niftyTrend.includes('Bullish') ? 'Bullish Market' : 
                          niftyTrend.includes('Bearish') ? 'Bearish Market' : 'Neutral Market';
      }
    } catch (error) {
      console.error('Failed to fetch Nifty data for correlation:', error);
    }
  }
  
  // Fetch VIX (India VIX) from NSE
  let vixLevel = 'Unknown';
  let vixValue: number | null = null;
  
  try {
    const cookies = await getNSECookies();
    const vixResponse = await fetch('https://www.nseindia.com/api/allIndices', {
      headers: {
        ...NSE_HEADERS,
        'Cookie': cookies,
      },
    });
    
    if (vixResponse.ok) {
      const vixData = await vixResponse.json();
      const vix = vixData.data?.find((idx: any) => idx.index === 'INDIA VIX');
      if (vix && vix.last) {
        vixValue = vix.last;
        if (vixValue !== null) {
          vixLevel = vixValue > 20 ? 'High (>20)' : vixValue > 15 ? 'Moderate (15-20)' : 'Low (<15)';
          console.log(`India VIX: ${vixValue} (${vixLevel})`);
        }
      }
    }
  } catch (error) {
    console.error('Failed to fetch VIX:', error);
  }
  
  return {
    timeOfDay,
    timeContext,
    niftyCorrelation,
    niftyTrend,
    vixLevel,
    vixValue,
    timestamp: istTime.toISOString()
  };
}

async function fetchStockData(symbol: string) {
  // Try multiple symbol formats for better compatibility
  const symbolVariants = [];
  
  if (symbol.includes('.')) {
    symbolVariants.push(symbol);
  } else if (symbol.startsWith('^')) {
    // For indices like ^NSEI, ^NSEBANK - try as-is first
    symbolVariants.push(symbol);
  } else {
    // Try NSE first, then BSE
    symbolVariants.push(`${symbol}.NS`);
    symbolVariants.push(`${symbol}.BO`);
    symbolVariants.push(symbol); // Try without suffix
  }
  
  const endDate = Math.floor(Date.now() / 1000);
  const startDate = endDate - (100 * 24 * 60 * 60); // 100 days for better analysis
  
  let lastError: Error | null = null;
  
  for (const yahooSymbol of symbolVariants) {
    try {
      console.log(`Trying Yahoo Finance symbol: ${yahooSymbol}`);
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?period1=${startDate}&period2=${endDate}&interval=1d`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (!response.ok) {
        console.log(`Failed for ${yahooSymbol}: HTTP ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      
      // Check if we have valid data
      if (!data.chart?.result?.[0]?.timestamp) {
        console.log(`No data for ${yahooSymbol}`);
        continue;
      }
      
      const result = data.chart.result[0];
      const timestamps = result.timestamp;
      const quotes = result.indicators.quote[0];
      
      if (!timestamps || !quotes || timestamps.length === 0) {
        console.log(`Empty data for ${yahooSymbol}`);
        continue;
      }
      
      const historicalData = timestamps.map((ts: number, i: number) => ({
        date: new Date(ts * 1000).toISOString().split('T')[0],
        open: quotes.open[i] || 0,
        high: quotes.high[i] || 0,
        low: quotes.low[i] || 0,
        close: quotes.close[i] || 0,
        volume: quotes.volume[i] || 0
      })).filter((d: any) => d.close > 0);
      
      if (historicalData.length >= 10) {
        console.log(`✅ Successfully fetched ${historicalData.length} days of data for ${yahooSymbol}`);
        return historicalData;
      }
      
      console.log(`Insufficient data for ${yahooSymbol}: only ${historicalData.length} days`);
    } catch (error) {
      console.error(`Error fetching ${yahooSymbol}:`, error);
      lastError = error as Error;
    }
  }
  
  // If all variants fail, throw a descriptive error
  throw new Error(`Unable to fetch historical data for ${symbol}. This index/stock may not be available on Yahoo Finance. Please try a different symbol.`);
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

function analyzeData(data: any[], newsSentiment?: { overall: string }) {
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
  
  // === Multi-factor Trend Analysis (with News Sentiment Priority) ===
  let trendScore = 0;
  
  // HIGHEST PRIORITY: News Sentiment (overrides technical signals)
  if (newsSentiment) {
    if (newsSentiment.overall === 'positive') trendScore += 3;
    if (newsSentiment.overall === 'negative') trendScore -= 3;
    // neutral adds 0
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
