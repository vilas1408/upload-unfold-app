import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Prediction {
  id: number;
  symbol: string;
  option_type: string;
  predicted_strike: number;
  predicted_entry_premium: number;
  predicted_target_premium: number;
  predicted_sl_premium: number;
  target_hit: boolean | null;
  sl_hit: boolean | null;
  exit_reason: string | null;
  predicted_at: string;
}

export const PredictionsMonitorTab = () => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    targetHit: 0,
    slHit: 0
  });

  const loadPredictions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('prediction_tracking')
      .select('*')
      .order('predicted_at', { ascending: false })
      .limit(50);

    if (error) {
      toast.error('Failed to load predictions');
    } else {
      setPredictions(data || []);
      setStats({
        total: data?.length || 0,
        pending: data?.filter(p => !p.exit_reason).length || 0,
        targetHit: data?.filter(p => p.target_hit).length || 0,
        slHit: data?.filter(p => p.sl_hit).length || 0
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPredictions();
  }, []);

  const handleRecalculate = async () => {
    setRecalculating(true);
    toast.info('Triggering outcome recalculation...');

    const { error } = await supabase.functions.invoke('admin-recalculate-metrics');

    if (error) {
      toast.error(`Recalculation failed: ${error.message}`);
    } else {
      toast.success('Outcomes recalculated successfully');
      await loadPredictions();
    }

    setRecalculating(false);
  };

  const getStatusBadge = (prediction: Prediction) => {
    if (prediction.target_hit) {
      return <Badge className="bg-green-600">Target Hit</Badge>;
    }
    if (prediction.sl_hit) {
      return <Badge className="bg-red-600">SL Hit</Badge>;
    }
    if (prediction.exit_reason) {
      return <Badge variant="secondary">{prediction.exit_reason}</Badge>;
    }
    return <Badge variant="outline">Pending</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Predictions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Target Hit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.targetHit}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">SL Hit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.slHit}</div>
          </CardContent>
        </Card>
      </div>

      {/* Predictions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Recent Predictions
              </CardTitle>
              <CardDescription>Last 50 option predictions</CardDescription>
            </div>
            <Button
              onClick={handleRecalculate}
              disabled={recalculating}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${recalculating ? 'animate-spin' : ''}`} />
              Recalculate Outcomes
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Strike</TableHead>
                <TableHead>Entry</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>SL</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">Loading...</TableCell>
                </TableRow>
              ) : predictions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">No predictions found</TableCell>
                </TableRow>
              ) : (
                predictions.map((pred) => (
                  <TableRow key={pred.id}>
                    <TableCell className="font-medium">{pred.symbol}</TableCell>
                    <TableCell>
                      <Badge variant={pred.option_type === 'CALL' ? 'default' : 'secondary'}>
                        {pred.option_type}
                      </Badge>
                    </TableCell>
                    <TableCell>₹{pred.predicted_strike?.toFixed(2)}</TableCell>
                    <TableCell>₹{pred.predicted_entry_premium?.toFixed(2)}</TableCell>
                    <TableCell>₹{pred.predicted_target_premium?.toFixed(2)}</TableCell>
                    <TableCell>₹{pred.predicted_sl_premium?.toFixed(2)}</TableCell>
                    <TableCell>{getStatusBadge(pred)}</TableCell>
                    <TableCell>{format(new Date(pred.predicted_at), 'PP p')}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
