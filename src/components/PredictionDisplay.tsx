import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Brain, Target, TrendingUp, TrendingDown, Calendar, Activity, ArrowUpCircle, ArrowDownCircle, AlertTriangle, BarChart3, Globe, PieChart, Layers } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import MarketContextCard from "./stock/MarketContextCard";
import TechnicalAnalysisCard from "./stock/TechnicalAnalysisCard";
import FundamentalCard from "./stock/FundamentalCard";
import DerivativesCard from "./stock/DerivativesCard";
import ForecastCard from "./stock/ForecastCard";
import ScenarioCard from "./stock/ScenarioCard";
import RecommendationCard from "./stock/RecommendationCard";

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
  riskFactors?: string | string[];
  riskLevel?: string;
  direction?: string;
  newsSentiment?: {
    overall: string;
    summary: string;
    articles: Array<{
      title: string;
      sentiment: string;
      impact: string;
    }>;
  };
  technicals?: any;
  marketContext?: string;
  technicalOutlook?: string;
  fundamentalView?: string;
  recommendation?: {
    action?: string;
    entryPrice?: number;
    target1?: number;
    target2?: number;
    stopLoss?: number;
    riskReward?: number;
    holdingPeriod?: string;
    reasoning?: string;
  };
  forecasts?: {
    shortTerm?: any;
    mediumTerm?: any;
    longTerm?: any;
  };
  scenarios?: {
    bullCase?: any;
    baseCase?: any;
    bearCase?: any;
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
  marketContext?: any;
  fundamentals?: any;
  derivatives?: any;
}

const PredictionDisplay = ({ 
  stock, 
  prediction, 
  historicalData, 
  isCached,
  marketContext,
  fundamentals,
  derivatives
}: PredictionDisplayProps) => {
  const getConfidenceColor = (confidence: string | number) => {
    const value = typeof confidence === 'string' ? parseInt(confidence) : confidence;
    if (value >= 65) return "text-green-600";
    if (value >= 55) return "text-yellow-600";
    return "text-orange-600";
  };

  const getConfidenceBgColor = (confidence: string | number) => {
    const value = typeof confidence === 'string' ? parseInt(confidence) : confidence;
    if (value >= 65) return "bg-green-500/20 border-green-500/50";
    if (value >= 55) return "bg-yellow-500/20 border-yellow-500/50";
    return "bg-orange-500/20 border-orange-500/50";
  };

  const getTrendIcon = (trend?: string) => {
    if (trend === 'bullish' || trend === 'Bullish') return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (trend === 'bearish' || trend === 'Bearish') return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Activity className="h-4 w-4 text-yellow-600" />;
  };

  const openPrice = prediction.openingPrice || prediction.predictedPrice || 0;
  const closePrice = prediction.closingPrice || prediction.targetPrice || 0;
  const priceChange = closePrice - openPrice;
  const priceChangePercent = openPrice ? ((priceChange / openPrice) * 100).toFixed(2) : '0.00';
  const confidenceValue = typeof prediction.confidence === 'string' 
    ? parseInt(prediction.confidence) 
    : prediction.confidence;

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

  // Parse risk factors
  const riskFactorsList = Array.isArray(prediction.riskFactors) 
    ? prediction.riskFactors 
    : prediction.riskFactors?.split(',').map(r => r.trim()) || [];

  return (
    <section id="prediction" className="py-20 px-4 bg-gradient-to-b from-background to-primary/5">
      <div className="container mx-auto max-w-7xl">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold mb-2">
            Professional Research Report: <span className="text-gradient">{stock.name}</span>
          </h2>
          <p className="text-xl text-muted-foreground">
            Symbol: {stock.symbol} • Forecast Date: {new Date(prediction.predictionDate).toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
            {isCached && <Badge variant="outline" className="ml-2">Cached Today</Badge>}
          </p>
        </div>

        {/* Recommendation Banner */}
        <div className="mb-8">
          <RecommendationCard 
            recommendation={prediction.recommendation}
            riskLevel={prediction.riskLevel}
            riskFactors={riskFactorsList}
            confidence={confidenceValue}
            currentPrice={prediction.technicals?.currentPrice || openPrice}
          />
        </div>

        {/* Price Chart */}
        <Card className="glass-strong border-border mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Price Trend (7-Day Historical + Tomorrow's Prediction)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" style={{ fontSize: '12px' }} />
                <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: '12px' }} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="price" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ fill: 'hsl(var(--primary))', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tomorrow's Price Prediction */}
        <Card className="glass-strong border-border mb-8">
          <CardHeader>
            <div className="flex justify-between items-start flex-wrap gap-4">
              <div>
                <CardTitle className="flex items-center gap-3 mb-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Tomorrow's Price Forecast
                </CardTitle>
                <CardDescription>
                  Based on 100-day technical analysis and AI-powered research
                </CardDescription>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge className={getConfidenceBgColor(prediction.confidence)}>
                  <Target className="h-3 w-3 mr-1" />
                  {prediction.confidence}% Confidence
                </Badge>
                {prediction.technicalScore !== undefined && (
                  <Badge variant="outline" className="border-primary/50">
                    <Activity className="h-3 w-3 mr-1" />
                    Score: {prediction.technicalScore}/6
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
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowUpCircle className="h-4 w-4 text-primary" />
                  <p className="text-sm text-muted-foreground">Opening Price</p>
                </div>
                <p className="text-2xl font-bold">₹{openPrice.toLocaleString()}</p>
              </div>
              
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowDownCircle className="h-4 w-4 text-primary" />
                  <p className="text-sm text-muted-foreground">Closing Price</p>
                </div>
                <p className="text-2xl font-bold">₹{closePrice.toLocaleString()}</p>
              </div>
              
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  {getTrendIcon(prediction.trendAlignment)}
                  <p className="text-sm text-muted-foreground">Expected Change</p>
                </div>
                <p className={`text-2xl font-bold ${priceChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {priceChange >= 0 ? '+' : ''}{priceChangePercent}%
                </p>
                <p className="text-sm text-muted-foreground">
                  {priceChange >= 0 ? '+' : ''}₹{priceChange.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabbed Analysis Sections */}
        <Tabs defaultValue="analysis" className="w-full">
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 mb-6">
            <TabsTrigger value="analysis" className="flex items-center gap-1">
              <Brain className="h-4 w-4" />
              <span className="hidden sm:inline">Analysis</span>
            </TabsTrigger>
            <TabsTrigger value="technical" className="flex items-center gap-1">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Technical</span>
            </TabsTrigger>
            <TabsTrigger value="fundamental" className="flex items-center gap-1">
              <PieChart className="h-4 w-4" />
              <span className="hidden sm:inline">Fundamental</span>
            </TabsTrigger>
            <TabsTrigger value="forecast" className="flex items-center gap-1">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Forecast</span>
            </TabsTrigger>
            <TabsTrigger value="scenarios" className="flex items-center gap-1">
              <Layers className="h-4 w-4" />
              <span className="hidden sm:inline">Scenarios</span>
            </TabsTrigger>
            <TabsTrigger value="derivatives" className="flex items-center gap-1">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">F&O</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analysis" className="space-y-6">
            {/* Market Context */}
            <MarketContextCard 
              marketContext={marketContext} 
              marketContextSummary={prediction.marketContext}
            />

            {/* News Sentiment */}
            {prediction.newsSentiment && (
              <Card className="glass-strong border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    News Sentiment Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
                      <h5 className="font-semibold text-sm">Recent News:</h5>
                      {prediction.newsSentiment.articles.slice(0, 3).map((article, idx) => (
                        <div key={idx} className="p-3 bg-muted/30 rounded-lg border border-border/50">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium">{article.title}</p>
                            <Badge variant="outline" className={
                              article.sentiment === 'positive' ? 'text-green-500' : 
                              article.sentiment === 'negative' ? 'text-red-500' : 'text-yellow-500'
                            }>
                              {article.sentiment}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* AI Analysis */}
            <Card className="glass-strong border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  Professional Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{prediction.reason}</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="technical">
            <TechnicalAnalysisCard 
              technicals={prediction.technicals} 
              technicalOutlook={prediction.technicalOutlook}
            />
          </TabsContent>

          <TabsContent value="fundamental">
            <FundamentalCard 
              fundamentals={fundamentals} 
              fundamentalView={prediction.fundamentalView}
            />
          </TabsContent>

          <TabsContent value="forecast">
            <ForecastCard 
              forecasts={prediction.forecasts}
              currentPrice={prediction.technicals?.currentPrice || openPrice}
            />
          </TabsContent>

          <TabsContent value="scenarios">
            <ScenarioCard 
              scenarios={prediction.scenarios}
              currentPrice={prediction.technicals?.currentPrice || openPrice}
            />
          </TabsContent>

          <TabsContent value="derivatives">
            <DerivativesCard 
              derivatives={derivatives}
              currentPrice={prediction.technicals?.currentPrice || openPrice}
            />
          </TabsContent>
        </Tabs>

        {/* Disclaimer */}
        <div className="mt-8 p-4 rounded-lg bg-muted/30 border border-border">
          <p className="text-xs text-muted-foreground text-center">
            ⚠️ This analysis is for educational purposes only. Stock markets are subject to market risks. 
            Past performance is not indicative of future results. Always do your own research and consult 
            with a SEBI-registered investment advisor before making investment decisions.
          </p>
        </div>
      </div>
    </section>
  );
};

export default PredictionDisplay;
