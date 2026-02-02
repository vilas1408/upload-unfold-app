import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TrendingUp, TrendingDown, AlertTriangle, AlertCircle, Activity, Calendar, Clock, BarChart3, Brain, Newspaper, Target, Gauge, LineChart } from "lucide-react";
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Professional Component Imports
import OptionChainAnalysisCard from "./options/OptionChainAnalysisCard";
import GreeksAnalysisCard from "./options/GreeksAnalysisCard";
import VolatilityStudyCard from "./options/VolatilityStudyCard";
import TradeSetupCard from "./options/TradeSetupCard";
import OptionsScenarioCard from "./options/OptionsScenarioCard";
import TechnicalUnderlyingCard from "./options/TechnicalUnderlyingCard";

interface OptionsPrediction {
  strategy: string;
  strikePrice: string | number;
  optionType: 'CALL' | 'PUT' | 'Mixed (Call & Put)';
  expiryDate?: string;
  lotSize?: number;
  targetPrice: string | number;
  stopLoss?: number;
  entryPrice?: number;
  targetExitPrice?: number;
  stopLossPrice?: number;
  expectedReturn: number;
  probability: string;
  maxLoss: number;
  maxGain: number;
  breakeven: string | number;
  totalInvestment?: number;
  profitLoss?: {
    target: number;
    stopLoss: number;
    breakeven: number;
  };
  premium?: {
    buyLeg: number;
    sellLeg: number | null;
    netCost: number;
    targetPremium?: number;
    stopLossPremium?: number;
    description: string;
  };
  ivRank: number;
  greeks: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    rho?: number;
    interpretation?: {
      delta?: string;
      theta?: string;
      vega?: string;
      gamma?: string;
    };
  };
  reasoning: string;
  riskLevel: string;
  timeFrame: string;
  technicalScore: number;
  newsSentiment?: {
    overall: string;
    summary: string;
    articles: Array<{
      title: string;
      sentiment: string;
      impact: string;
    }>;
  };
  liveData?: {
    spotPrice: number;
    openInterest: number;
    volume: number;
    bidPrice: number;
    askPrice: number;
  };
  optionsFlow?: {
    pcr: number | null;
    pcrOI: number | null;
    pcrInterpretation: string;
    maxPain: number | null;
    maxPainInterpretation: string;
  };
  fibonacciLevels?: { [key: string]: number };
  fibonacciInterpretation?: string;
  pivotPoints?: {
    pivot: number;
    r1: number;
    r2: number;
    r3: number;
    s1: number;
    s2: number;
    s3: number;
    interpretation: string;
  };
  greeksValidation?: {
    warnings: string[];
    riskAdjustment: number;
    adjustedConfidence: number;
  };
  positionSizing?: {
    recommendedMultiplier: number;
    recommendedLots: number;
    reasoning: string;
    adjustedInvestment: number;
  };
}

interface OptionsPredictionDisplayProps {
  option: { symbol: string; name: string; type: 'share' | 'index' };
  prediction: OptionsPrediction;
  historicalData: any[];
  dataSource?: 'NSE_LIVE' | 'AI_ESTIMATED';
  realPremiums?: {
    callPremium: number;
    putPremium: number;
    callIV?: number;
    putIV?: number;
  } | null;
  expiryInfo?: {
    date: string;
    formatted: string;
    daysToExpiry: number;
    isExpiryToday: boolean;
  };
  technicalAnalysis?: any;
  ivAnalysis?: {
    ivRank: number;
    ivPercentile: number;
    level: string;
    strategy: string;
  };
}

const OptionsPredictionDisplay = ({ 
  option, 
  prediction, 
  historicalData, 
  dataSource, 
  realPremiums, 
  expiryInfo,
  technicalAnalysis,
  ivAnalysis
}: OptionsPredictionDisplayProps) => {
  const getConfidenceColor = (confidence: string) => {
    const value = parseInt(confidence);
    if (value >= 70) return "text-green-500";
    if (value >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  const getConfidenceBgColor = (confidence: string) => {
    const value = parseInt(confidence);
    if (value >= 70) return "bg-green-500/10 border-green-500/20";
    if (value >= 50) return "bg-yellow-500/10 border-yellow-500/20";
    return "bg-red-500/10 border-red-500/20";
  };

  const chartData = historicalData.slice(-30).map((item) => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    price: item.close,
  }));

  // Detect sentiment-strategy conflicts
  const hasConflict = 
    (prediction.newsSentiment?.overall === 'negative' && prediction.optionType === 'CALL') ||
    (prediction.newsSentiment?.overall === 'positive' && prediction.optionType === 'PUT');

  const spotPrice = prediction.liveData?.spotPrice || historicalData[historicalData.length - 1]?.close || 0;
  const entryPremium = prediction.premium?.buyLeg || 100;
  const lotSize = prediction.lotSize || 50;

  return (
    <div id="options-prediction" className="container mx-auto px-4 py-12">
      {/* Header Section */}
      <Card className="p-6 md:p-8 backdrop-blur-sm bg-card/50 border-primary/20 mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
          <div>
            <h2 className="text-3xl font-bold gradient-text mb-2">
              {option.name} ({option.symbol})
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-sm">
                {option.type === 'share' ? 'Stock Options' : 'Index Options'}
              </Badge>
              {dataSource && (
                <Badge 
                  variant={dataSource === 'NSE_LIVE' ? 'default' : 'destructive'} 
                  className={dataSource === 'NSE_LIVE' ? 'flex items-center gap-1 bg-green-600 hover:bg-green-700' : 'flex items-center gap-1 bg-amber-600 hover:bg-amber-700'}
                >
                  {dataSource === 'NSE_LIVE' ? (
                    <>
                      <Activity className="h-3 w-3" />
                      Live NSE Data
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-3 w-3" />
                      Estimated Premiums
                    </>
                  )}
                </Badge>
              )}
              {expiryInfo && (
                <Badge 
                  variant={expiryInfo.isExpiryToday ? 'destructive' : 'outline'}
                  className="flex items-center gap-1"
                >
                  <Calendar className="h-3 w-3" />
                  {expiryInfo.isExpiryToday ? 'EXPIRY TODAY' : 
                   expiryInfo.daysToExpiry === 1 ? 'Tomorrow' :
                   `${expiryInfo.daysToExpiry} days to expiry`}
                </Badge>
              )}
            </div>
          </div>
          <Badge className={`text-lg px-4 py-2 ${getConfidenceBgColor(prediction.probability)}`}>
            <span className={getConfidenceColor(prediction.probability)}>
              {prediction.probability} Probability
            </span>
          </Badge>
        </div>

        {/* Live Premium Display */}
        {realPremiums && (
          <div className="grid grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg border border-border">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">ATM Call Premium</p>
              <p className="text-xl font-bold text-green-500">
                ₹{realPremiums.callPremium?.toFixed(2) || '-'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">ATM Put Premium</p>
              <p className="text-xl font-bold text-red-500">
                ₹{realPremiums.putPremium?.toFixed(2) || '-'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Call IV</p>
              <p className="text-xl font-bold">{realPremiums.callIV?.toFixed(1) || '-'}%</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Put IV</p>
              <p className="text-xl font-bold">{realPremiums.putIV?.toFixed(1) || '-'}%</p>
            </div>
          </div>
        )}

        {/* Conflict Warning */}
        {hasConflict && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Strategy-Sentiment Conflict</AlertTitle>
            <AlertDescription>
              News sentiment is <strong>{prediction.newsSentiment?.overall}</strong> but strategy recommends <strong>{prediction.optionType}</strong>. 
              System has auto-corrected to align with news sentiment.
            </AlertDescription>
          </Alert>
        )}

        {/* Expiry Warning */}
        {expiryInfo && expiryInfo.daysToExpiry <= 2 && !expiryInfo.isExpiryToday && (
          <Alert className="mt-4 border-yellow-500/50 bg-yellow-500/10">
            <Clock className="h-4 w-4 text-yellow-500" />
            <AlertTitle className="text-yellow-500">Near Expiry Warning</AlertTitle>
            <AlertDescription>
              Only {expiryInfo.daysToExpiry} day{expiryInfo.daysToExpiry > 1 ? 's' : ''} until expiry. 
              Limited time value remaining - focus on directional moves.
            </AlertDescription>
          </Alert>
        )}
      </Card>

      {/* Professional Tabbed Interface */}
      <Tabs defaultValue="trade" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6 lg:grid-cols-6">
          <TabsTrigger value="trade" className="flex items-center gap-1 text-xs md:text-sm">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Trade</span>
          </TabsTrigger>
          <TabsTrigger value="chain" className="flex items-center gap-1 text-xs md:text-sm">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Option Chain</span>
          </TabsTrigger>
          <TabsTrigger value="greeks" className="flex items-center gap-1 text-xs md:text-sm">
            <Gauge className="h-4 w-4" />
            <span className="hidden sm:inline">Greeks</span>
          </TabsTrigger>
          <TabsTrigger value="volatility" className="flex items-center gap-1 text-xs md:text-sm">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Volatility</span>
          </TabsTrigger>
          <TabsTrigger value="technical" className="flex items-center gap-1 text-xs md:text-sm">
            <LineChart className="h-4 w-4" />
            <span className="hidden sm:inline">Technical</span>
          </TabsTrigger>
          <TabsTrigger value="scenario" className="flex items-center gap-1 text-xs md:text-sm">
            <Brain className="h-4 w-4" />
            <span className="hidden sm:inline">Scenario</span>
          </TabsTrigger>
        </TabsList>

        {/* Trade Setup Tab */}
        <TabsContent value="trade" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <TradeSetupCard 
              prediction={prediction} 
              dataSource={dataSource}
            />
            
            {/* AI Reasoning Card */}
            <Card className="glass-strong border-border p-6">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                AI Analysis
              </h3>
              <div className="space-y-4">
                <p className="text-muted-foreground leading-relaxed">{prediction.reasoning}</p>
                
                {/* News Sentiment */}
                {prediction.newsSentiment && (
                  <div className="space-y-3 pt-4 border-t border-border">
                    <div className="flex items-center gap-2">
                      <Newspaper className="h-4 w-4 text-primary" />
                      <span className="font-semibold">News Sentiment</span>
                      <Badge className={
                        prediction.newsSentiment.overall === 'positive' ? 'bg-green-500' :
                        prediction.newsSentiment.overall === 'negative' ? 'bg-red-500' : 'bg-yellow-500'
                      }>
                        {prediction.newsSentiment.overall}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{prediction.newsSentiment.summary}</p>
                    
                    {prediction.newsSentiment.articles && prediction.newsSentiment.articles.length > 0 && (
                      <div className="space-y-2">
                        {prediction.newsSentiment.articles.slice(0, 3).map((article, idx) => (
                          <div key={idx} className="p-2 rounded bg-muted/30 text-xs flex items-start gap-2">
                            {article.sentiment === 'positive' ? (
                              <TrendingUp className="h-3 w-3 text-green-500 flex-shrink-0 mt-0.5" />
                            ) : article.sentiment === 'negative' ? (
                              <TrendingDown className="h-3 w-3 text-red-500 flex-shrink-0 mt-0.5" />
                            ) : null}
                            <span className="text-muted-foreground">{article.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Price Chart */}
          <Card className="p-6 glass-strong border-border">
            <h3 className="text-xl font-semibold mb-4">Price History (30 Days)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} domain={['auto', 'auto']} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="price" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>

        {/* Option Chain Tab */}
        <TabsContent value="chain" className="space-y-6">
          <OptionChainAnalysisCard 
            optionsFlow={prediction.optionsFlow}
            spotPrice={spotPrice}
          />
        </TabsContent>

        {/* Greeks Tab */}
        <TabsContent value="greeks" className="space-y-6">
          <GreeksAnalysisCard 
            greeks={prediction.greeks}
            optionType={prediction.optionType === 'CALL' ? 'CALL' : 'PUT'}
            daysToExpiry={expiryInfo?.daysToExpiry || 7}
            premium={entryPremium}
            lotSize={lotSize}
            greeksValidation={prediction.greeksValidation}
            positionSizing={prediction.positionSizing}
          />
        </TabsContent>

        {/* Volatility Tab */}
        <TabsContent value="volatility" className="space-y-6">
          <VolatilityStudyCard 
            ivAnalysis={ivAnalysis || {
              ivRank: prediction.ivRank,
              ivPercentile: prediction.ivRank,
              level: prediction.ivRank > 70 ? 'HIGH' : prediction.ivRank > 40 ? 'MODERATE' : 'LOW',
              strategy: prediction.ivRank > 70 ? 'Consider selling strategies' : 'Consider buying strategies'
            }}
            realPremiums={realPremiums ? {
              callIV: realPremiums.callIV,
              putIV: realPremiums.putIV
            } : undefined}
            technicalAnalysis={technicalAnalysis}
            spotPrice={spotPrice}
          />
        </TabsContent>

        {/* Technical Tab */}
        <TabsContent value="technical" className="space-y-6">
          <TechnicalUnderlyingCard 
            technicalAnalysis={technicalAnalysis}
            analysis={{
              current: spotPrice,
              rsi: technicalAnalysis?.rsi || 50,
              sma20: technicalAnalysis?.sma20 || spotPrice,
              trend: prediction.optionType === 'CALL' ? 'Bullish' : 'Bearish',
              trendScore: prediction.technicalScore || 5
            }}
            pivotPoints={prediction.pivotPoints}
            fibonacciLevels={prediction.fibonacciLevels}
          />
        </TabsContent>

        {/* Scenario Tab */}
        <TabsContent value="scenario" className="space-y-6">
          <OptionsScenarioCard 
            optionType={prediction.optionType === 'CALL' ? 'CALL' : 'PUT'}
            spotPrice={spotPrice}
            entryPremium={entryPremium}
            lotSize={lotSize}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OptionsPredictionDisplay;
