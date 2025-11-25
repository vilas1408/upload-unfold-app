import { Card } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Award, TrendingUp, Target, AlertTriangle, Brain, TrendingDown } from "lucide-react";

const AccuracyDashboard = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [tuningData, setTuningData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
    loadTuningData();
  }, []);

  const loadMetrics = async () => {
    const { data } = await supabase
      .from('accuracy_metrics')
      .select('*')
      .eq('period', 'all-time')
      .single();
    
    setMetrics(data);
    setLoading(false);
  };

  const loadTuningData = async () => {
    const { data } = await supabase
      .from('prediction_tuning')
      .select('*')
      .order('accuracy_rate', { ascending: false })
      .limit(10);
    
    if (data) setTuningData(data);
  };

  if (loading || !metrics || metrics.total_predictions === 0) return null;

  return (
    <Card className="p-6 mb-8 bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary/20">
      <div className="flex items-center gap-2 mb-4">
        <Award className="h-6 w-6 text-primary" />
        <h3 className="text-2xl font-bold">AI Prediction Performance</h3>
      </div>
      
      <div className="grid md:grid-cols-4 gap-4">
        <div className="text-center p-4 bg-card rounded-lg border border-border">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Target className="h-4 w-4 text-green-500" />
            <p className="text-sm text-muted-foreground">Accuracy Rate</p>
          </div>
          <p className="text-3xl font-bold text-green-500">
            {metrics.accuracy_rate?.toFixed(1)}%
          </p>
        </div>
        
        <div className="text-center p-4 bg-card rounded-lg border border-border">
          <div className="flex items-center justify-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-primary" />
            <p className="text-sm text-muted-foreground">Win Rate</p>
          </div>
          <p className="text-3xl font-bold text-primary">
            {metrics.win_rate?.toFixed(1)}%
          </p>
        </div>
        
        <div className="text-center p-4 bg-card rounded-lg border border-border">
          <p className="text-sm text-muted-foreground mb-1">Avg Profit</p>
          <p className="text-3xl font-bold text-green-500">
            +{metrics.avg_profit_percent?.toFixed(1)}%
          </p>
        </div>
        
        <div className="text-center p-4 bg-card rounded-lg border border-border">
          <p className="text-sm text-muted-foreground mb-1">Total Tracked</p>
          <p className="text-3xl font-bold text-muted-foreground">
            {metrics.total_predictions}
          </p>
        </div>
      </div>
      
      <div className="mt-4 flex items-center justify-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <span className="font-semibold text-green-600">Call:</span>
          <span>{metrics.call_success_rate?.toFixed(1)}%</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-semibold text-red-600">Put:</span>
          <span>{metrics.put_success_rate?.toFixed(1)}%</span>
        </div>
        {metrics.avg_loss_percent > 0 && (
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-orange-500" />
            <span>Avg Loss: -{metrics.avg_loss_percent?.toFixed(1)}%</span>
          </div>
        )}
      </div>
      
      {/* PHASE 4: System Learning Insights */}
      {tuningData.length > 0 && (
        <div className="mt-6 border-t border-border pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="h-5 w-5 text-purple-500" />
            <h4 className="text-lg font-semibold">AI Learning Insights</h4>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            {/* Best Performers */}
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <p className="text-sm font-semibold text-green-600">Top Performers</p>
              </div>
              <div className="space-y-1">
                {tuningData
                  .filter(t => t.accuracy_rate >= 60 && t.sample_size >= 3)
                  .slice(0, 3)
                  .map(t => (
                    <div key={`${t.tuning_type}-${t.tuning_key}`} className="text-xs text-muted-foreground">
                      <span className="font-medium">{t.tuning_key}</span>: {t.accuracy_rate?.toFixed(1)}% 
                      <span className="text-green-600"> (+{t.confidence_adjustment}% confidence)</span>
                      <span className="ml-1 text-xs">({t.sample_size} predictions)</span>
                    </div>
                  ))}
              </div>
            </div>
            
            {/* Needs Improvement */}
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-4 w-4 text-orange-500" />
                <p className="text-sm font-semibold text-orange-600">Learning Areas</p>
              </div>
              <div className="space-y-1">
                {tuningData
                  .filter(t => t.accuracy_rate < 50 && t.sample_size >= 3)
                  .sort((a, b) => a.accuracy_rate - b.accuracy_rate)
                  .slice(0, 3)
                  .map(t => (
                    <div key={`${t.tuning_type}-${t.tuning_key}`} className="text-xs text-muted-foreground">
                      <span className="font-medium">{t.tuning_key}</span>: {t.accuracy_rate?.toFixed(1)}% 
                      <span className="text-orange-600"> ({t.confidence_adjustment}% confidence)</span>
                      <span className="ml-1 text-xs">({t.sample_size} predictions)</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground mt-3 text-center">
            System auto-learns from historical performance to adjust future predictions
          </p>
        </div>
      )}
    </Card>
  );
};

export default AccuracyDashboard;
