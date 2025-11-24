import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OptionChainData {
  CE?: {
    strikePrice: number;
    lastPrice: number;
    bidprice: number;
    askPrice: number;
    openInterest: number;
    totalTradedVolume: number;
    impliedVolatility: number;
    expiryDate: string;
  };
  PE?: {
    strikePrice: number;
    lastPrice: number;
    bidprice: number;
    askPrice: number;
    openInterest: number;
    totalTradedVolume: number;
    impliedVolatility: number;
    expiryDate: string;
  };
}

function isMarketHours(): boolean {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  
  const day = istTime.getUTCDay();
  if (day === 0 || day === 6) {
    console.log('Weekend - market closed');
    return false;
  }
  
  const hours = istTime.getUTCHours();
  const minutes = istTime.getUTCMinutes();
  const totalMinutes = hours * 60 + minutes;
  
  const marketOpen = 9 * 60 + 15;
  const marketClose = 15 * 60 + 30;
  
  const isOpen = totalMinutes >= marketOpen && totalMinutes <= marketClose;
  console.log(`IST Time: ${hours}:${minutes}, Market Open: ${isOpen}`);
  return isOpen;
}

async function fetchNseOptionChain(symbol: string): Promise<any> {
  const baseUrl = 'https://www.nseindia.com/api/option-chain-equities';
  const url = `${baseUrl}?symbol=${symbol}`;
  
  console.log(`Fetching option chain for ${symbol}`);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
    },
  });

  if (!response.ok) {
    throw new Error(`NSE API error: ${response.status}`);
  }

  return await response.json();
}

function findATMStrikes(optionChainData: any, underlyingPrice: number): OptionChainData[] {
  const records = optionChainData?.records?.data || [];
  
  const atmStrikes = records
    .filter((record: any) => {
      const strike = record.strikePrice;
      return Math.abs(strike - underlyingPrice) <= underlyingPrice * 0.02;
    })
    .sort((a: any, b: any) => {
      return Math.abs(a.strikePrice - underlyingPrice) - Math.abs(b.strikePrice - underlyingPrice);
    })
    .slice(0, 3);
  
  console.log(`Found ${atmStrikes.length} ATM strikes near price ${underlyingPrice}`);
  return atmStrikes;
}

function calculateDaysToExpiry(expiryDate: string): number {
  const expiry = new Date(expiryDate);
  const now = new Date();
  const diffTime = expiry.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Store Live Premiums Job Started ===');
    
    if (!isMarketHours()) {
      console.log('Outside market hours - skipping');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Outside market hours',
        stored: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: stocks, error: stocksError } = await supabase
      .from('stocks')
      .select('symbol, name')
      .order('symbol');

    if (stocksError) {
      console.error('Error fetching stocks:', stocksError);
      throw stocksError;
    }

    console.log(`Processing ${stocks?.length || 0} symbols`);
    
    const premiumsToStore = [];
    let successCount = 0;
    let errorCount = 0;

    for (const stock of stocks || []) {
      try {
        const optionChainData = await fetchNseOptionChain(stock.symbol);
        const underlyingPrice = optionChainData?.records?.underlyingValue || 
                               optionChainData?.filtered?.data?.[0]?.PE?.underlyingValue ||
                               optionChainData?.filtered?.data?.[0]?.CE?.underlyingValue;
        
        if (!underlyingPrice) {
          console.log(`No underlying price for ${stock.symbol}, skipping`);
          errorCount++;
          continue;
        }

        const atmStrikes = findATMStrikes(optionChainData, underlyingPrice);
        
        for (const strike of atmStrikes) {
          if (strike.CE) {
            const daysToExpiry = calculateDaysToExpiry(strike.CE.expiryDate);
            premiumsToStore.push({
              symbol: stock.symbol,
              option_type: 'call',
              strike_price: strike.CE.strikePrice,
              contract_type: 'CE',
              premium: strike.CE.lastPrice,
              underlying_price: underlyingPrice,
              days_to_expiry: daysToExpiry,
              expiry_date: strike.CE.expiryDate.split(' ')[0],
              open_interest: strike.CE.openInterest,
              volume: strike.CE.totalTradedVolume,
              bid_price: strike.CE.bidprice,
              ask_price: strike.CE.askPrice,
              implied_volatility: strike.CE.impliedVolatility,
            });
          }
          
          if (strike.PE) {
            const daysToExpiry = calculateDaysToExpiry(strike.PE.expiryDate);
            premiumsToStore.push({
              symbol: stock.symbol,
              option_type: 'put',
              strike_price: strike.PE.strikePrice,
              contract_type: 'PE',
              premium: strike.PE.lastPrice,
              underlying_price: underlyingPrice,
              days_to_expiry: daysToExpiry,
              expiry_date: strike.PE.expiryDate.split(' ')[0],
              open_interest: strike.PE.openInterest,
              volume: strike.PE.totalTradedVolume,
              bid_price: strike.PE.bidprice,
              ask_price: strike.PE.askPrice,
              implied_volatility: strike.PE.impliedVolatility,
            });
          }
        }
        
        successCount++;
        console.log(`Processed ${stock.symbol}: ${atmStrikes.length} ATM strikes`);
        
      } catch (error: any) {
        console.error(`Error processing ${stock.symbol}:`, error.message);
        errorCount++;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (premiumsToStore.length > 0) {
      console.log(`Storing ${premiumsToStore.length} premium records`);
      const { error: insertError } = await supabase
        .from('option_premiums')
        .insert(premiumsToStore);

      if (insertError) {
        console.error('Error inserting premiums:', insertError);
        throw insertError;
      }
    }

    console.log(`=== Job Complete: ${successCount} success, ${errorCount} errors, ${premiumsToStore.length} premiums stored ===`);

    return new Response(JSON.stringify({ 
      success: true,
      processed: stocks?.length || 0,
      successful: successCount,
      errors: errorCount,
      stored: premiumsToStore.length,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Fatal error in store-live-premiums:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
