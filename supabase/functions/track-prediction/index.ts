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

    const { symbol, optionType, prediction, technicalAnalysis } = await req.json();

    console.log(`Tracking prediction for ${symbol} - ${prediction.strategy}`);

    // Track for 7 days or until expiry, whichever is sooner
    const expiryDate = new Date(prediction.expiryDate);
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const trackUntil = expiryDate < sevenDaysFromNow ? expiryDate : sevenDaysFromNow;

    const { error } = await supabase
      .from('prediction_tracking')
      .insert({
        symbol,
        option_type: optionType,
        prediction_json: prediction,
        predicted_strategy: prediction.strategy,
        predicted_direction: prediction.optionType,
        predicted_strike: prediction.strikePrice,
        predicted_entry_premium: prediction.premium?.buyLeg || prediction.premium?.totalPremium,
        predicted_target_premium: prediction.premium?.targetPremium,
        predicted_sl_premium: prediction.premium?.stopLossPremium,
        expiry_date: prediction.expiryDate,
        technical_score: technicalAnalysis?.trendScore,
        trend_at_prediction: technicalAnalysis?.trend,
        rsi_at_prediction: technicalAnalysis?.rsi,
        iv_rank_at_prediction: technicalAnalysis?.ivRank,
        tracked_until: trackUntil.toISOString()
      });

    if (error) {
      console.error('Error tracking prediction:', error);
      throw error;
    }

    console.log('Prediction tracked successfully');

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in track-prediction:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
