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

    const { 
      symbol, 
      optionType, 
      strikePrice, 
      contractType, 
      premium, 
      underlyingPrice, 
      daysToExpiry,
      expiryDate,
      openInterest,
      volume,
      bidPrice,
      askPrice,
      impliedVolatility 
    } = await req.json();

    console.log(`Storing premium snapshot for ${symbol} ${contractType} @ ${strikePrice}`);

    const { error } = await supabase
      .from('option_premiums')
      .insert({
        symbol,
        option_type: optionType,
        strike_price: strikePrice,
        contract_type: contractType,
        premium,
        underlying_price: underlyingPrice,
        days_to_expiry: daysToExpiry,
        expiry_date: expiryDate,
        open_interest: openInterest,
        volume,
        bid_price: bidPrice,
        ask_price: askPrice,
        implied_volatility: impliedVolatility
      });

    if (error) {
      console.error('Error storing premium:', error);
      throw error;
    }

    console.log('Premium snapshot stored successfully');

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in store-option-premium:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
