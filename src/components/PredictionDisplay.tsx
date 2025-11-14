import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Brain, Target, TrendingUp, TrendingDown, Calendar, Activity, ArrowUpCircle, ArrowDownCircle, AlertTriangle, BarChart3 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface PredictionData {
  openingPrice: number;
  closingPrice: number;
  predictedPrice?: number;
  targetPrice?: number;
  reason: string;
  confidence: string;
  predictionDate: string;
  technicalScore?: number;
  trendAlignment?: string;
  riskFactors?: string;
  newsSentiment?: {
    overall: string;
    summary: string;
    articles: Array<{
      title: string;
      sentiment: string;
      impact: string;
    }>;
  };
}

interface PredictionDisplayProps {
  stock: {
    symbol: string;
    name: string;
  };
  prediction: PredictionData;
  historicalData: any[];
  isCached?: boolean;
}

const PredictionDisplay = ({ stock, prediction, historicalData, isCached }: PredictionDisplayProps) => {
  const getConfidenceColor = (confidence: string) => {
    const value = parseInt(confidence);
    if (value >= 65) return "text-green-600";
    if (value >= 55) return "text-yellow-600";
    return "text-orange-600";
  };

  const getConfidenceBgColor = (confidence: string) => {
    const value = parseInt(confidence);
    if (value >= 65) return "bg-green-500/20 border-green-500/50";
    if (value >= 55) return "bg-yellow-500/20 border-yellow-500/50";
    return "bg-orange-500/20 border-orange-500/50";
  };

  const getTrendIcon = (trend?: string) => {
    if (trend === 'bullish') return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (trend === 'bearish') return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Activity className="h-4 w-4 text-yellow-600" />;
  };

  // Combine historical data with predicted price for chart
  // Show last 7 days historical + tomorrow's prediction = 8 days total
  const openPrice = prediction.openingPrice || prediction.predictedPrice || 0;
  const closePrice = prediction.closingPrice || prediction.targetPrice || 0;
  const priceChange = closePrice - openPrice;
  const priceChangePercent = openPrice ? ((priceChange / openPrice) * 100).toFixed(2) : '0.00';

  const last7Days = historicalData.slice(-7);
  const chartData = [
    ...last7Days.map((d: any) => ({
      date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      price: d.close,
      type: 'Historical'
    })),
    {
      date: new Date(prediction.predictionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      price: closePrice,
      type: 'Predicted'
    }
  ];

  return (
    <section id="prediction" className="py-20 px-4 bg-gradient-to-b from-background to-primary/5">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-2">
            Next Day AI Prediction for <span className="text-gradient">{stock.name}</span>
          </h2>
          <p className="text-xl text-muted-foreground">
            Symbol: {stock.symbol} • Predicted for: {new Date(prediction.predictionDate).toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
            {isCached && <Badge variant="outline" className="ml-2">Cached Today</Badge>}
          </p>
        </div>

        {/* Price Trend Chart */}
        <Card className="glass-strong border-border mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              7-Day Historical + Tomorrow's Predicted Price
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" style={{ fontSize: '12px' }} />
                <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: '12px' }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="price" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ fill: 'hsl(var(--primary))', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Prediction Details */}
        <Card className="glass-strong border-border hover:border-primary transition-all duration-300">
          <CardHeader>
            <div className="flex justify-between items-start flex-wrap gap-4">
              <div>
                <CardTitle className="flex items-center gap-3 mb-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Tomorrow's Forecast
                </CardTitle>
                <CardDescription>
                  Based on deep technical analysis of 30-day historical data
                </CardDescription>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge className={getConfidenceBgColor(prediction.confidence)}>
                  <Target className="h-3 w-3 mr-1" />
                  {prediction.confidence} Confidence
                </Badge>
                {prediction.technicalScore !== undefined && (
                  <Badge variant="outline" className="border-primary/50">
                    <Activity className="h-3 w-3 mr-1" />
                    Technical Score: {prediction.technicalScore}/6
                  </Badge>
                )}
                {prediction.trendAlignment && (
                  <Badge variant="outline" className={
                    prediction.trendAlignment === 'bullish' ? 'border-green-500/50 text-green-600' :
                    prediction.trendAlignment === 'bearish' ? 'border-red-500/50 text-red-600' :
                    'border-yellow-500/50 text-yellow-600'
                  }>
                    {getTrendIcon(prediction.trendAlignment)}
                    <span className="ml-1 capitalize">{prediction.trendAlignment}</span>
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Price Prediction Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowUpCircle className="h-4 w-4 text-primary" />
                  <p className="text-sm text-muted-foreground">Opening Price</p>
                </div>
                <p className="text-2xl font-bold">₹{openPrice.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">Market open estimate</p>
              </div>
              
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowDownCircle className="h-4 w-4 text-primary" />
                  <p className="text-sm text-muted-foreground">Closing Price</p>
                </div>
                <p className="text-2xl font-bold">₹{closePrice.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">End of day target</p>
              </div>
              
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  {getTrendIcon(prediction.trendAlignment)}
                  <p className="text-sm text-muted-foreground">Expected Change</p>
                </div>
                <p className={`text-2xl font-bold ${priceChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {priceChange >= 0 ? '+' : ''}{priceChangePercent}%
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {priceChange >= 0 ? '+' : ''}₹{priceChange.toFixed(2)} movement
                </p>
              </div>
            </div>

            {/* News Sentiment Analysis */}
            {prediction.newsSentiment && (
              <div className="p-6 rounded-lg bg-background/50 border border-border">
                <div className="flex items-start gap-3 mb-3">
                  <TrendingUp className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg mb-3">News Sentiment Analysis</h4>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">Overall Sentiment:</span>
                        <Badge className={
                          prediction.newsSentiment.overall === 'positive' 
                            ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                            : prediction.newsSentiment.overall === 'negative'
                            ? 'bg-red-500/10 text-red-500 border-red-500/20'
                            : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                        }>
                          {prediction.newsSentiment.overall.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground">{prediction.newsSentiment.summary}</p>
                      {prediction.newsSentiment.articles && prediction.newsSentiment.articles.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="font-semibold text-sm">Recent News Articles:</h5>
                          {prediction.newsSentiment.articles.map((article, idx) => (
                            <div key={idx} className="p-3 bg-muted/30 rounded-lg border border-border/50">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-medium">{article.title}</p>
                                <div className="flex gap-2 flex-shrink-0">
                                  <Badge variant="outline" className={
                                    article.sentiment === 'positive' 
                                      ? 'text-green-500' 
                                      : article.sentiment === 'negative'
                                      ? 'text-red-500'
                                      : 'text-yellow-500'
                                  }>
                                    {article.sentiment}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {article.impact} impact
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Analysis */}
            <div className="p-6 rounded-lg bg-background/50 border border-border">
              <div className="flex items-start gap-3 mb-3">
                <Brain className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-semibold text-lg mb-3">Comprehensive Technical Analysis</h4>
                  <p className="text-muted-foreground leading-relaxed">{prediction.reason}</p>
                </div>
              </div>
            </div>

            {/* Risk Factors */}
            {prediction.riskFactors && (
              <div className="p-6 rounded-lg bg-orange-500/5 border border-orange-500/20">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-6 w-6 text-orange-600 mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg mb-3 text-orange-600">Key Risk Factors</h4>
                    <ul className="space-y-2">
                      {prediction.riskFactors.split(',').map((risk, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-orange-600 mt-1">•</span>
                          <span>{risk.trim()}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Disclaimer */}
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <p className="text-xs text-muted-foreground text-center">
                ⚠️ This prediction is based on technical analysis and AI modeling. Past performance does not guarantee future results. 
                Stock markets are highly unpredictable and influenced by many external factors. Always do your own research and consult 
                with financial advisors before making investment decisions.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default PredictionDisplay;
