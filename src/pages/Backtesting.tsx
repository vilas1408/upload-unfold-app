import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface BacktestingStats {
  bySymbol: { symbol: string; count: number; accuracy: number }[];
  byDay: { day: string; count: number; accuracy: number }[];
  byMarketCondition: { condition: string; count: number; accuracy: number }[];
  byTimeToExpiry: { days: string; count: number; accuracy: number }[];
  overallMetrics: {
    totalPredictions: number;
    avgAccuracy: number;
    avgPnL: number;
    winRate: number;
    bestStrategy: string;
  };
}

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6'];

const Backtesting = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState<BacktestingStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    fetchBacktestingStats();
  }, []);

  const fetchBacktestingStats = async () => {
    setLoading(true);
    try {
      // Fetch prediction tracking data
      const { data: predictions, error } = await supabase
        .from('prediction_tracking')
        .select('*')
        .order('predicted_at', { ascending: false });

      if (error) throw error;

      if (!predictions || predictions.length === 0) {
        setStats({
          bySymbol: [],
          byDay: [],
          byMarketCondition: [],
          byTimeToExpiry: [],
          overallMetrics: {
            totalPredictions: 0,
            avgAccuracy: 0,
            avgPnL: 0,
            winRate: 0,
            bestStrategy: 'N/A'
          }
        });
        setLoading(false);
        return;
      }

      // Calculate stats by symbol
      const symbolStats = new Map<string, { count: number; correct: number }>();
      predictions.forEach(p => {
        const existing = symbolStats.get(p.symbol) || { count: 0, correct: 0 };
        symbolStats.set(p.symbol, {
          count: existing.count + 1,
          correct: existing.correct + (p.direction_correct ? 1 : 0)
        });
      });

      const bySymbol = Array.from(symbolStats.entries()).map(([symbol, data]) => ({
        symbol,
        count: data.count,
        accuracy: data.count > 0 ? (data.correct / data.count) * 100 : 0
      })).sort((a, b) => b.count - a.count).slice(0, 10);

      // Calculate stats by day of week
      const dayStats = new Map<string, { count: number; correct: number }>();
      predictions.forEach(p => {
        const day = new Date(p.predicted_at!).toLocaleDateString('en-US', { weekday: 'short' });
        const existing = dayStats.get(day) || { count: 0, correct: 0 };
        dayStats.set(day, {
          count: existing.count + 1,
          correct: existing.correct + (p.direction_correct ? 1 : 0)
        });
      });

      const byDay = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => ({
        day,
        count: dayStats.get(day)?.count || 0,
        accuracy: dayStats.get(day) ? (dayStats.get(day)!.correct / dayStats.get(day)!.count) * 100 : 0
      }));

      // Calculate stats by market condition (trend)
      const trendStats = new Map<string, { count: number; correct: number }>();
      predictions.forEach(p => {
        const trend = p.trend_at_prediction || 'Unknown';
        const existing = trendStats.get(trend) || { count: 0, correct: 0 };
        trendStats.set(trend, {
          count: existing.count + 1,
          correct: existing.correct + (p.direction_correct ? 1 : 0)
        });
      });

      const byMarketCondition = Array.from(trendStats.entries()).map(([condition, data]) => ({
        condition,
        count: data.count,
        accuracy: data.count > 0 ? (data.correct / data.count) * 100 : 0
      }));

      // Calculate stats by days to expiry
      const expiryStats = new Map<string, { count: number; correct: number }>();
      predictions.forEach(p => {
        if (!p.expiry_date || !p.predicted_at) return;
        const daysToExpiry = Math.ceil((new Date(p.expiry_date).getTime() - new Date(p.predicted_at).getTime()) / (1000 * 60 * 60 * 24));
        const bucket = daysToExpiry === 0 ? '0 (Today)' : 
                      daysToExpiry <= 2 ? '1-2 days' :
                      daysToExpiry <= 5 ? '3-5 days' : '>5 days';
        const existing = expiryStats.get(bucket) || { count: 0, correct: 0 };
        expiryStats.set(bucket, {
          count: existing.count + 1,
          correct: existing.correct + (p.direction_correct ? 1 : 0)
        });
      });

      const byTimeToExpiry = Array.from(expiryStats.entries()).map(([days, data]) => ({
        days,
        count: data.count,
        accuracy: data.count > 0 ? (data.correct / data.count) * 100 : 0
      }));

      // Overall metrics
      const totalPredictions = predictions.length;
      const completedPredictions = predictions.filter(p => p.direction_correct !== null);
      const correctPredictions = predictions.filter(p => p.direction_correct === true);
      const avgAccuracy = completedPredictions.length > 0 ? (correctPredictions.length / completedPredictions.length) * 100 : 0;
      const avgPnL = predictions.reduce((sum, p) => sum + (p.pnl_percent || 0), 0) / predictions.length;
      const winRate = completedPredictions.length > 0 ? (predictions.filter(p => (p.pnl_percent || 0) > 0).length / completedPredictions.length) * 100 : 0;

      // Find best strategy
      const strategyStats = new Map<string, { count: number; pnl: number }>();
      predictions.forEach(p => {
        if (p.predicted_strategy) {
          const existing = strategyStats.get(p.predicted_strategy) || { count: 0, pnl: 0 };
          strategyStats.set(p.predicted_strategy, {
            count: existing.count + 1,
            pnl: existing.pnl + (p.pnl_percent || 0)
          });
        }
      });

      let bestStrategy = 'N/A';
      let bestAvgPnL = -Infinity;
      strategyStats.forEach((data, strategy) => {
        const avgPnL = data.pnl / data.count;
        if (avgPnL > bestAvgPnL) {
          bestAvgPnL = avgPnL;
          bestStrategy = strategy;
        }
      });

      setStats({
        bySymbol,
        byDay,
        byMarketCondition,
        byTimeToExpiry,
        overallMetrics: {
          totalPredictions,
          avgAccuracy: Math.round(avgAccuracy * 100) / 100,
          avgPnL: Math.round(avgPnL * 100) / 100,
          winRate: Math.round(winRate * 100) / 100,
          bestStrategy
        }
      });
    } catch (error: any) {
      console.error('Error fetching backtesting stats:', error);
      toast({
        title: "Error",
        description: "Failed to load backtesting data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-xl text-muted-foreground">Loading backtesting data...</p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 gradient-text">
            Backtesting Dashboard
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Analyze prediction accuracy and performance metrics
          </p>
        </div>

        {/* Overall Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Card className="p-6 text-center">
            <div className="text-2xl font-bold text-primary">{stats?.overallMetrics.totalPredictions || 0}</div>
            <div className="text-sm text-muted-foreground mt-1">Total Predictions</div>
          </Card>
          <Card className="p-6 text-center">
            <div className="text-2xl font-bold text-green-500">{stats?.overallMetrics.avgAccuracy || 0}%</div>
            <div className="text-sm text-muted-foreground mt-1">Avg Accuracy</div>
          </Card>
          <Card className="p-6 text-center">
            <div className={`text-2xl font-bold ${(stats?.overallMetrics.avgPnL || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {(stats?.overallMetrics.avgPnL || 0) >= 0 ? '+' : ''}{stats?.overallMetrics.avgPnL || 0}%
            </div>
            <div className="text-sm text-muted-foreground mt-1">Avg P&L</div>
          </Card>
          <Card className="p-6 text-center">
            <div className="text-2xl font-bold text-blue-500">{stats?.overallMetrics.winRate || 0}%</div>
            <div className="text-sm text-muted-foreground mt-1">Win Rate</div>
          </Card>
          <Card className="p-6 text-center">
            <div className="text-lg font-bold text-purple-500">{stats?.overallMetrics.bestStrategy || 'N/A'}</div>
            <div className="text-sm text-muted-foreground mt-1">Best Strategy</div>
          </Card>
        </div>

        <Tabs defaultValue="symbol" className="space-y-8">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="symbol">By Symbol</TabsTrigger>
            <TabsTrigger value="day">By Day</TabsTrigger>
            <TabsTrigger value="condition">Market Condition</TabsTrigger>
            <TabsTrigger value="expiry">Time to Expiry</TabsTrigger>
          </TabsList>

          <TabsContent value="symbol" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Accuracy by Symbol</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={stats?.bySymbol || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="symbol" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="accuracy" fill="#10b981" name="Accuracy %" />
                  <Bar dataKey="count" fill="#3b82f6" name="Predictions" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>

          <TabsContent value="day" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Accuracy by Day of Week</h3>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={stats?.byDay || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="accuracy" stroke="#10b981" name="Accuracy %" strokeWidth={2} />
                  <Line type="monotone" dataKey="count" stroke="#3b82f6" name="Predictions" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>

          <TabsContent value="condition" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Accuracy by Market Condition</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={stats?.byMarketCondition || []}
                      dataKey="count"
                      nameKey="condition"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {(stats?.byMarketCondition || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {(stats?.byMarketCondition || []).map((item, index) => (
                    <div key={item.condition} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                        <span className="font-medium">{item.condition}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{item.accuracy.toFixed(1)}%</div>
                        <div className="text-xs text-muted-foreground">{item.count} predictions</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="expiry" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Accuracy by Time to Expiry</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={stats?.byTimeToExpiry || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="days" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="accuracy" fill="#8b5cf6" name="Accuracy %" />
                  <Bar dataKey="count" fill="#f59e0b" name="Predictions" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <Footer />
    </div>
  );
};

export default Backtesting;
