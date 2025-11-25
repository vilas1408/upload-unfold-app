import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, AlertCircle, Target, Shield, Activity, Brain, Calendar, Clock } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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
}

interface OptionsPredictionDisplayProps {
  option: { symbol: string; name: string; type: 'share' | 'index' };
  prediction: OptionsPrediction;
  historicalData: any[];
  dataSource?: 'NSE_LIVE' | 'AI_ESTIMATED';
  realPremiums?: {
    callPremium: number;
    putPremium: number;
  } | null;
  expiryInfo?: {
    date: string;
    formatted: string;
    daysToExpiry: number;
    isExpiryToday: boolean;
  };
}

const OptionsPredictionDisplay = ({ option, prediction, historicalData, dataSource, realPremiums, expiryInfo }: OptionsPredictionDisplayProps) => {
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

  const getRiskColor = (risk: string) => {
    if (risk === 'Low') return "bg-green-500/10 text-green-500 border-green-500/20";
    if (risk === 'Medium') return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    return "bg-red-500/10 text-red-500 border-red-500/20";
  };

  const chartData = historicalData.slice(-30).map((item) => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    price: item.close,
  }));

  // Detect sentiment-strategy conflicts
  const hasConflict = 
    (prediction.newsSentiment?.overall === 'negative' && prediction.optionType === 'CALL') ||
    (prediction.newsSentiment?.overall === 'positive' && prediction.optionType === 'PUT');

  return (
    <div id="options-prediction" className="container mx-auto px-4 py-12">
      <Card className="p-6 md:p-8 backdrop-blur-sm bg-card/50 border-primary/20">
        <div className="mb-8">
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
                        Estimated Premiums - NSE Unavailable
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
                    {expiryInfo.isExpiryToday ? 'TODAY - EXIT BY 3:15 PM' : 
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

          {/* Real Premium Display */}
          {realPremiums && (
            <Card className="p-4 mb-6 bg-primary/5 border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Live NSE Option Premiums</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-card rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">ATM Call Premium</p>
                  <p className="text-2xl font-bold text-green-500">₹{realPremiums.callPremium.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-1">per lot</p>
                </div>
                <div className="text-center p-3 bg-card rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">ATM Put Premium</p>
                  <p className="text-2xl font-bold text-red-500">₹{realPremiums.putPremium.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-1">per lot</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 mt-3 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Last updated: {new Date().toLocaleTimeString('en-IN', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  second: '2-digit',
                  timeZone: 'Asia/Kolkata'
                })} IST</span>
              </div>
            </Card>
          )}

          {/* Sentiment-Strategy Conflict Warning */}
          {hasConflict && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Strategy-Sentiment Conflict Detected</AlertTitle>
              <AlertDescription>
                News sentiment is <strong>{prediction.newsSentiment?.overall}</strong> but strategy recommends <strong>{prediction.optionType}</strong>. 
                This indicates mixed signals between fundamentals and technicals. The system has auto-corrected to align with news sentiment (higher priority). Trade with caution.
              </AlertDescription>
            </Alert>
          )}

          {/* Time to Expiry Warning */}
          {expiryInfo && expiryInfo.daysToExpiry <= 2 && !expiryInfo.isExpiryToday && (
            <Card className="p-4 mb-6 bg-yellow-500/10 border-yellow-500/20">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="font-semibold text-yellow-600 dark:text-yellow-400">Near Expiry Warning</p>
                  <p className="text-sm text-muted-foreground">
                    Only {expiryInfo.daysToExpiry} day{expiryInfo.daysToExpiry > 1 ? 's' : ''} until expiry. 
                    Limited time value remaining - focus on directional moves.
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="p-6 bg-accent/50">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Recommended Strategy
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Strategy Type</p>
                <p className="text-2xl font-bold text-primary">{prediction.strategy}</p>
              </div>
              
              {/* Prominent Option Details */}
              <div className="grid grid-cols-2 gap-3 p-4 bg-background/50 rounded-lg border border-border">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Option</p>
                  <Badge className={prediction.optionType === 'CALL' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}>
                    {prediction.optionType}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Strike</p>
                  <p className="text-lg font-bold">₹{typeof prediction.strikePrice === 'number' ? prediction.strikePrice.toLocaleString('en-IN') : prediction.strikePrice}</p>
                </div>
                {prediction.expiryDate && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Expiry</p>
                    <p className="text-sm font-semibold">{prediction.expiryDate}</p>
                  </div>
                )}
                {prediction.lotSize && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Lot Size</p>
                    <p className="text-sm font-semibold">{prediction.lotSize} units</p>
                  </div>
                )}
              </div>
              
              {/* Premium Information */}
              {prediction.premium && (
                <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                  <h4 className="text-sm font-semibold mb-3 text-primary flex items-center gap-2">
                    Premium Details
                    {prediction.liveData && (
                      <Badge className="bg-green-500 text-white">LIVE</Badge>
                    )}
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-xs text-muted-foreground">
                        {prediction.liveData ? 'Current LTP' : 'Entry Premium'}
                      </span>
                      <span className="font-bold text-lg">₹{prediction.premium.buyLeg}/lot</span>
                    </div>
                    {prediction.liveData && (
                      <>
                        <div className="flex justify-between items-center py-2 border-b border-border/50">
                          <span className="text-xs text-muted-foreground">Bid Price</span>
                          <span className="font-semibold">₹{prediction.liveData.bidPrice.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-border/50">
                          <span className="text-xs text-muted-foreground">Ask Price</span>
                          <span className="font-semibold">₹{prediction.liveData.askPrice.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-border/50">
                          <span className="text-xs text-muted-foreground">Open Interest</span>
                          <span className="font-semibold">{prediction.liveData.openInterest.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-border/50">
                          <span className="text-xs text-muted-foreground">Volume</span>
                          <span className="font-semibold">{prediction.liveData.volume.toLocaleString('en-IN')}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-xs text-muted-foreground">Target Premium</span>
                      <span className="font-bold text-green-500">
                        ₹{Math.round(prediction.premium.targetPremium || prediction.premium.buyLeg * 1.4)}/lot 
                        ({prediction.premium.targetPremium 
                          ? `+${Math.round(((prediction.premium.targetPremium - prediction.premium.buyLeg) / prediction.premium.buyLeg) * 100)}%`
                          : '+40%'})
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-xs text-muted-foreground">Stop Loss Premium</span>
                      <span className="font-bold text-red-500">
                        ₹{Math.round(prediction.premium.stopLossPremium || prediction.premium.buyLeg * 0.7)}/lot 
                        ({prediction.premium.stopLossPremium 
                          ? `${Math.round(((prediction.premium.stopLossPremium - prediction.premium.buyLeg) / prediction.premium.buyLeg) * 100)}%`
                          : '-30%'})
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              {prediction.totalInvestment && (
                <div className="p-4 bg-background/50 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Total Investment</p>
                  <p className="text-3xl font-bold text-primary">₹{prediction.totalInvestment.toLocaleString('en-IN')}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    ₹{prediction.premium?.buyLeg || 0} × {prediction.lotSize} units
                  </p>
                </div>
              )}
              
              <div className="space-y-2 mt-4">
                <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                  <div className="text-xs text-muted-foreground mb-1">Entry Price</div>
                  <div className="text-lg font-bold text-primary">
                    ₹{(prediction.entryPrice || (typeof prediction.strikePrice === 'number' ? prediction.strikePrice : parseFloat(prediction.strikePrice as string))).toFixed(2)}
                  </div>
                </div>
                <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                  <div className="text-xs text-muted-foreground mb-1">Target Exit Price</div>
                  <div className="text-lg font-bold text-green-500">
                    ₹{(prediction.targetExitPrice || (typeof prediction.targetPrice === 'number' ? prediction.targetPrice : parseFloat(prediction.targetPrice as string))).toFixed(2)}
                  </div>
                </div>
                <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                  <div className="text-xs text-muted-foreground mb-1">Stop Loss Price</div>
                  <div className="text-lg font-bold text-red-500">
                    ₹{(prediction.stopLossPrice || prediction.stopLoss || 0).toFixed(2)}
                  </div>
                </div>
              </div>
              
              {prediction.totalInvestment && (
                <div className="mt-4 p-4 bg-background/50 rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground mb-2">Total Investment Required</p>
                  <p className="text-2xl font-bold text-primary">₹{prediction.totalInvestment.toLocaleString('en-IN')}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Premium ₹{prediction.premium?.buyLeg || 0} per lot × {prediction.lotSize} lots
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Time Frame</p>
                  <p className="font-semibold">{prediction.timeFrame}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Technical Score</p>
                  <Badge variant="outline">{prediction.technicalScore}/10</Badge>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-accent/50">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Profit & Loss Analysis
            </h3>
            <div className="space-y-4">
              {prediction.profitLoss ? (
                <>
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Target Profit</p>
                    <p className="text-2xl font-bold text-green-500">
                      +₹{prediction.profitLoss.target.toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      At target price ₹{typeof prediction.targetPrice === 'number' ? prediction.targetPrice.toFixed(2) : prediction.targetPrice}
                    </p>
                  </div>
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Stop Loss</p>
                    <p className="text-2xl font-bold text-red-500">
                      ₹{(prediction.profitLoss.stopLoss || 0).toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      At stop loss ₹{(prediction.stopLoss || prediction.stopLossPrice || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Breakeven Point</p>
                    <p className="text-xl font-bold text-yellow-500">
                      ₹{prediction.profitLoss.breakeven.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Expected Return</p>
                    <p className="text-2xl font-bold text-green-500">
                      +{Number(prediction.expectedReturn).toFixed(2)}%
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Expected Return</p>
                    <p className="text-2xl font-bold text-green-500">
                      +{Number(prediction.expectedReturn).toFixed(2)}%
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Max Gain</p>
                      <p className="text-lg font-semibold text-green-500">₹{Number(prediction.maxGain).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Max Loss</p>
                      <p className="text-lg font-semibold text-red-500">₹{Number(prediction.maxLoss).toFixed(2)}</p>
                    </div>
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Risk Level</p>
                  <Badge className={getRiskColor(prediction.riskLevel)}>
                    {prediction.riskLevel}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">IV Rank</p>
                  <p className="text-lg font-semibold">{prediction.ivRank}%</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-6 bg-accent/50 mb-8">
          <h3 className="text-xl font-semibold mb-4">Price Targets & Greeks</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Price Targets</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Target Price:</span>
                  <span className="font-semibold text-green-500">{typeof prediction.targetPrice === 'number' ? `₹${prediction.targetPrice.toFixed(2)}` : prediction.targetPrice}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Stop Loss:</span>
                  <span className="font-semibold text-red-500">₹{(Number(prediction.stopLoss) || Number(prediction.stopLossPrice) || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Breakeven:</span>
                  <span className="font-semibold">{typeof prediction.breakeven === 'number' ? `₹${prediction.breakeven.toFixed(2)}` : prediction.breakeven}</span>
                </div>
              </div>
            </div>

            {prediction.premium && (
              <div>
                <h4 className="font-semibold mb-3">Premium Details</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Premium per Lot:</span>
                    <span className="font-semibold text-primary">₹{Number(prediction.premium.buyLeg).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Number of Lots:</span>
                    <span className="font-semibold">{prediction.lotSize || 1}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-border">
                    <span className="text-sm font-semibold">Total Premium:</span>
                    <span className="font-bold text-primary">₹{(Number(prediction.premium.buyLeg) * (prediction.lotSize || 1)).toLocaleString('en-IN')}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{prediction.premium.description}</p>
                </div>
              </div>
            )}

            <div className="md:col-span-2">
              <h4 className="font-semibold mb-3">Option Greeks</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Delta (Δ):</span>
                    <span className="font-semibold">{Number(prediction.greeks.delta).toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Gamma (Γ):</span>
                    <span className="font-semibold">{Number(prediction.greeks.gamma).toFixed(3)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Theta (Θ):</span>
                    <span className="font-semibold">{Number(prediction.greeks.theta).toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Vega (ν):</span>
                    <span className="font-semibold">{Number(prediction.greeks.vega).toFixed(3)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-accent/50 mb-8">
          <h3 className="text-xl font-semibold mb-4">30-Day Price History</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="date" 
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
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
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {prediction.newsSentiment && (
          <Card className="p-6 bg-accent/50 mb-8">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              News Sentiment Analysis
            </h3>
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
                  <h4 className="font-semibold text-sm">Recent News Articles:</h4>
                  {prediction.newsSentiment.articles.map((article, idx) => (
                    <div key={idx} className="p-3 bg-background/50 rounded-lg border border-border/50">
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
          </Card>
        )}

        <Card className="p-6 bg-accent/50 mb-8">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            AI Technical Analysis
          </h3>
          <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
            {prediction.reasoning}
          </p>
        </Card>

        <Card className="p-6 bg-destructive/10 border-destructive/20">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Important Disclaimer
          </h3>
          <p className="text-sm text-muted-foreground">
            Options trading carries substantial risk and is not suitable for all investors. 
            This prediction is for educational purposes only and should not be considered as financial advice. 
            The probability of success is based on technical analysis and does not guarantee profits. 
            Please consult with a certified financial advisor before making any investment decisions. 
            Always understand the risks involved and only trade with money you can afford to lose.
          </p>
        </Card>
      </Card>
    </div>
  );
};

export default OptionsPredictionDisplay;
