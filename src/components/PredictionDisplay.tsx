import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { TrendingUp, TrendingDown, Calendar, Info } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface PredictionData {
  day: number;
  openingPrice: number;
  closingPrice: number;
  reason: string;
  confidence: string;
  predictionDate: string;
  technicalScore?: number;
  trendAlignment?: string;
  riskFactors?: string;
}

interface HistoricalData {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

interface PredictionDisplayProps {
  stockSymbol: string;
  stockName: string;
  predictions: PredictionData[];
  historicalData: HistoricalData[];
  isLoading: boolean;
}

const PredictionDisplay = ({ 
  stockSymbol, 
  stockName, 
  predictions, 
  historicalData,
  isLoading 
}: PredictionDisplayProps) => {
  if (isLoading) {
    return (
      <section className="py-20 px-4 bg-background/50">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center">
            <div className="animate-pulse">
              <div className="h-8 bg-muted rounded w-64 mx-auto mb-4"></div>
              <div className="h-4 bg-muted rounded w-48 mx-auto"></div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!predictions || predictions.length === 0) return null;

  const firstDay = predictions[0];
  const lastDay = predictions[predictions.length - 1];

  // Combine historical + predicted prices for chart
  const historicalChartData = historicalData.slice(-7).map(d => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    actual: d.close,
    predicted: null
  }));

  const predictedChartData = predictions.map(p => ({
    date: new Date(p.predictionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    actual: null,
    predicted: p.closingPrice
  }));

  const chartData = [...historicalChartData, ...predictedChartData];

  return (
    <section id="prediction-results" className="py-20 px-4 bg-background/50">
      <div className="container mx-auto max-w-7xl">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold mb-4">
          7-Day Forecast for <span className="text-gradient">{stockName}</span>
        </h2>
        <p className="text-xl text-muted-foreground">{stockSymbol} • Next 7 Trading Days</p>
      </div>

      {/* 14-Day Chart: 7 historical + 7 predicted */}
      <Card className="glass-strong border-border mb-8">
        <CardHeader>
          <CardTitle>Historical & Predicted Price Trend</CardTitle>
          <CardDescription>Last 7 days (blue) + Next 7 days forecast (green)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="date" 
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: '11px' }}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: '12px' }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Line 
                type="monotone" 
                dataKey="actual" 
                stroke="hsl(var(--primary))" 
                strokeWidth={3}
                dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                name="Historical"
              />
              <Line 
                type="monotone" 
                dataKey="predicted" 
                stroke="hsl(var(--success))" 
                strokeWidth={3}
                strokeDasharray="5 5"
                dot={{ fill: 'hsl(var(--success))', r: 4 }}
                name="Predicted"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 7-Day Predictions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {predictions.map((pred) => {
          const priceChange = pred.closingPrice - pred.openingPrice;
          const priceChangePercent = ((priceChange / pred.openingPrice) * 100).toFixed(2);
          const isPositive = priceChange >= 0;
          
          return (
            <Card key={pred.day} className="glass-strong border-border hover:border-primary transition-all">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">Day {pred.day}</CardTitle>
                    <CardDescription className="text-sm">
                      {new Date(pred.predictionDate).toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <Badge variant="outline" className="text-accent border-accent text-xs">
                      {pred.confidence}
                    </Badge>
                    {pred.technicalScore !== undefined && (
                      <Badge variant="outline" className="text-xs">
                        Score: {pred.technicalScore}/6
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Open</span>
                  <span className="font-semibold">₹{pred.openingPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Close</span>
                  <span className={`font-bold ${isPositive ? 'text-success' : 'text-danger'}`}>
                    ₹{pred.closingPrice.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <span className="text-sm text-muted-foreground">Change</span>
                  <div className="flex items-center gap-1">
                    {isPositive ? (
                      <TrendingUp className="h-4 w-4 text-success" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-danger" />
                    )}
                    <span className={`font-bold text-sm ${isPositive ? 'text-success' : 'text-danger'}`}>
                      {isPositive ? '+' : ''}{priceChangePercent}%
                    </span>
                  </div>
                </div>
                {pred.trendAlignment && (
                  <div className="pt-2">
                    <Badge variant="secondary" className="text-xs capitalize">
                      {pred.trendAlignment}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detailed Analysis for Each Day */}
      <div className="space-y-6">
        {predictions.map((pred) => (
          <Card key={pred.day} className="glass-strong border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                Day {pred.day} Analysis - {new Date(pred.predictionDate).toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </CardTitle>
              <CardDescription>
                Confidence: {pred.confidence} • Technical Score: {pred.technicalScore}/6
                {pred.riskFactors && ` • Risks: ${pred.riskFactors}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-foreground leading-relaxed whitespace-pre-line">
                {pred.reason}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      </div>
    </section>
  );
};

export default PredictionDisplay;
