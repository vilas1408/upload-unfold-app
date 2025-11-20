import { Card } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Award, TrendingUp, Target, AlertTriangle } from "lucide-react";

const AccuracyDashboard = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
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
    </Card>
  );
};

export default AccuracyDashboard;
