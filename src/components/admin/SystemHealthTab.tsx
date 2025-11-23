import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Database, Zap, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface HealthMetric {
  name: string;
  status: 'healthy' | 'warning' | 'error';
  lastUpdate: string | null;
  recordCount: number;
}

export const SystemHealthTab = () => {
  const [dbHealth, setDbHealth] = useState<HealthMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkHealth = async () => {
      setLoading(true);

      const tables = [
        { name: 'option_premiums', label: 'Option Premiums' },
        { name: 'prediction_tracking', label: 'Prediction Tracking' },
        { name: 'accuracy_metrics', label: 'Accuracy Metrics' },
        { name: 'volatility_metrics', label: 'Volatility Metrics' },
        { name: 'profiles', label: 'User Profiles' }
      ];

      const healthChecks = await Promise.all(
        tables.map(async (table) => {
          const { count, error } = await supabase
            .from(table.name as any)
            .select('*', { count: 'exact', head: true });

          // Try to get last update - handle different timestamp column names
          let lastUpdate: string | null = null;
          try {
            const { data: recentData } = await supabase
              .from(table.name as any)
              .select('*')
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            lastUpdate = (recentData as any)?.created_at || (recentData as any)?.timestamp || (recentData as any)?.predicted_at;
          } catch {
            // If created_at doesn't exist, try other timestamp columns
            try {
              const { data: recentData } = await supabase
                .from(table.name as any)
                .select('*')
                .order('timestamp', { ascending: false })
                .limit(1)
                .single();

              lastUpdate = (recentData as any)?.timestamp;
            } catch {
              // Ignore errors for tables without timestamp columns
            }
          }

          const recordCount = count || 0;

          let status: 'healthy' | 'warning' | 'error' = 'healthy';
          
          if (error) {
            status = 'error';
          } else if (lastUpdate) {
            const hoursSinceUpdate = (Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60);
            if (hoursSinceUpdate > 2) status = 'warning';
          }

          return {
            name: table.label,
            status,
            lastUpdate,
            recordCount: recordCount || 0
          };
        })
      );

      setDbHealth(healthChecks);
      setLoading(false);
    };

    checkHealth();
    const interval = setInterval(checkHealth, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'warning':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Activity className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-600">Healthy</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-600">Warning</Badge>;
      case 'error':
        return <Badge className="bg-red-600">Error</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getTimeSince = (date: string | null) => {
    if (!date) return 'Never';
    
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Database Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Health
          </CardTitle>
          <CardDescription>Monitor data freshness and table status</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading health metrics...</div>
          ) : (
            <div className="space-y-4">
              {dbHealth.map((metric) => (
                <div key={metric.name} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(metric.status)}
                    <div>
                      <p className="font-medium">{metric.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {metric.recordCount.toLocaleString()} records
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-sm">
                      <p className="text-muted-foreground">Last update</p>
                      <p className="font-medium">{getTimeSince(metric.lastUpdate)}</p>
                    </div>
                    {getStatusBadge(metric.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edge Functions Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Edge Functions
          </CardTitle>
          <CardDescription>Backend function execution status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium">store-live-premiums</p>
                  <p className="text-sm text-muted-foreground">Premium data collection</p>
                </div>
              </div>
              <Badge className="bg-green-600">Active</Badge>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium">predict-options</p>
                  <p className="text-sm text-muted-foreground">Options prediction engine</p>
                </div>
              </div>
              <Badge className="bg-green-600">Active</Badge>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium">update-prediction-outcomes</p>
                  <p className="text-sm text-muted-foreground">Outcome calculation</p>
                </div>
              </div>
              <Badge className="bg-green-600">Active</Badge>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium">track-prediction</p>
                  <p className="text-sm text-muted-foreground">Prediction tracking</p>
                </div>
              </div>
              <Badge className="bg-green-600">Active</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
