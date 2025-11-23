import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { toast } from 'sonner';

interface AccuracyMetric {
  id: number;
  period: string;
  total_predictions: number;
  successful_predictions: number;
  failed_predictions: number;
  accuracy_rate: number;
  avg_profit_percent: number;
  avg_loss_percent: number;
  call_success_rate: number;
  put_success_rate: number;
}

export const AccuracyMetricsTab = () => {
  const [metrics, setMetrics] = useState<AccuracyMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);

  const loadMetrics = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('accuracy_metrics')
      .select('*')
      .order('period_start', { ascending: false });

    if (error) {
      toast.error('Failed to load metrics');
    } else {
      setMetrics(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const handleRecalculate = async () => {
    setRecalculating(true);
    toast.info('Recalculating accuracy metrics...');

    const { error } = await supabase.functions.invoke('admin-recalculate-metrics');

    if (error) {
      toast.error(`Recalculation failed: ${error.message}`);
    } else {
      toast.success('Metrics recalculated successfully');
      await loadMetrics();
    }

    setRecalculating(false);
  };

  const overallMetrics = metrics.find(m => m.period === 'all_time');

  return (
    <div className="space-y-6">
      {/* Overall Stats */}
      {overallMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Predictions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallMetrics.total_predictions}</div>
              <p className="text-xs text-muted-foreground">
                {overallMetrics.successful_predictions} successful
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Accuracy Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {overallMetrics.accuracy_rate?.toFixed(1) || 0}%
              </div>
              <p className="text-xs text-muted-foreground">Overall success rate</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                +{overallMetrics.avg_profit_percent?.toFixed(1) || 0}%
              </div>
              <p className="text-xs text-muted-foreground">On winning trades</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg Loss</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {overallMetrics.avg_loss_percent?.toFixed(1) || 0}%
              </div>
              <p className="text-xs text-muted-foreground">On losing trades</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Metrics */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Performance Breakdown</CardTitle>
              <CardDescription>Accuracy metrics by period</CardDescription>
            </div>
            <Button
              onClick={handleRecalculate}
              disabled={recalculating}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${recalculating ? 'animate-spin' : ''}`} />
              Recalculate
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading metrics...</div>
          ) : metrics.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No accuracy metrics available yet</p>
              <p className="text-sm text-muted-foreground">
                Metrics will be calculated once predictions have completed outcomes
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {metrics.map((metric) => (
                <div key={metric.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium capitalize">{metric.period.replace('_', ' ')}</h4>
                      <p className="text-sm text-muted-foreground">
                        {metric.total_predictions} predictions
                      </p>
                    </div>
                    <Badge variant={metric.accuracy_rate > 60 ? 'default' : 'secondary'}>
                      {metric.accuracy_rate?.toFixed(1) || 0}% accuracy
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Call Success</p>
                      <p className="text-sm font-medium flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {metric.call_success_rate?.toFixed(1) || 0}%
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Put Success</p>
                      <p className="text-sm font-medium flex items-center gap-1">
                        <TrendingDown className="h-3 w-3" />
                        {metric.put_success_rate?.toFixed(1) || 0}%
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Successful</p>
                      <p className="text-sm font-medium text-green-600">
                        {metric.successful_predictions}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Failed</p>
                      <p className="text-sm font-medium text-red-600">
                        {metric.failed_predictions}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
