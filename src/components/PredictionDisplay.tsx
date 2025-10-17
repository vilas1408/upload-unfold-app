import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { TrendingUp, TrendingDown, Calendar, Info } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface PredictionData {
  openingPrice: number;
  closingPrice: number;
  reason: string;
  confidence: string;
  predictionDate: string;
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
  prediction: PredictionData | null;
  historicalData: HistoricalData[];
  isLoading: boolean;
}

const PredictionDisplay = ({ 
  stockSymbol, 
  stockName, 
  prediction, 
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

  if (!prediction) return null;

  const priceChange = prediction.closingPrice - prediction.openingPrice;
  const priceChangePercent = ((priceChange / prediction.openingPrice) * 100).toFixed(2);
  const isPositive = priceChange >= 0;

  const chartData = historicalData.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    price: d.close
  }));

  return (
    <section id="prediction-results" className="py-20 px-4 bg-background/50">
      <div className="container mx-auto max-w-7xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">
            Prediction for <span className="text-gradient">{stockName}</span>
          </h2>
          <p className="text-xl text-muted-foreground">{stockSymbol}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Main Prediction Card */}
          <Card className="glass-strong border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Tomorrow's Prediction
              </CardTitle>
              <CardDescription>
                Prediction Date: {new Date(prediction.predictionDate).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 glass rounded-lg">
                  <span className="text-muted-foreground">Opening Price</span>
                  <span className="text-2xl font-bold text-primary">
                    ₹{prediction.openingPrice.toFixed(2)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center p-4 glass rounded-lg">
                  <span className="text-muted-foreground">Predicted Closing Price</span>
                  <span className={`text-2xl font-bold ${isPositive ? 'text-success' : 'text-danger'}`}>
                    ₹{prediction.closingPrice.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center p-4 glass rounded-lg">
                  <span className="text-muted-foreground">Expected Change</span>
                  <div className="flex items-center gap-2">
                    {isPositive ? (
                      <TrendingUp className="h-5 w-5 text-success" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-danger" />
                    )}
                    <span className={`text-xl font-bold ${isPositive ? 'text-success' : 'text-danger'}`}>
                      {isPositive ? '+' : ''}{priceChangePercent}%
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center p-4 glass rounded-lg">
                  <span className="text-muted-foreground">Confidence Level</span>
                  <Badge variant="outline" className="text-accent border-accent">
                    {prediction.confidence}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Historical Chart */}
          <Card className="glass-strong border-border">
            <CardHeader>
              <CardTitle>7-Day Price Trend</CardTitle>
              <CardDescription>Historical closing prices</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: '12px' }}
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
                    dataKey="price" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={3}
                    dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Reason Card */}
        <Card className="glass-strong border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              Analysis & Reasoning
            </CardTitle>
            <CardDescription>AI-powered market analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-foreground leading-relaxed whitespace-pre-line">
              {prediction.reason}
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default PredictionDisplay;
