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

    console.log('Starting prediction outcomes update...');

    // Get predictions that need outcome tracking
    const { data: predictions, error: fetchError } = await supabase
      .from('prediction_tracking')
      .select('*')
      .is('outcome_recorded_at', null)
      .lte('tracked_until', new Date().toISOString());

    if (fetchError) throw fetchError;

    console.log(`Found ${predictions?.length || 0} predictions to update`);

    let updated = 0;
    
    for (const pred of predictions || []) {
      console.log(`Processing prediction ${pred.id} for ${pred.symbol}`);

      // Fetch actual premium data from option_premiums table
      const { data: premiumData, error: premiumError } = await supabase
        .from('option_premiums')
        .select('premium, timestamp')
        .eq('symbol', pred.symbol)
        .eq('strike_price', pred.predicted_strike)
        .eq('contract_type', pred.predicted_direction === 'CALL' ? 'CE' : 'PE')
        .gte('timestamp', pred.predicted_at)
        .lte('timestamp', pred.tracked_until)
        .order('timestamp', { ascending: true });

      if (premiumError) {
        console.error(`Error fetching premium data for ${pred.symbol}:`, premiumError);
        continue;
      }

      if (!premiumData || premiumData.length === 0) {
        console.log(`No premium data found for ${pred.symbol}, skipping`);
        continue;
      }

      const premiums = premiumData.map(p => p.premium);
      const actualMax = Math.max(...premiums);
      const actualMin = Math.min(...premiums);
      const actualExit = premiums[premiums.length - 1];

      // Calculate metrics
      const entryPremium = pred.predicted_entry_premium || premiums[0];
      const targetPremium = pred.predicted_target_premium || entryPremium * 1.4;
      const slPremium = pred.predicted_sl_premium || entryPremium * 0.7;
      
      const targetHit = actualMax >= targetPremium;
      const slHit = actualMin <= slPremium;
      
      let exitReason = 'Expiry';
      let finalPremium = actualExit;
      
      if (targetHit && (!slHit || premiumData.findIndex(p => p.premium >= targetPremium) < premiumData.findIndex(p => p.premium <= slPremium))) {
        exitReason = 'Target Hit';
        finalPremium = targetPremium;
      } else if (slHit) {
        exitReason = 'Stop Loss Hit';
        finalPremium = slPremium;
      }

      const pnlPercent = ((finalPremium - entryPremium) / entryPremium) * 100;
      const accuracy = Math.max(0, 100 - Math.abs((pnlPercent - 40) * 2)); // Target was ~40% profit

      console.log(`${pred.symbol}: Entry=${entryPremium}, Exit=${finalPremium}, P&L=${pnlPercent.toFixed(2)}%, Accuracy=${accuracy.toFixed(1)}%`);

      // Update the prediction record
      const { error: updateError } = await supabase
        .from('prediction_tracking')
        .update({
          actual_entry_premium: premiums[0],
          actual_max_premium: actualMax,
          actual_min_premium: actualMin,
          actual_exit_premium: finalPremium,
          exit_reason: exitReason,
          target_hit: targetHit,
          sl_hit: slHit,
          pnl_percent: pnlPercent,
          prediction_accuracy: accuracy,
          direction_correct: pnlPercent > 0,
          outcome_recorded_at: new Date().toISOString()
        })
        .eq('id', pred.id);

      if (updateError) {
        console.error(`Error updating prediction ${pred.id}:`, updateError);
      } else {
        updated++;
      }
    }

    console.log(`Updated ${updated} predictions`);

    // Recalculate accuracy metrics
    await recalculateAccuracyMetrics(supabase);

    return new Response(
      JSON.stringify({ success: true, updated, total: predictions?.length || 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error updating outcomes:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function recalculateAccuracyMetrics(supabase: any) {
  console.log('Recalculating accuracy metrics...');

  const { data: allPredictions, error } = await supabase
    .from('prediction_tracking')
    .select('*')
    .not('outcome_recorded_at', 'is', null);

  if (error || !allPredictions || allPredictions.length === 0) {
    console.log('No predictions with outcomes found');
    return;
  }

  const total = allPredictions.length;
  const successful = allPredictions.filter((p: any) => p.direction_correct).length;
  
  const profitablePredictions = allPredictions.filter((p: any) => p.pnl_percent > 0);
  const losingPredictions = allPredictions.filter((p: any) => p.pnl_percent < 0);
  
  const avgProfit = profitablePredictions.length > 0
    ? profitablePredictions.reduce((sum: number, p: any) => sum + p.pnl_percent, 0) / profitablePredictions.length
    : 0;
  
  const avgLoss = losingPredictions.length > 0
    ? Math.abs(losingPredictions.reduce((sum: number, p: any) => sum + p.pnl_percent, 0) / losingPredictions.length)
    : 0;

  const callPredictions = allPredictions.filter((p: any) => p.predicted_direction === 'CALL');
  const putPredictions = allPredictions.filter((p: any) => p.predicted_direction === 'PUT');

  const callSuccessRate = callPredictions.length > 0
    ? (callPredictions.filter((p: any) => p.direction_correct).length / callPredictions.length) * 100
    : 0;
  
  const putSuccessRate = putPredictions.length > 0
    ? (putPredictions.filter((p: any) => p.direction_correct).length / putPredictions.length) * 100
    : 0;

  const metrics = {
    period: 'all-time',
    period_start: '2025-01-01',
    period_end: new Date().toISOString().split('T')[0],
    total_predictions: total,
    successful_predictions: successful,
    failed_predictions: total - successful,
    accuracy_rate: (successful / total) * 100,
    avg_profit_percent: avgProfit,
    avg_loss_percent: avgLoss,
    win_rate: (successful / total) * 100,
    call_success_rate: callSuccessRate,
    put_success_rate: putSuccessRate
  };

  console.log('Metrics calculated:', metrics);

  const { error: upsertError } = await supabase
    .from('accuracy_metrics')
    .upsert(metrics, {
      onConflict: 'period,period_start,period_end'
    });

  if (upsertError) {
    console.error('Error upserting accuracy metrics:', upsertError);
  } else {
    console.log('Accuracy metrics updated successfully');
  }
}
