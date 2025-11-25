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
    console.log('🤖 Starting auto-tune predictions job...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all predictions with recorded outcomes
    const { data: predictions, error: fetchError } = await supabase
      .from('prediction_tracking')
      .select('*')
      .not('outcome_recorded_at', 'is', null);

    if (fetchError) throw fetchError;

    if (!predictions || predictions.length === 0) {
      console.log('⚠️ No predictions with outcomes to analyze yet');
      return new Response(
        JSON.stringify({ success: true, message: 'No data to tune yet', tuningUpdates: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Analyzing ${predictions.length} predictions for auto-tuning...`);

    const tuningUpdates: any[] = [];

    // 1. SYMBOL-SPECIFIC ACCURACY
    const symbolStats = new Map<string, { total: number; successful: number }>();
    
    for (const pred of predictions) {
      const symbol = pred.symbol;
      if (!symbolStats.has(symbol)) {
        symbolStats.set(symbol, { total: 0, successful: 0 });
      }
      const stats = symbolStats.get(symbol)!;
      stats.total++;
      if (pred.target_hit) stats.successful++;
    }

    for (const [symbol, stats] of symbolStats.entries()) {
      if (stats.total >= 5) { // Minimum sample size
        const accuracy = (stats.successful / stats.total) * 100;
        let confidenceAdjustment = 0;
        
        if (accuracy >= 70) {
          confidenceAdjustment = 10; // Boost confidence for good performers
        } else if (accuracy >= 50) {
          confidenceAdjustment = 0;
        } else if (accuracy >= 30) {
          confidenceAdjustment = -10;
        } else {
          confidenceAdjustment = -20; // Reduce confidence for poor performers
        }

        tuningUpdates.push({
          tuning_type: 'symbol',
          tuning_key: symbol,
          accuracy_rate: accuracy,
          sample_size: stats.total,
          confidence_adjustment: confidenceAdjustment,
        });
      }
    }

    // 2. DAY-OF-WEEK ANALYSIS
    const dayStats = new Map<string, { total: number; successful: number }>();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    for (const pred of predictions) {
      const predDate = new Date(pred.predicted_at);
      const dayName = dayNames[predDate.getUTCDay()];
      
      if (!dayStats.has(dayName)) {
        dayStats.set(dayName, { total: 0, successful: 0 });
      }
      const stats = dayStats.get(dayName)!;
      stats.total++;
      if (pred.target_hit) stats.successful++;
    }

    for (const [day, stats] of dayStats.entries()) {
      if (stats.total >= 3) {
        const accuracy = (stats.successful / stats.total) * 100;
        let confidenceAdjustment = 0;
        
        if (accuracy >= 60) confidenceAdjustment = 5;
        else if (accuracy < 40) confidenceAdjustment = -10;

        tuningUpdates.push({
          tuning_type: 'day',
          tuning_key: day,
          accuracy_rate: accuracy,
          sample_size: stats.total,
          confidence_adjustment: confidenceAdjustment,
        });
      }
    }

    // 3. MARKET CONDITION ANALYSIS (Bullish/Bearish/Neutral)
    const conditionStats = new Map<string, { total: number; successful: number }>();
    
    for (const pred of predictions) {
      const trend = pred.trend_at_prediction || 'Unknown';
      if (!conditionStats.has(trend)) {
        conditionStats.set(trend, { total: 0, successful: 0 });
      }
      const stats = conditionStats.get(trend)!;
      stats.total++;
      if (pred.target_hit) stats.successful++;
    }

    for (const [condition, stats] of conditionStats.entries()) {
      if (stats.total >= 5) {
        const accuracy = (stats.successful / stats.total) * 100;
        let confidenceAdjustment = 0;
        
        if (accuracy >= 65) confidenceAdjustment = 10;
        else if (accuracy < 40) confidenceAdjustment = -15;

        tuningUpdates.push({
          tuning_type: 'market_condition',
          tuning_key: condition,
          accuracy_rate: accuracy,
          sample_size: stats.total,
          confidence_adjustment: confidenceAdjustment,
        });
      }
    }

    // 4. STRATEGY-SPECIFIC PERFORMANCE
    const strategyStats = new Map<string, { total: number; successful: number }>();
    
    for (const pred of predictions) {
      const strategy = pred.predicted_strategy || 'Unknown';
      if (!strategyStats.has(strategy)) {
        strategyStats.set(strategy, { total: 0, successful: 0 });
      }
      const stats = strategyStats.get(strategy)!;
      stats.total++;
      if (pred.target_hit) stats.successful++;
    }

    for (const [strategy, stats] of strategyStats.entries()) {
      if (stats.total >= 3) {
        const accuracy = (stats.successful / stats.total) * 100;
        let confidenceAdjustment = 0;
        
        if (accuracy >= 60) confidenceAdjustment = 8;
        else if (accuracy < 35) confidenceAdjustment = -12;

        tuningUpdates.push({
          tuning_type: 'strategy',
          tuning_key: strategy,
          accuracy_rate: accuracy,
          sample_size: stats.total,
          confidence_adjustment: confidenceAdjustment,
        });
      }
    }

    // Upsert all tuning parameters
    if (tuningUpdates.length > 0) {
      const { error: upsertError } = await supabase
        .from('prediction_tuning')
        .upsert(tuningUpdates, {
          onConflict: 'tuning_type,tuning_key',
        });

      if (upsertError) {
        console.error('Error upserting tuning data:', upsertError);
        throw upsertError;
      }

      console.log(`✅ Updated ${tuningUpdates.length} tuning parameters`);
    }

    // Log summary
    console.log(`
📊 AUTO-TUNING COMPLETE:
  - Total predictions analyzed: ${predictions.length}
  - Symbols tuned: ${Array.from(symbolStats.keys()).length}
  - Days analyzed: ${Array.from(dayStats.keys()).length}
  - Conditions analyzed: ${Array.from(conditionStats.keys()).length}
  - Strategies analyzed: ${Array.from(strategyStats.keys()).length}
  - Total tuning updates: ${tuningUpdates.length}
`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Auto-tuning completed successfully',
        analyzed: predictions.length,
        tuningUpdates: tuningUpdates.length,
        details: {
          symbols: Array.from(symbolStats.keys()).length,
          days: Array.from(dayStats.keys()).length,
          conditions: Array.from(conditionStats.keys()).length,
          strategies: Array.from(strategyStats.keys()).length,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in auto-tune-predictions:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});