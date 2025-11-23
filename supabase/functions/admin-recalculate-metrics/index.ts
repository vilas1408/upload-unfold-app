import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin privileges required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // First trigger update-prediction-outcomes
    console.log('Triggering update-prediction-outcomes...');
    const { error: updateError } = await supabase.functions.invoke('update-prediction-outcomes');

    if (updateError) {
      console.error('Error updating outcomes:', updateError);
      throw new Error(`Failed to update outcomes: ${updateError.message}`);
    }

    // Then recalculate accuracy metrics
    console.log('Recalculating accuracy metrics...');

    // Fetch all completed predictions
    const { data: predictions, error: fetchError } = await supabase
      .from('prediction_tracking')
      .select('*')
      .not('outcome_recorded_at', 'is', null);

    if (fetchError) {
      throw fetchError;
    }

    if (!predictions || predictions.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No completed predictions to calculate metrics from',
          metricsUpdated: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate overall metrics
    const totalPredictions = predictions.length;
    const successfulPredictions = predictions.filter(p => p.target_hit).length;
    const failedPredictions = predictions.filter(p => p.sl_hit).length;
    const accuracyRate = (successfulPredictions / totalPredictions) * 100;

    const profitTrades = predictions.filter(p => p.pnl_percent && p.pnl_percent > 0);
    const lossTrades = predictions.filter(p => p.pnl_percent && p.pnl_percent < 0);

    const avgProfitPercent = profitTrades.length > 0
      ? profitTrades.reduce((sum, p) => sum + (p.pnl_percent || 0), 0) / profitTrades.length
      : 0;

    const avgLossPercent = lossTrades.length > 0
      ? lossTrades.reduce((sum, p) => sum + (p.pnl_percent || 0), 0) / lossTrades.length
      : 0;

    const callPredictions = predictions.filter(p => p.option_type === 'CALL');
    const putPredictions = predictions.filter(p => p.option_type === 'PUT');

    const callSuccessRate = callPredictions.length > 0
      ? (callPredictions.filter(p => p.target_hit).length / callPredictions.length) * 100
      : 0;

    const putSuccessRate = putPredictions.length > 0
      ? (putPredictions.filter(p => p.target_hit).length / putPredictions.length) * 100
      : 0;

    // Upsert metrics for all-time period
    const { error: upsertError } = await supabase
      .from('accuracy_metrics')
      .upsert({
        period: 'all_time',
        period_start: predictions[predictions.length - 1].predicted_at,
        period_end: predictions[0].predicted_at,
        total_predictions: totalPredictions,
        successful_predictions: successfulPredictions,
        failed_predictions: failedPredictions,
        pending_predictions: 0,
        accuracy_rate: accuracyRate,
        avg_profit_percent: avgProfitPercent,
        avg_loss_percent: avgLossPercent,
        win_rate: accuracyRate,
        call_success_rate: callSuccessRate,
        put_success_rate: putSuccessRate,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'period'
      });

    if (upsertError) {
      throw upsertError;
    }

    // Log activity
    await supabase
      .from('admin_activity_log')
      .insert({
        admin_id: user.id,
        action: 'recalculate_metrics',
        details: { 
          timestamp: new Date().toISOString(),
          predictions_processed: totalPredictions,
          accuracy_rate: accuracyRate
        }
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Metrics recalculated successfully',
        summary: {
          totalPredictions,
          successfulPredictions,
          failedPredictions,
          accuracyRate: accuracyRate.toFixed(2) + '%',
          avgProfitPercent: avgProfitPercent.toFixed(2) + '%',
          avgLossPercent: avgLossPercent.toFixed(2) + '%'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-recalculate-metrics:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
