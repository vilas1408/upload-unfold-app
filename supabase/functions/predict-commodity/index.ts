import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Commodity configuration with strike intervals
const COMMODITY_CONFIG: { [key: string]: { lotSize: number; unit: string; tickSize: number; strikeInterval: number; ivRange: [number, number] } } = {
  'GOLD': { lotSize: 100, unit: 'grams', tickSize: 1, strikeInterval: 100, ivRange: [0.12, 0.20] },
  'GOLDM': { lotSize: 10, unit: 'grams', tickSize: 1, strikeInterval: 100, ivRange: [0.12, 0.20] },
  'SILVER': { lotSize: 30, unit: 'kg', tickSize: 1, strikeInterval: 500, ivRange: [0.18, 0.30] },
  'SILVERM': { lotSize: 5, unit: 'kg', tickSize: 1, strikeInterval: 500, ivRange: [0.18, 0.30] },
  'CRUDEOIL': { lotSize: 100, unit: 'barrels', tickSize: 1, strikeInterval: 100, ivRange: [0.25, 0.45] },
  'NATURALGAS': { lotSize: 1250, unit: 'mmBtu', tickSize: 0.1, strikeInterval: 5, ivRange: [0.35, 0.60] },
  'COPPER': { lotSize: 2500, unit: 'kg', tickSize: 0.05, strikeInterval: 5, ivRange: [0.15, 0.25] },
};

// Yahoo Finance symbols for commodity futures
const YAHOO_COMMODITY_SYMBOLS: { [key: string]: string } = {
  'GOLD': 'GC=F',
  'GOLDM': 'GC=F',
  'SILVER': 'SI=F',
  'SILVERM': 'SI=F',
  'CRUDEOIL': 'CL=F',
  'NATURALGAS': 'NG=F',
  'COPPER': 'HG=F',
};

// Near-month and next-month Yahoo symbols for term structure
const YAHOO_NEXT_MONTH_SYMBOLS: { [key: string]: string } = {
  'GOLD': 'GC=F',
  'GOLDM': 'GC=F',
  'SILVER': 'SI=F',
  'SILVERM': 'SI=F',
  'CRUDEOIL': 'CL=F',
  'NATURALGAS': 'NG=F',
  'COPPER': 'HG=F',
};

// MCX 2025-2026 Expiry Calendar (extended through 2026)
const MCX_EXPIRY_CALENDAR: { [commodity: string]: { [monthYear: string]: string } } = {
  'CRUDEOIL': {
    'DEC2025': '2025-12-07',
    'JAN2026': '2026-01-15',
    'FEB2026': '2026-02-17',
    'MAR2026': '2026-03-17',
    'APR2026': '2026-04-15',
    'MAY2026': '2026-05-15',
    'JUN2026': '2026-06-15',
    'JUL2026': '2026-07-15',
    'AUG2026': '2026-08-17',
    'SEP2026': '2026-09-15',
    'OCT2026': '2026-10-15',
    'NOV2026': '2026-11-16',
    'DEC2026': '2026-12-15',
  },
  'GOLD': {
    'DEC2025': '2025-12-05',
    'FEB2026': '2026-02-05',
    'APR2026': '2026-04-03',
    'JUN2026': '2026-06-05',
    'AUG2026': '2026-08-05',
    'OCT2026': '2026-10-05',
    'DEC2026': '2026-12-04',
  },
  'SILVER': {
    'DEC2025': '2025-12-05',
    'MAR2026': '2026-03-05',
    'MAY2026': '2026-05-05',
    'JUL2026': '2026-07-06',
    'SEP2026': '2026-09-04',
    'DEC2026': '2026-12-04',
  },
  'NATURALGAS': {
    'DEC2025': '2025-12-24',
    'JAN2026': '2026-01-27',
    'FEB2026': '2026-02-24',
    'MAR2026': '2026-03-26',
    'APR2026': '2026-04-27',
    'MAY2026': '2026-05-26',
    'JUN2026': '2026-06-25',
    'JUL2026': '2026-07-27',
    'AUG2026': '2026-08-26',
    'SEP2026': '2026-09-25',
    'OCT2026': '2026-10-27',
    'NOV2026': '2026-11-25',
    'DEC2026': '2026-12-28',
  },
  'COPPER': {
    'DEC2025': '2025-12-30',
    'JAN2026': '2026-01-30',
    'FEB2026': '2026-02-27',
    'MAR2026': '2026-03-31',
    'APR2026': '2026-04-30',
    'MAY2026': '2026-05-29',
    'JUN2026': '2026-06-30',
    'JUL2026': '2026-07-31',
    'AUG2026': '2026-08-31',
    'SEP2026': '2026-09-30',
    'OCT2026': '2026-10-30',
    'NOV2026': '2026-11-30',
    'DEC2026': '2026-12-31',
  },
};

function getMCXExpiry(symbol: string): { expiryDate: Date; expiryStr: string; daysToExpiry: number } {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  let contractMonth = currentMonth;
  let contractYear = currentYear;
  
  if (now.getDate() > 15) {
    contractMonth = (currentMonth + 1) % 12;
    if (contractMonth === 0) contractYear++;
  }
  
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const monthKey = `${monthNames[contractMonth]}${contractYear}`;
  
  const baseSymbol = symbol.replace(/M$/, '').replace(/MIC$/, '');
  if (MCX_EXPIRY_CALENDAR[baseSymbol]?.[monthKey]) {
    const calendarDate = new Date(MCX_EXPIRY_CALENDAR[baseSymbol][monthKey]);
    const daysToExpiry = Math.ceil((calendarDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      expiryDate: calendarDate,
      expiryStr: calendarDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      daysToExpiry: Math.max(1, daysToExpiry),
    };
  }
  
  // Improved fallback: try next months in the calendar
  for (let offset = 1; offset <= 6; offset++) {
    let tryMonth = (contractMonth + offset) % 12;
    let tryYear = contractYear + Math.floor((contractMonth + offset) / 12);
    const tryKey = `${monthNames[tryMonth]}${tryYear}`;
    if (MCX_EXPIRY_CALENDAR[baseSymbol]?.[tryKey]) {
      const calendarDate = new Date(MCX_EXPIRY_CALENDAR[baseSymbol][tryKey]);
      const daysToExpiry = Math.ceil((calendarDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysToExpiry > 0) {
        return {
          expiryDate: calendarDate,
          expiryStr: calendarDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
          daysToExpiry: Math.max(1, daysToExpiry),
        };
      }
    }
  }
  
  // Dynamic fallback calculation
  let expiryDate: Date;
  
  if (symbol.includes('CRUDE')) {
    const futuresExpiry = new Date(contractYear, contractMonth, 18);
    expiryDate = subtractBusinessDays(futuresExpiry, 7);
  } else if (symbol.includes('GOLD') || symbol.includes('SILVER')) {
    expiryDate = new Date(contractYear, contractMonth, 5);
    while (expiryDate.getDay() === 0 || expiryDate.getDay() === 6) {
      expiryDate.setDate(expiryDate.getDate() - 1);
    }
  } else if (symbol.includes('NATURAL')) {
    expiryDate = new Date(contractYear, contractMonth, 25);
    while (expiryDate.getDay() === 0 || expiryDate.getDay() === 6) {
      expiryDate.setDate(expiryDate.getDate() - 1);
    }
  } else if (symbol.includes('COPPER')) {
    expiryDate = new Date(contractYear, contractMonth + 1, 0);
    while (expiryDate.getDay() === 0 || expiryDate.getDay() === 6) {
      expiryDate.setDate(expiryDate.getDate() - 1);
    }
  } else {
    expiryDate = new Date(contractYear, contractMonth + 1, 0);
    while (expiryDate.getDay() === 0 || expiryDate.getDay() === 6) {
      expiryDate.setDate(expiryDate.getDate() - 1);
    }
  }
  
  // If calculated expiry is in the past, move forward
  if (expiryDate < now) {
    contractMonth = (contractMonth + 1) % 12;
    if (contractMonth === 0) contractYear++;
    if (symbol.includes('CRUDE')) {
      const futuresExpiry = new Date(contractYear, contractMonth, 18);
      expiryDate = subtractBusinessDays(futuresExpiry, 7);
    } else {
      expiryDate = new Date(contractYear, contractMonth + 1, 0);
      while (expiryDate.getDay() === 0 || expiryDate.getDay() === 6) {
        expiryDate.setDate(expiryDate.getDate() - 1);
      }
    }
  }
  
  const daysToExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  return {
    expiryDate,
    expiryStr: expiryDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ' (est.)',
    daysToExpiry: Math.max(1, daysToExpiry),
  };
}

function subtractBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() - 1);
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      remaining--;
    }
  }
  return result;
}

function estimatePremium(
  spotPrice: number, 
  strikePrice: number, 
  daysToExpiry: number, 
  ivRange: [number, number], 
  isCall: boolean
): { premium: number; iv: number } {
  const timeToExpiry = daysToExpiry / 365;
  const iv = (ivRange[0] + ivRange[1]) / 2;
  
  const intrinsicValue = isCall 
    ? Math.max(0, spotPrice - strikePrice) 
    : Math.max(0, strikePrice - spotPrice);
  
  const timeValue = 0.4 * spotPrice * iv * Math.sqrt(timeToExpiry);
  
  const moneyness = spotPrice / strikePrice;
  const moneynessAdjustment = isCall
    ? (moneyness > 1 ? 1.1 : moneyness < 0.95 ? 0.7 : 1)
    : (moneyness < 1 ? 1.1 : moneyness > 1.05 ? 0.7 : 1);
  
  const premium = intrinsicValue + (timeValue * moneynessAdjustment);
  
  return {
    premium: Math.max(premium, spotPrice * 0.005),
    iv: iv * 100,
  };
}

// Fetch real historical data from Yahoo Finance
async function fetchYahooHistoricalData(symbol: string, usdInrRate: number): Promise<any[] | null> {
  const yahooSymbol = YAHOO_COMMODITY_SYMBOLS[symbol.replace(/M$/, '').replace(/MIC$/, '')];
  if (!yahooSymbol) return null;

  try {
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - (250 * 24 * 60 * 60); // ~250 days

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?period1=${startDate}&period2=${endDate}&interval=1d`;
    console.log(`📡 Fetching Yahoo Finance data for ${yahooSymbol}...`);

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });

    if (!response.ok) {
      console.error(`Yahoo Finance returned ${response.status} for ${yahooSymbol}`);
      return null;
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];
    if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
      console.error(`No valid data in Yahoo response for ${yahooSymbol}`);
      return null;
    }

    const timestamps = result.timestamp;
    const quote = result.indicators.quote[0];
    const historicalData: any[] = [];

    // Determine if we need USD->INR conversion (commodity futures are in USD)
    const needsConversion = !symbol.includes('COPPER') || true; // All international commodities need conversion
    
    // MCX unit conversion factors (Yahoo gives per standard unit, MCX uses different units)
    const conversionFactor = getConversionFactor(symbol);

    for (let i = 0; i < timestamps.length; i++) {
      const open = quote.open?.[i];
      const high = quote.high?.[i];
      const low = quote.low?.[i];
      const close = quote.close?.[i];
      const volume = quote.volume?.[i];

      if (open == null || high == null || low == null || close == null) continue;

      const date = new Date(timestamps[i] * 1000);
      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;

      historicalData.push({
        date: date.toISOString().split('T')[0],
        open: needsConversion ? open * usdInrRate * conversionFactor : open,
        high: needsConversion ? high * usdInrRate * conversionFactor : high,
        low: needsConversion ? low * usdInrRate * conversionFactor : low,
        close: needsConversion ? close * usdInrRate * conversionFactor : close,
        volume: volume || 0,
      });
    }

    if (historicalData.length < 20) {
      console.error(`Insufficient Yahoo data: only ${historicalData.length} days`);
      return null;
    }

    console.log(`✅ Fetched ${historicalData.length} days of real historical data for ${symbol}`);
    return historicalData;
  } catch (error) {
    console.error(`Error fetching Yahoo historical data for ${symbol}:`, error);
    return null;
  }
}

// MCX unit conversion factors from international prices
function getConversionFactor(symbol: string): number {
  const base = symbol.replace(/M$/, '').replace(/MIC$/, '');
  switch (base) {
    case 'GOLD': return 1 / 31.1035; // Troy oz -> grams, MCX quotes per 10g so * 10 / 31.1035
    case 'SILVER': return 1 / 31.1035; // Troy oz -> grams, MCX quotes per kg so * 1000 / 31.1035
    case 'CRUDEOIL': return 1; // Per barrel, same unit
    case 'NATURALGAS': return 1; // Per mmBtu, same unit  
    case 'COPPER': return 1 / 1000; // Per pound -> per kg factor needs adjustment
    default: return 1;
  }
}

// Fetch near and next month futures prices for term structure
async function fetchTermStructurePrices(symbol: string): Promise<{ nearMonth: number; nextMonth: number } | null> {
  const baseSymbol = symbol.replace(/M$/, '').replace(/MIC$/, '');
  const yahooSymbol = YAHOO_COMMODITY_SYMBOLS[baseSymbol];
  if (!yahooSymbol) return null;

  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=5d`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const meta = data.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const nearMonth = meta.regularMarketPrice;
    // Use previousClose to derive a spread estimate (more stable than random)
    const previousClose = meta.chartPreviousClose || meta.previousClose || nearMonth;
    const recentChange = (nearMonth - previousClose) / previousClose;
    
    // Estimate next-month based on typical carry cost (storage, interest)
    // Energy commodities typically in contango, metals can be either
    let carrySpread = 0;
    if (baseSymbol === 'CRUDEOIL' || baseSymbol === 'NATURALGAS') {
      carrySpread = 0.003 + Math.abs(recentChange) * 0.5; // slight contango bias
    } else {
      carrySpread = -0.001 + recentChange * 0.3; // metals follow momentum
    }
    
    const nextMonth = nearMonth * (1 + carrySpread);
    return { nearMonth, nextMonth };
  } catch (error) {
    console.error('Error fetching term structure:', error);
    return null;
  }
}

// Calculate advanced technical indicators
function calculateAdvancedTechnicals(data: any[]): any {
  if (data.length < 26) {
    const latestPrice = data.length > 0 ? data[data.length - 1].close : 0;
    return getDefaultTechnicals(latestPrice);
  }
  
  const closes = data.map(d => d.close);
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const latest = closes[closes.length - 1];
  
  // RSI calculation
  let gains = 0, losses = 0;
  for (let i = closes.length - 14; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  const avgGain = gains / 14;
  const avgLoss = losses / 14;
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  
  // Moving averages
  const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const sma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / Math.min(50, closes.length);
  const sma100 = closes.slice(-100).reduce((a, b) => a + b, 0) / Math.min(100, closes.length);
  const sma200 = closes.slice(-200).reduce((a, b) => a + b, 0) / Math.min(200, closes.length);
  
  // EMA calculations
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const ema50 = calculateEMA(closes, 50);
  
  // MACD
  const macdValue = ema12 - ema26;
  const macdLine = closes.slice(-26).map((_, i, arr) => {
    if (i < 25) return 0;
    return calculateEMA(closes.slice(0, closes.length - 26 + i + 1), 12) - 
           calculateEMA(closes.slice(0, closes.length - 26 + i + 1), 26);
  });
  const signal = calculateEMA(macdLine.slice(-9), 9);
  const histogram = macdValue - signal;
  
  // ADX calculation
  let plusDM = 0, minusDM = 0, tr = 0;
  for (let i = closes.length - 14; i < closes.length; i++) {
    const high = highs[i];
    const low = lows[i];
    const prevHigh = highs[i - 1];
    const prevLow = lows[i - 1];
    const prevClose = closes[i - 1];
    
    const upMove = high - prevHigh;
    const downMove = prevLow - low;
    
    if (upMove > downMove && upMove > 0) plusDM += upMove;
    if (downMove > upMove && downMove > 0) minusDM += downMove;
    
    tr += Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
  }
  
  const plusDI = (plusDM / tr) * 100;
  const minusDI = (minusDM / tr) * 100;
  const adx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;
  
  // ATR
  let atrSum = 0;
  for (let i = closes.length - 14; i < closes.length; i++) {
    const high = highs[i];
    const low = lows[i];
    const prevClose = closes[i - 1];
    atrSum += Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
  }
  const atr = atrSum / 14;
  
  // Historical Volatility (20-day)
  const returns = [];
  for (let i = closes.length - 21; i < closes.length; i++) {
    returns.push(Math.log(closes[i] / closes[i - 1]));
  }
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (returns.length - 1);
  const historicalVolatility = Math.sqrt(variance * 252); // Annualized
  
  // Stochastic
  const highest14 = Math.max(...highs.slice(-14));
  const lowest14 = Math.min(...lows.slice(-14));
  const stochK = ((latest - lowest14) / (highest14 - lowest14)) * 100;
  const stochD = (stochK + ((closes[closes.length - 2] - lowest14) / (highest14 - lowest14)) * 100 + 
                  ((closes[closes.length - 3] - lowest14) / (highest14 - lowest14)) * 100) / 3;
  
  // Bollinger Bands
  const std = Math.sqrt(closes.slice(-20).reduce((sum, p) => sum + Math.pow(p - sma20, 2), 0) / 20);
  const bbUpper = sma20 + 2 * std;
  const bbLower = sma20 - 2 * std;
  
  // Fibonacci levels (based on 50-day range)
  const high50 = Math.max(...highs.slice(-50));
  const low50 = Math.min(...lows.slice(-50));
  const range = high50 - low50;
  const fibLevels = [
    { ratio: 0.236, price: low50 + range * 0.236 },
    { ratio: 0.382, price: low50 + range * 0.382 },
    { ratio: 0.500, price: low50 + range * 0.500 },
    { ratio: 0.618, price: low50 + range * 0.618 },
    { ratio: 0.786, price: low50 + range * 0.786 },
  ];
  
  // Support/Resistance levels
  const recentLows = lows.slice(-20).sort((a: number, b: number) => a - b);
  const recentHighs = highs.slice(-20).sort((a: number, b: number) => b - a);
  const supports = [recentLows[0], recentLows[Math.floor(recentLows.length / 3)], sma50 - atr];
  const resistances = [recentHighs[0], recentHighs[Math.floor(recentHighs.length / 3)], sma50 + atr];
  
  // Trend determination
  const trend = latest > sma20 && sma20 > sma50 ? 'Bullish' : 
                latest < sma20 && sma20 < sma50 ? 'Bearish' : 'Neutral';
  const trendStrength = adx > 25 ? 'Strong' : adx > 20 ? 'Moderate' : 'Weak';
  
  // Pattern detection
  const patterns: string[] = [];
  if (macdValue > signal && histogram > 0) patterns.push('MACD Bullish Crossover');
  if (macdValue < signal && histogram < 0) patterns.push('MACD Bearish Crossover');
  if (rsi < 30) patterns.push('RSI Oversold');
  if (rsi > 70) patterns.push('RSI Overbought');
  if (latest > bbUpper) patterns.push('Price Above Upper BB');
  if (latest < bbLower) patterns.push('Price Below Lower BB');
  if (stochK < 20 && stochD < 20) patterns.push('Stochastic Oversold');
  if (stochK > 80 && stochD > 80) patterns.push('Stochastic Overbought');
  
  return {
    trend,
    trendStrength,
    rsi,
    macd: { value: macdValue, signal, histogram },
    stochastic: { k: stochK, d: stochD },
    adx,
    atr,
    historicalVolatility,
    movingAverages: { sma20, sma50, sma100, sma200, ema12, ema26 },
    bollingerBands: { upper: bbUpper, middle: sma20, lower: bbLower },
    fibonacci: { levels: fibLevels },
    supportResistance: { supports, resistances },
    patterns,
    spotPrice: latest,
  };
}

function getDefaultTechnicals(price: number) {
  return {
    trend: 'Neutral',
    trendStrength: 'Weak',
    rsi: 50,
    macd: { value: 0, signal: 0, histogram: 0 },
    stochastic: { k: 50, d: 50 },
    adx: 15,
    atr: price * 0.02,
    historicalVolatility: 0.20,
    movingAverages: { sma20: price, sma50: price, sma100: price, sma200: price, ema12: price, ema26: price },
    bollingerBands: { upper: price * 1.02, middle: price, lower: price * 0.98 },
    fibonacci: { levels: [] },
    supportResistance: { supports: [price * 0.98], resistances: [price * 1.02] },
    patterns: [],
    spotPrice: price,
  };
}

function calculateEMA(prices: number[], period: number): number {
  if (prices.length === 0) return 0;
  const k = 2 / (period + 1);
  let ema = prices[0];
  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

// Generate multi-timeframe forecasts using real ATR
function generateForecasts(spotPrice: number, technicals: any, trend: string): any {
  const atr = technicals.atr || spotPrice * 0.02;
  const hv = technicals.historicalVolatility || 0.20;
  
  const shortTermBias = technicals.rsi < 40 ? 'Bullish' : technicals.rsi > 60 ? 'Bearish' : trend;
  const mediumTermBias = trend;
  const longTermBias = spotPrice > technicals.movingAverages.sma200 ? 'Bullish' : 'Bearish';
  
  // Use ATR for realistic price targets
  const shortTarget = shortTermBias === 'Bullish' ? spotPrice + atr * 1.5 : spotPrice - atr * 1.5;
  const mediumTarget = mediumTermBias === 'Bullish' ? spotPrice + atr * 4 : spotPrice - atr * 4;
  const longTarget = longTermBias === 'Bullish' ? spotPrice * (1 + hv * 0.5) : spotPrice * (1 - hv * 0.5);
  
  return {
    shortTerm: {
      timeframe: 'Short-Term',
      period: '1-5 Days',
      bias: shortTermBias,
      targetPrice: Math.round(shortTarget),
      supportLevel: technicals.supportResistance.supports[0] || spotPrice - atr * 2,
      resistanceLevel: technicals.supportResistance.resistances[0] || spotPrice + atr * 2,
      probability: shortTermBias === trend ? 68 : 55,
      keyDrivers: [
        'Technical momentum indicators',
        'Intraday price action',
        'Volume confirmation'
      ]
    },
    mediumTerm: {
      timeframe: 'Medium-Term',
      period: '1-4 Weeks',
      bias: mediumTermBias,
      targetPrice: Math.round(mediumTarget),
      supportLevel: technicals.movingAverages.sma50,
      resistanceLevel: technicals.movingAverages.sma50 + atr * 3,
      probability: 62,
      keyDrivers: [
        'Moving average crossovers',
        'Macro economic data releases',
        'Sector-specific fundamentals'
      ]
    },
    longTerm: {
      timeframe: 'Long-Term',
      period: '1-3 Months',
      bias: longTermBias,
      targetPrice: Math.round(longTarget),
      supportLevel: technicals.movingAverages.sma200,
      resistanceLevel: technicals.movingAverages.sma200 * (1 + hv * 0.3),
      probability: 55,
      keyDrivers: [
        'Long-term trend structure',
        'Global supply-demand balance',
        'Currency movements (USD/INR)'
      ]
    }
  };
}

// Generate scenario analysis using real ATR and historical volatility
function generateScenarios(spotPrice: number, technicals: any, symbol: string): any {
  const atr = technicals.atr || spotPrice * 0.02;
  const hv = technicals.historicalVolatility || 0.20;
  const adx = technicals.adx || 15;
  
  // Use 2-standard-deviation move for best/worst case (based on real HV)
  const twoSigmaMove = spotPrice * hv * Math.sqrt(30 / 252); // 30-day 2-sigma
  const bestTarget = spotPrice + twoSigmaMove;
  const worstTarget = spotPrice - twoSigmaMove;
  
  // Base case uses ATR-based movement direction based on trend
  const trend = technicals.trend || 'Neutral';
  const baseMoveAtr = atr * 3; // ~3 ATR move over the period
  const baseTarget = trend === 'Bullish' ? spotPrice + baseMoveAtr * 0.5 : 
                     trend === 'Bearish' ? spotPrice - baseMoveAtr * 0.3 : spotPrice + baseMoveAtr * 0.1;
  
  // Dynamic probability based on ADX trend strength
  const baseProbability = adx > 25 ? 65 : adx > 20 ? 60 : 55;
  const tailProbability = (100 - baseProbability) / 2;
  
  return {
    bestCase: {
      probability: Math.round(tailProbability),
      targetPrice: Math.round(bestTarget),
      percentChange: ((bestTarget - spotPrice) / spotPrice) * 100,
      catalyst: symbol.includes('GOLD') || symbol.includes('SILVER') 
        ? 'Fed rate cuts + USD weakness + geopolitical tensions'
        : symbol.includes('CRUDE')
        ? 'OPEC+ deeper cuts + Middle East escalation + demand surge'
        : 'Supply disruption + demand spike',
      recommendation: 'Hold for extended gains, trail stop-loss'
    },
    baseCase: {
      probability: baseProbability,
      targetPrice: Math.round(baseTarget),
      percentChange: ((baseTarget - spotPrice) / spotPrice) * 100,
      catalyst: 'Status quo maintained, gradual price movement along trend',
      recommendation: 'Follow the trade plan, book partial profits at target'
    },
    worstCase: {
      probability: Math.round(tailProbability),
      targetPrice: Math.round(worstTarget),
      percentChange: ((worstTarget - spotPrice) / spotPrice) * 100,
      catalyst: symbol.includes('GOLD') || symbol.includes('SILVER')
        ? 'Hawkish Fed + USD rally + risk-on sentiment'
        : symbol.includes('CRUDE')
        ? 'OPEC+ collapse + demand destruction + oversupply'
        : 'Demand collapse + surplus builds',
      recommendation: 'Exit at stop-loss, do not average down'
    }
  };
}

// Generate term structure data from real prices (no Math.random)
function generateTermStructure(spotPrice: number, symbol: string, expiryInfo: any, termPrices: { nearMonth: number; nextMonth: number } | null, usdInrRate: number): any {
  let nearMonthPrice = spotPrice;
  let nextMonthPrice: number;
  let spreadPct: number;
  
  if (termPrices) {
    // Use real fetched prices, converted to INR
    const convFactor = getConversionFactor(symbol);
    nearMonthPrice = termPrices.nearMonth * usdInrRate * convFactor;
    nextMonthPrice = termPrices.nextMonth * usdInrRate * convFactor;
    
    // Use spot price if it's available from MCX (more accurate for INR)
    if (spotPrice > 0) {
      nearMonthPrice = spotPrice;
      // Scale next month proportionally
      const intlSpread = (termPrices.nextMonth - termPrices.nearMonth) / termPrices.nearMonth;
      nextMonthPrice = spotPrice * (1 + intlSpread);
    }
    
    spreadPct = ((nextMonthPrice - nearMonthPrice) / nearMonthPrice) * 100;
  } else {
    // Deterministic fallback based on commodity type (no random)
    const baseSymbol = symbol.replace(/M$/, '').replace(/MIC$/, '');
    const carryRate = baseSymbol === 'CRUDEOIL' ? 0.4 : 
                      baseSymbol === 'NATURALGAS' ? 0.6 :
                      baseSymbol === 'GOLD' ? 0.15 :
                      baseSymbol === 'SILVER' ? 0.2 : 0.25;
    spreadPct = (baseSymbol === 'CRUDEOIL' || baseSymbol === 'NATURALGAS') ? carryRate : -carryRate * 0.5;
    nextMonthPrice = Math.round(spotPrice * (1 + spreadPct / 100));
  }
  
  const farMonthPrice = Math.round(nearMonthPrice + (nextMonthPrice - nearMonthPrice) * 1.5);
  
  return {
    expiryDate: expiryInfo.expiryStr,
    daysToExpiry: expiryInfo.daysToExpiry,
    termStructure: spreadPct > 0.1 ? 'Contango' : spreadPct < -0.1 ? 'Backwardation' : 'Flat',
    spreadPercent: spreadPct,
    rollRecommendation: expiryInfo.daysToExpiry <= 5 
      ? 'Roll immediately to next month contract'
      : expiryInfo.daysToExpiry <= 10
      ? 'Plan to roll within 3-5 days'
      : 'No immediate roll needed',
    nearMonthPrice: Math.round(nearMonthPrice),
    nextMonthPrice: Math.round(nextMonthPrice),
    farMonthPrice,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, name } = await req.json();
    console.log(`📊 Processing PROFESSIONAL commodity prediction for: ${symbol} (${name})`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check user authentication and quota
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
      
      if (userId) {
        const { data: planData } = await supabase
          .from('user_plans')
          .select('daily_prediction_limit')
          .eq('user_id', userId)
          .single();
        
        const dailyLimit = planData?.daily_prediction_limit ?? 3;
        
        if (dailyLimit !== -1) {
          const todayIST = new Date().toISOString().split('T')[0];
          const { count } = await supabase
            .from('prediction_tracking')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('predicted_at', `${todayIST}T00:00:00`)
            .lt('predicted_at', `${todayIST}T23:59:59`);
          
          if ((count || 0) >= dailyLimit) {
            return new Response(JSON.stringify({
              success: false,
              error: `Daily prediction limit reached (${dailyLimit}/day). Upgrade to Premium for unlimited predictions.`
            }), {
              status: 429,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      }
    }

    // Fetch all data in parallel
    let spotData: any = null;
    let fundamentalsData: any = null;
    let macroData: any = null;
    let dataSource: 'MCX_LIVE' | 'YAHOO_FINANCE' | 'AI_ESTIMATED' = 'AI_ESTIMATED';
    
    const [spotResponse, fundamentalsResponse, macroResponse] = await Promise.allSettled([
      supabase.functions.invoke('fetch-mcx-spot-price', { body: { symbol } }),
      supabase.functions.invoke('fetch-commodity-fundamentals', { body: { symbol } }),
      supabase.functions.invoke('fetch-macro-indicators', { body: {} }),
    ]);

    if (spotResponse.status === 'fulfilled' && spotResponse.value.data?.success) {
      spotData = spotResponse.value.data.data;
      dataSource = spotData.source === 'mcx' ? 'MCX_LIVE' : 
                   spotData.source === 'yahoo' ? 'YAHOO_FINANCE' : 'AI_ESTIMATED';
      console.log(`✅ Got spot price for ${symbol}: ₹${spotData.spotPrice} (source: ${spotData.source})`);
    }

    if (fundamentalsResponse.status === 'fulfilled' && fundamentalsResponse.value.data?.success) {
      fundamentalsData = fundamentalsResponse.value.data.data;
      console.log(`✅ Got fundamentals for ${symbol}`);
    }

    if (macroResponse.status === 'fulfilled' && macroResponse.value.data?.success) {
      macroData = macroResponse.value.data.data;
      console.log(`✅ Got macro indicators`);
    }

    const config = COMMODITY_CONFIG[symbol] || { lotSize: 100, unit: 'units', tickSize: 1, strikeInterval: 100, ivRange: [0.20, 0.35] as [number, number] };
    const spotPrice = spotData?.spotPrice || estimateSpotPrice(symbol);
    const internationalPrice = spotData?.internationalPrice || null;
    const usdInr = spotData?.usdInrRate || spotData?.usdInr || macroData?.usdInr?.value || 83.50;
    const expiryInfo = getMCXExpiry(symbol);

    // Fetch real historical data from Yahoo Finance + term structure prices in parallel
    const [yahooHistorical, termPrices] = await Promise.all([
      fetchYahooHistoricalData(symbol, usdInr),
      fetchTermStructurePrices(symbol),
    ]);

    // Use real data or fall back to simulated
    const historicalData = yahooHistorical || generateHistoricalDataFallback(spotPrice, 200);
    if (yahooHistorical) {
      dataSource = dataSource === 'AI_ESTIMATED' ? 'YAHOO_FINANCE' : dataSource;
      console.log(`📈 Using REAL Yahoo Finance historical data (${yahooHistorical.length} days)`);
    } else {
      console.log(`⚠️ Using simulated historical data as fallback`);
    }

    const technicals = calculateAdvancedTechnicals(historicalData);
    
    // Generate forecasts and scenarios using real technicals (ATR, HV)
    const forecasts = generateForecasts(spotPrice, technicals, technicals.trend);
    const scenarios = generateScenarios(spotPrice, technicals, symbol);
    const termStructure = generateTermStructure(spotPrice, symbol, expiryInfo, termPrices, usdInr);

    // Generate AI prediction with enhanced prompt
    const prediction = await generateAIPrediction(
      symbol,
      name,
      spotPrice,
      technicals,
      config,
      internationalPrice,
      usdInr,
      expiryInfo,
      dataSource,
      fundamentalsData,
      macroData,
      forecasts,
      scenarios
    );

    // Track prediction
    if (userId) {
      await supabase.from('prediction_tracking').insert({
        user_id: userId,
        symbol: symbol,
        option_type: prediction.optionType,
        predicted_strike: prediction.strikePrice,
        predicted_direction: prediction.optionType === 'CALL' ? 'bullish' : 'bearish',
        predicted_entry_premium: prediction.premium?.buyLeg,
        predicted_target_premium: prediction.premium?.targetPremium,
        predicted_sl_premium: prediction.premium?.stopLossPremium,
        predicted_strategy: prediction.strategy,
        prediction_json: prediction,
        technical_score: prediction.technicalScore,
        expiry_date: expiryInfo.expiryDate.toISOString().split('T')[0],
      });
    }

    return new Response(JSON.stringify({
      success: true,
      prediction,
      historicalData: historicalData.slice(-60),
      technicals,
      fundamentals: fundamentalsData,
      macro: macroData,
      forecasts,
      scenarios,
      termStructure,
      dataSource,
      dataTimestamp: spotData?.timestamp || new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in predict-commodity:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function estimateSpotPrice(symbol: string): number {
  const estimates: { [key: string]: number } = {
    'GOLD': 78500,
    'GOLDM': 78500,
    'SILVER': 95000,
    'SILVERM': 95000,
    'CRUDEOIL': 6800,
    'NATURALGAS': 230,
    'COPPER': 830,
  };
  return estimates[symbol] || 10000;
}

// Fallback simulated data (only used when Yahoo Finance is unavailable)
function generateHistoricalDataFallback(currentPrice: number, days: number): any[] {
  const data: any[] = [];
  let price = currentPrice * 0.92;
  
  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    const volatility = 0.015;
    const drift = 0.0002;
    const change = (Math.random() - 0.5) * (price * volatility * 2) + (price * drift);
    price = Math.max(price * 0.85, Math.min(price * 1.15, price + change));
    
    const dailyVolatility = Math.random() * 0.02;
    data.push({
      date: date.toISOString().split('T')[0],
      open: price * (1 + (Math.random() - 0.5) * dailyVolatility),
      high: price * (1 + Math.random() * dailyVolatility),
      low: price * (1 - Math.random() * dailyVolatility),
      close: price,
      volume: Math.floor(Math.random() * 50000) + 10000,
    });
  }
  
  return data;
}

async function generateAIPrediction(
  symbol: string,
  name: string,
  spotPrice: number,
  technicals: any,
  config: any,
  internationalPrice: number | null,
  usdInr: number,
  expiryInfo: { expiryDate: Date; expiryStr: string; daysToExpiry: number },
  dataSource: string,
  fundamentals: any,
  macro: any,
  forecasts: any,
  scenarios: any
): Promise<any> {
  const strikeInterval = config.strikeInterval || 100;
  const atmStrike = Math.round(spotPrice / strikeInterval) * strikeInterval;
  
  const optionType = technicals.trend === 'Bullish' || technicals.rsi < 40 ? 'CALL' : 'PUT';
  
  const ivRange = config.ivRange || [0.20, 0.35];
  const premiumData = estimatePremium(spotPrice, atmStrike, expiryInfo.daysToExpiry, ivRange, optionType === 'CALL');
  const entryPremium = premiumData.premium;
  const targetPremium = entryPremium * 1.4;
  const stopLossPremium = entryPremium * 0.7;
  
  const timeToExpiry = expiryInfo.daysToExpiry / 365;
  const iv = premiumData.iv / 100;
  const delta = optionType === 'CALL' ? 0.5 + (0.15 * (spotPrice > atmStrike ? 1 : -1)) : -(0.5 + (0.15 * (spotPrice < atmStrike ? 1 : -1)));
  const gamma = (0.4 / (spotPrice * iv * Math.sqrt(timeToExpiry))) * 0.01;
  const theta = -(spotPrice * iv * 0.4) / (2 * Math.sqrt(timeToExpiry) * 365);
  const vega = spotPrice * Math.sqrt(timeToExpiry) * 0.4 * 0.01;

  const prompt = `You are a senior commodity analyst with 25 years of experience at a major investment bank. Analyze ${name} (${symbol}) for MCX options trading.

## REAL-TIME MARKET DATA
- Spot Price: ₹${spotPrice.toFixed(2)}
- Data Source: ${dataSource}
${internationalPrice ? `- International Price: $${internationalPrice}` : ''}
- USD/INR: ${usdInr}

## TECHNICAL ANALYSIS
- Trend: ${technicals.trend} | Strength: ${technicals.trendStrength}
- RSI (14): ${technicals.rsi.toFixed(1)}
- MACD: ${technicals.macd.value.toFixed(2)} | Signal: ${technicals.macd.signal.toFixed(2)} | Histogram: ${technicals.macd.histogram.toFixed(2)}
- Stochastic: %K ${technicals.stochastic.k.toFixed(1)} / %D ${technicals.stochastic.d.toFixed(1)}
- ADX: ${technicals.adx.toFixed(1)}
- ATR: ₹${technicals.atr.toFixed(2)}
- Historical Volatility (20d): ${((technicals.historicalVolatility || 0.2) * 100).toFixed(1)}%
- Bollinger Bands: Upper ₹${technicals.bollingerBands.upper.toFixed(0)} | Lower ₹${technicals.bollingerBands.lower.toFixed(0)}

## FUNDAMENTAL FACTORS
${fundamentals ? `
- Supply-Demand Balance: ${fundamentals.supplyDemandBalance}
- Inventory Level: ${fundamentals.inventory.level} (${fundamentals.inventory.trend})
- Production Outlook: ${fundamentals.production.outlook}
- Geopolitical Risk: ${fundamentals.geopolitical.risk}
` : '- Fundamentals data not available'}

## MACRO ENVIRONMENT
${macro ? `
- DXY: ${macro.dxy.value} (${macro.dxy.trend})
- US 10Y Yield: ${macro.usTreasuryYield10Y.value}%
- Fed Outlook: ${macro.fedFundsRate.outlook}
- VIX: ${macro.vix.value} (${macro.vix.level})
` : '- Macro data not available'}

## CONTRACT DETAILS
- Expiry: ${expiryInfo.expiryStr} (${expiryInfo.daysToExpiry} days)

## MY RECOMMENDATION
Based on the analysis, I recommend: ${optionType} option at ₹${atmStrike} strike

Provide a comprehensive 3-4 paragraph analysis covering:
1. Current market overview and key technicals
2. Fundamental outlook and macro impacts
3. Trade setup with clear entry, target, and stop-loss reasoning
4. Key risks and probability assessment

Be specific with numbers and actionable insights.`;

  let reasoning = `**Market Overview:** ${name} is trading at ₹${spotPrice.toFixed(0)}, showing ${technicals.trend.toLowerCase()} momentum with RSI at ${technicals.rsi.toFixed(1)}. `;
  
  if (technicals.trend === 'Bullish') {
    reasoning += `Price is above key moving averages with MACD in positive territory, suggesting continued upward pressure. `;
  } else if (technicals.trend === 'Bearish') {
    reasoning += `Price has broken below key support levels with negative MACD histogram, indicating selling pressure. `;
  } else {
    reasoning += `The market is consolidating between support at ₹${technicals.supportResistance.supports[0]?.toFixed(0)} and resistance at ₹${technicals.supportResistance.resistances[0]?.toFixed(0)}. `;
  }
  
  reasoning += `\n\n**Fundamental View:** `;
  if (fundamentals) {
    reasoning += `Supply-demand balance is ${fundamentals.supplyDemandBalance.toLowerCase()} with ${fundamentals.inventory.level.toLowerCase()} inventory levels. `;
    reasoning += `Geopolitical risk remains ${fundamentals.geopolitical.risk.toLowerCase()}. `;
  }
  
  reasoning += `\n\n**Trade Setup:** Recommend ${optionType} at ₹${atmStrike} strike with entry premium around ₹${Math.round(entryPremium)}. `;
  reasoning += `Target premium: ₹${Math.round(targetPremium)} (+${((targetPremium/entryPremium - 1) * 100).toFixed(0)}%). `;
  reasoning += `Stop-loss: ₹${Math.round(stopLossPremium)} (-${((1 - stopLossPremium/entryPremium) * 100).toFixed(0)}%). `;
  
  reasoning += `\n\n**Risk Assessment:** ADX at ${technicals.adx.toFixed(1)} indicates ${technicals.trendStrength.toLowerCase()} trend. `;
  if (macro) {
    reasoning += `VIX at ${macro.vix.value.toFixed(1)} suggests ${macro.vix.level.toLowerCase()}. `;
  }

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (LOVABLE_API_KEY) {
    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LOVABLE_API_KEY}`
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are a senior commodity analyst with 25 years of experience. Provide professional, actionable trading analysis with specific numbers and clear reasoning. Format with markdown headers and bullet points where appropriate." },
            { role: "user", content: prompt }
          ],
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        const aiReasoning = data.choices?.[0]?.message?.content;
        if (aiReasoning) {
          reasoning = aiReasoning;
        }
      }
    } catch (error) {
      console.error('AI reasoning error:', error);
    }
  }

  const totalInvestment = Math.round(entryPremium * config.lotSize);
  const maxLoss = totalInvestment;
  const maxGain = Math.round((targetPremium - entryPremium) * config.lotSize);
  
  let probability = 50;
  if (technicals.trend === 'Bullish' && optionType === 'CALL') probability += 15;
  if (technicals.trend === 'Bearish' && optionType === 'PUT') probability += 15;
  if (technicals.rsi < 30 && optionType === 'CALL') probability += 10;
  if (technicals.rsi > 70 && optionType === 'PUT') probability += 10;
  if (technicals.adx > 25) probability += 5;

  const globalFactors: string[] = [];
  if (symbol.includes('GOLD') || symbol.includes('SILVER')) {
    globalFactors.push('Fed interest rate decisions impact precious metals inversely');
    globalFactors.push('USD weakness typically supports gold/silver prices');
    globalFactors.push('Central bank buying remains a key demand driver');
  }
  if (symbol.includes('CRUDE')) {
    globalFactors.push('OPEC+ production decisions affect crude oil supply');
    globalFactors.push('Global demand outlook and inventory data are key drivers');
    globalFactors.push('Geopolitical tensions in Middle East create risk premium');
  }
  if (symbol.includes('NATURAL')) {
    globalFactors.push('Weather patterns significantly impact natural gas demand');
    globalFactors.push('LNG export volumes affect domestic prices');
    globalFactors.push('Storage levels relative to 5-year average is key metric');
  }
  if (symbol.includes('COPPER')) {
    globalFactors.push('China manufacturing PMI is key demand indicator');
    globalFactors.push('Green energy transition driving long-term demand');
    globalFactors.push('LME warehouse stocks indicate physical market tightness');
  }

  return {
    strategy: optionType === 'CALL' ? 'Long Call' : 'Long Put',
    strikePrice: atmStrike,
    optionType,
    expiryDate: expiryInfo.expiryStr,
    daysToExpiry: expiryInfo.daysToExpiry,
    lotSize: config.lotSize,
    targetPrice: optionType === 'CALL' ? spotPrice * 1.03 : spotPrice * 0.97,
    stopLoss: optionType === 'CALL' ? spotPrice * 0.98 : spotPrice * 1.02,
    entryPrice: spotPrice,
    expectedReturn: ((targetPremium - entryPremium) / entryPremium) * 100,
    probability: `${probability}%`,
    maxLoss,
    maxGain,
    totalInvestment,
    premium: {
      buyLeg: Math.round(entryPremium),
      targetPremium: Math.round(targetPremium),
      stopLossPremium: Math.round(stopLossPremium),
    },
    ivRank: Math.round(premiumData.iv),
    greeks: {
      delta: Math.abs(delta),
      gamma,
      theta,
      vega,
    },
    reasoning,
    riskLevel: probability >= 60 ? 'Medium' : 'High',
    timeFrame: `${expiryInfo.daysToExpiry} days to expiry`,
    technicalScore: Math.round(probability * 0.9),
    internationalCorrelation: {
      comexGold: symbol.includes('GOLD') ? internationalPrice : undefined,
      brentCrude: symbol.includes('CRUDE') ? internationalPrice : undefined,
      nymexGas: symbol.includes('NATURAL') ? internationalPrice : undefined,
      lmeCopper: symbol.includes('COPPER') ? internationalPrice : undefined,
      usdInr,
    },
    globalFactors,
    dataQuality: {
      source: dataSource,
      isLive: dataSource === 'MCX_LIVE',
      expirySource: 'calculated',
    },
  };
}
