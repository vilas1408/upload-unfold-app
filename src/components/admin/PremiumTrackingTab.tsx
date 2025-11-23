import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Database, Clock, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export const PremiumTrackingTab = () => {
  const [premiumCount, setPremiumCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadPremiumStats = async () => {
    setLoading(true);
    
    const { count } = await supabase
      .from('option_premiums')
      .select('*', { count: 'exact', head: true });

    const { data } = await supabase
      .from('option_premiums')
      .select('timestamp')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    setPremiumCount(count || 0);
    setLastUpdate(data?.timestamp || null);
    setLoading(false);
  };

  useEffect(() => {
    loadPremiumStats();
    
    const interval = setInterval(loadPremiumStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleTriggerCollection = async () => {
    setTriggering(true);
    toast.info('Triggering premium data collection...');

    const { error } = await supabase.functions.invoke('admin-trigger-premium-collection');

    if (error) {
      toast.error(`Collection failed: ${error.message}`);
    } else {
      toast.success('Premium data collected successfully');
      await loadPremiumStats();
    }

    setTriggering(false);
  };

  const getNextScheduledRun = () => {
    const now = new Date();
    const istOffset = 330; // IST is UTC+5:30
    const istTime = new Date(now.getTime() + istOffset * 60000);
    const hours = istTime.getUTCHours();
    const minutes = istTime.getUTCMinutes();

    // Market hours: 9:15 AM - 3:30 PM IST
    const marketOpen = 9 * 60 + 15; // 9:15 AM in minutes
    const marketClose = 15 * 60 + 30; // 3:30 PM in minutes
    const currentMinutes = hours * 60 + minutes;

    if (currentMinutes < marketOpen) {
      return `Today at 9:15 AM IST`;
    } else if (currentMinutes >= marketClose) {
      return `Tomorrow at 9:15 AM IST`;
    } else {
      // Next 15-minute interval
      const nextInterval = Math.ceil(currentMinutes / 15) * 15;
      const nextHours = Math.floor(nextInterval / 60);
      const nextMins = nextInterval % 60;
      return `Today at ${nextHours}:${nextMins.toString().padStart(2, '0')} IST`;
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
      {/* Collection Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              Total Premiums
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{premiumCount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Records stored</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Last Update
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getTimeSince(lastUpdate)}</div>
            <p className="text-xs text-muted-foreground">
              {lastUpdate ? format(new Date(lastUpdate), 'PPp') : 'No data'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Next Run
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{getNextScheduledRun()}</div>
            <p className="text-xs text-muted-foreground">Every 15 minutes during market hours</p>
          </CardContent>
        </Card>
      </div>

      {/* Manual Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Manual Controls</CardTitle>
          <CardDescription>
            Trigger premium data collection outside of scheduled runs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Collect Premium Data Now</p>
                <p className="text-sm text-muted-foreground">
                  Fetch current ATM option premiums from NSE
                </p>
              </div>
              <Button
                onClick={handleTriggerCollection}
                disabled={triggering}
              >
                <Play className={`h-4 w-4 mr-2 ${triggering ? 'animate-spin' : ''}`} />
                Trigger Collection
              </Button>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Collection Schedule</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Runs every 15 minutes during market hours (9:15 AM - 3:30 PM IST)</li>
                <li>• Only executes Monday through Friday</li>
                <li>• Collects ATM call and put premiums for tracked symbols</li>
                <li>• Data used for prediction outcome validation</li>
              </ul>
            </div>

            {premiumCount === 0 && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  ⚠️ No premium data collected yet
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  Without premium data, prediction accuracy cannot be calculated. 
                  Click "Trigger Collection" to start collecting data immediately.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
