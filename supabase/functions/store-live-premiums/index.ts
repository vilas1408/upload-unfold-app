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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if market is open (9:15 AM - 3:30 PM IST, Monday-Friday)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);
    const hour = istTime.getUTCHours();
    const minute = istTime.getUTCMinutes();
    const day = istTime.getUTCDay();
    
    const marketOpen = hour > 9 || (hour === 9 && minute >= 15);
    const marketClose = hour < 15 || (hour === 15 && minute <= 30);
    const isWeekday = day >= 1 && day <= 5;
    
    if (!isWeekday || !marketOpen || !marketClose) {
      console.log('Market is closed. Skipping premium tracking.');
      return new Response(
        JSON.stringify({ message: 'Market closed', time: istTime.toISOString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Market is open. Starting premium tracking...');

    // Fetch active predictions that need tracking
    const { data: predictions, error: fetchError } = await supabase
      .from('prediction_tracking')
      .select('*')
      .is('outcome_recorded_at', null)
      .gte('tracked_until', istTime.toISOString());

    if (fetchError) throw fetchError;

    if (!predictions || predictions.length === 0) {
      console.log('No active predictions to track');
      return new Response(
        JSON.stringify({ message: 'No active predictions', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${predictions.length} active predictions to track`);

    // Group by symbol to minimize API calls
    const symbolMap = new Map<string, any[]>();
    predictions.forEach(pred => {
      if (!symbolMap.has(pred.symbol)) {
        symbolMap.set(pred.symbol, []);
      }
      symbolMap.get(pred.symbol)!.push(pred);
    });

    let totalStored = 0;
    const errors: string[] = [];

    // Process each symbol
    for (const [symbol, symbolPredictions] of symbolMap.entries()) {
      try {
        console.log(`Fetching option chain for ${symbol}...`);
        
        // Fetch option chain from NSE
        const optionChainUrl = `https://www.nseindia.com/api/option-chain-indices?symbol=${symbol}`;
        const response = await fetch(optionChainUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
          }
        });

        if (!response.ok) {
          throw new Error(`NSE API returned ${response.status}`);
        }

        const data = await response.json();
        const underlyingPrice = data.records?.underlyingValue || data.records?.data?.[0]?.CE?.underlyingValue;
        
        if (!underlyingPrice) {
          console.error(`No underlying price found for ${symbol}`);
          errors.push(`${symbol}: No underlying price`);
          continue;
        }

        const optionData = data.records?.data || [];
        
        // For each prediction, store relevant strikes
        for (const pred of symbolPredictions) {
          const predictedStrike = Number(pred.predicted_strike);
          const expiryDate = pred.expiry_date;
          
          // Find options matching the expiry date
          const relevantOptions = optionData.filter((opt: any) => {
            const optExpiry = opt.expiryDate;
            return optExpiry === expiryDate;
          });

          // Store ATM and nearby strikes (±2 strikes from predicted)
          const strikesToStore = relevantOptions.filter((opt: any) => {
            const strike = opt.strikePrice;
            return Math.abs(strike - predictedStrike) <= 200; // Within ±200 points
          });

          console.log(`Storing ${strikesToStore.length} strikes for ${symbol} prediction ${pred.id}`);

          for (const opt of strikesToStore) {
            const strike = opt.strikePrice;
            const timestamp = istTime.toISOString();
            
            // Store CE (Call) data
            if (opt.CE) {
              const ceData = {
                symbol,
                strike_price: strike,
                premium: opt.CE.lastPrice || opt.CE.LTP,
                underlying_price: underlyingPrice,
                days_to_expiry: calculateDaysToExpiry(expiryDate),
                expiry_date: expiryDate,
                option_type: pred.option_type,
                contract_type: 'CE',
                implied_volatility: opt.CE.impliedVolatility || null,
                open_interest: opt.CE.openInterest || null,
                volume: opt.CE.totalTradedVolume || null,
                bid_price: opt.CE.bidprice || null,
                ask_price: opt.CE.askPrice || null,
                delta: null,
                gamma: null,
                theta: null,
                vega: null,
                timestamp
              };

              const { error: insertError } = await supabase
                .from('option_premiums')
                .insert(ceData);

              if (insertError) {
                console.error(`Error inserting CE for ${symbol} ${strike}:`, insertError);
              } else {
                totalStored++;
              }
            }

            // Store PE (Put) data
            if (opt.PE) {
              const peData = {
                symbol,
                strike_price: strike,
                premium: opt.PE.lastPrice || opt.PE.LTP,
                underlying_price: underlyingPrice,
                days_to_expiry: calculateDaysToExpiry(expiryDate),
                expiry_date: expiryDate,
                option_type: pred.option_type,
                contract_type: 'PE',
                implied_volatility: opt.PE.impliedVolatility || null,
                open_interest: opt.PE.openInterest || null,
                volume: opt.PE.totalTradedVolume || null,
                bid_price: opt.PE.bidprice || null,
                ask_price: opt.PE.askPrice || null,
                delta: null,
                gamma: null,
                theta: null,
                vega: null,
                timestamp
              };

              const { error: insertError } = await supabase
                .from('option_premiums')
                .insert(peData);

              if (insertError) {
                console.error(`Error inserting PE for ${symbol} ${strike}:`, insertError);
              } else {
                totalStored++;
              }
            }
          }
        }
      } catch (error: any) {
        console.error(`Error processing ${symbol}:`, error.message);
        errors.push(`${symbol}: ${error.message}`);
      }
    }

    console.log(`Successfully stored ${totalStored} premium records`);

    return new Response(
      JSON.stringify({ 
        success: true,
        stored: totalStored,
        predictions: predictions.length,
        symbols: symbolMap.size,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: istTime.toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in store-live-premiums:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function calculateDaysToExpiry(expiryDate: string): number {
  const expiry = new Date(expiryDate);
  const now = new Date();
  const diff = expiry.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
