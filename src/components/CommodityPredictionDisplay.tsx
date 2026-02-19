import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, AlertTriangle, Target, Shield, Activity, Brain, Globe, DollarSign, BarChart3, Calendar, Layers } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import TechnicalAnalysisCard from "./commodity/TechnicalAnalysisCard";
import FundamentalAnalysisCard from "./commodity/FundamentalAnalysisCard";
import MacroFactorsCard from "./commodity/MacroFactorsCard";
import ScenarioAnalysisCard from "./commodity/ScenarioAnalysisCard";
import PriceForecastCard from "./commodity/PriceForecastCard";
import TermStructureCard from "./commodity/TermStructureCard";

interface CommodityPrediction {
  strategy: string;
  strikePrice: number;
  optionType: 'CALL' | 'PUT';
  expiryDate?: string;
  lotSize?: number;
  targetPrice: number;
  stopLoss: number;
  entryPrice: number;
  expectedReturn: number;
  probability: string;
  maxLoss: number;
  maxGain: number;
  totalInvestment?: number;
  premium?: {
    buyLeg: number;
    targetPremium?: number;
    stopLossPremium?: number;
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
  internationalCorrelation?: {
    comexGold?: number;
    brentCrude?: number;
    nymexGas?: number;
    lmeCopper?: number;
    usdInr: number;
  };
  globalFactors?: string[];
}

interface CommodityPredictionDisplayProps {
  commodity: { symbol: string; name: string };
  prediction: CommodityPrediction & {
    daysToExpiry?: number;
    dataQuality?: {
      source: string;
      isLive: boolean;
      expirySource: string;
    };
  };
  historicalData: any[];
  dataSource?: 'MCX_LIVE' | 'YAHOO_FINANCE' | 'AI_ESTIMATED';
  dataTimestamp?: string;
  technicals?: any;
  fundamentals?: any;
  macro?: any;
  forecasts?: any;
  scenarios?: any;
  termStructure?: any;
}

const safeNum = (val: any): number | null =>
  typeof val === 'number' && Number.isFinite(val) ? val : null;

const fmtInr = (val: any, fallback = '—'): string => {
  const n = safeNum(val);
  return n !== null ? `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : fallback;
};

const CommodityPredictionDisplay = ({ 
  commodity, 
  prediction, 
  historicalData, 
  dataSource, 
  dataTimestamp,
  technicals,
  fundamentals,
  macro,
  forecasts,
  scenarios,
  termStructure
}: CommodityPredictionDisplayProps) => {
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

  const hasProfessionalData = technicals || fundamentals || macro || forecasts || scenarios;

  return (
    <div id="commodity-prediction" className="container mx-auto px-4 py-12">
      <Card className="p-6 md:p-8 backdrop-blur-sm bg-card/50 border-primary/20">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
            <div>
              <h2 className="text-3xl font-bold gradient-text mb-2">
                {commodity.name} ({commodity.symbol})
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-sm">
                  MCX Commodity
                </Badge>
                <Badge variant="secondary" className="text-sm">
                  Professional Analysis
                </Badge>
                {dataSource && (
                  <Badge 
                    variant={dataSource === 'MCX_LIVE' ? 'default' : dataSource === 'YAHOO_FINANCE' ? 'secondary' : 'destructive'} 
                    className={
                      dataSource === 'MCX_LIVE' ? 'flex items-center gap-1 bg-green-600 hover:bg-green-700' : 
                      dataSource === 'YAHOO_FINANCE' ? 'flex items-center gap-1 bg-blue-600 hover:bg-blue-700' :
                      'flex items-center gap-1 bg-amber-600 hover:bg-amber-700'
                    }
                  >
                    {dataSource === 'MCX_LIVE' ? (
                      <>
                        <Activity className="h-3 w-3" />
                        Live MCX Data
                      </>
                    ) : dataSource === 'YAHOO_FINANCE' ? (
                      <>
                        <Globe className="h-3 w-3" />
                        Yahoo Finance (Intl.)
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3 w-3" />
                        AI Estimated
                      </>
                    )}
                  </Badge>
                )}
                {dataTimestamp && (
                  <span className="text-xs text-muted-foreground">
                    Updated: {new Date(dataTimestamp).toLocaleTimeString('en-IN')}
                  </span>
                )}
              </div>
            </div>
            <Badge className={`text-lg px-4 py-2 ${getConfidenceBgColor(prediction.probability)}`}>
              <span className={getConfidenceColor(prediction.probability)}>
                {prediction.probability} Confidence
              </span>
            </Badge>
          </div>

          {/* Market Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="p-4 bg-primary/10 border-primary/20">
              <p className="text-xs text-muted-foreground mb-1">Spot Price</p>
              <p className="text-2xl font-bold text-primary">
                {fmtInr(prediction.entryPrice)}
              </p>
            </Card>
            <Card className="p-4 bg-accent/50">
              <p className="text-xs text-muted-foreground mb-1">Technical Score</p>
              <p className="text-2xl font-bold">{safeNum(prediction.technicalScore) ?? '—'}/100</p>
            </Card>
            <Card className="p-4 bg-accent/50">
              <p className="text-xs text-muted-foreground mb-1">Days to Expiry</p>
              <p className="text-2xl font-bold">{prediction.daysToExpiry || 'N/A'}</p>
            </Card>
            <Card className="p-4 bg-accent/50">
              <p className="text-xs text-muted-foreground mb-1">IV Rank</p>
              <p className="text-2xl font-bold">{safeNum(prediction.ivRank) ?? '—'}%</p>
            </Card>
          </div>

          {/* International Correlation */}
          {prediction.internationalCorrelation && (
            <Card className="p-4 mb-6 bg-primary/5 border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">International Price Correlation</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {prediction.internationalCorrelation.comexGold && (
                  <div className="text-center p-3 bg-card rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">COMEX Gold</p>
                    <p className="text-xl font-bold text-yellow-500">${prediction.internationalCorrelation.comexGold}</p>
                  </div>
                )}
                {prediction.internationalCorrelation.brentCrude && (
                  <div className="text-center p-3 bg-card rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Brent Crude</p>
                    <p className="text-xl font-bold text-green-500">${prediction.internationalCorrelation.brentCrude}</p>
                  </div>
                )}
                {prediction.internationalCorrelation.nymexGas && (
                  <div className="text-center p-3 bg-card rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">NYMEX Gas</p>
                    <p className="text-xl font-bold text-blue-500">${prediction.internationalCorrelation.nymexGas}</p>
                  </div>
                )}
                {prediction.internationalCorrelation.lmeCopper && (
                  <div className="text-center p-3 bg-card rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">LME Copper</p>
                    <p className="text-xl font-bold text-orange-500">${prediction.internationalCorrelation.lmeCopper}</p>
                  </div>
                )}
                <div className="text-center p-3 bg-card rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">USD/INR</p>
                  <p className="text-xl font-bold text-primary">₹{prediction.internationalCorrelation.usdInr}</p>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Professional Analysis Tabs */}
        {hasProfessionalData ? (
          <Tabs defaultValue="recommendation" className="mb-8">
            <TabsList className="grid grid-cols-3 md:grid-cols-6 gap-1 h-auto p-1">
              <TabsTrigger value="recommendation" className="text-xs md:text-sm py-2">
                <Target className="h-4 w-4 mr-1 hidden md:inline" />
                Trade
              </TabsTrigger>
              <TabsTrigger value="technical" className="text-xs md:text-sm py-2">
                <Activity className="h-4 w-4 mr-1 hidden md:inline" />
                Technical
              </TabsTrigger>
              <TabsTrigger value="fundamental" className="text-xs md:text-sm py-2">
                <Layers className="h-4 w-4 mr-1 hidden md:inline" />
                Fundamental
              </TabsTrigger>
              <TabsTrigger value="macro" className="text-xs md:text-sm py-2">
                <BarChart3 className="h-4 w-4 mr-1 hidden md:inline" />
                Macro
              </TabsTrigger>
              <TabsTrigger value="forecast" className="text-xs md:text-sm py-2">
                <TrendingUp className="h-4 w-4 mr-1 hidden md:inline" />
                Forecast
              </TabsTrigger>
              <TabsTrigger value="scenarios" className="text-xs md:text-sm py-2">
                <Calendar className="h-4 w-4 mr-1 hidden md:inline" />
                Scenarios
              </TabsTrigger>
            </TabsList>

            {/* Trade Recommendation Tab */}
            <TabsContent value="recommendation" className="mt-6">
              <div className="grid md:grid-cols-2 gap-6">
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
                    
                    <div className="grid grid-cols-2 gap-3 p-4 bg-background/50 rounded-lg border border-border">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Option</p>
                        <Badge className={prediction.optionType === 'CALL' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}>
                          {prediction.optionType}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Strike</p>
                        <p className="text-lg font-bold">{fmtInr(prediction.strikePrice)}</p>
                      </div>
                      {prediction.expiryDate && (
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground mb-1">Expiry</p>
                          <p className="text-sm font-semibold">{prediction.expiryDate}</p>
                          {prediction.daysToExpiry && (
                            <p className="text-xs text-muted-foreground">({prediction.daysToExpiry} days)</p>
                          )}
                        </div>
                      )}
                      {prediction.lotSize && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Lot Size</p>
                          <p className="text-sm font-semibold">{prediction.lotSize} units</p>
                        </div>
                      )}
                    </div>
                    
                    {prediction.premium && (
                      <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                        <h4 className="text-sm font-semibold mb-3 text-primary">Premium Details</h4>
                        <div className="grid grid-cols-1 gap-2">
                          <div className="flex justify-between items-center py-2 border-b border-border/50">
                            <span className="text-xs text-muted-foreground">Entry Premium</span>
                            <span className="font-bold text-lg">₹{prediction.premium.buyLeg}/lot</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-border/50">
                            <span className="text-xs text-muted-foreground">Target Premium</span>
                            <span className="font-bold text-green-500">
                              ₹{Math.round(prediction.premium.targetPremium || prediction.premium.buyLeg * 1.4)}/lot
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-2">
                            <span className="text-xs text-muted-foreground">Stop Loss Premium</span>
                            <span className="font-bold text-red-500">
                              ₹{Math.round(prediction.premium.stopLossPremium || prediction.premium.buyLeg * 0.7)}/lot
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {prediction.totalInvestment && (
                      <div className="p-4 bg-background/50 rounded-lg border border-border">
                        <p className="text-xs text-muted-foreground mb-1">Total Investment</p>
                        <p className="text-3xl font-bold text-primary">₹{prediction.totalInvestment.toLocaleString('en-IN')}</p>
                      </div>
                    )}
                  </div>
                </Card>

                <Card className="p-6 bg-accent/50">
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Risk Analysis
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                        <p className="text-xs text-muted-foreground mb-1">Max Gain</p>
                        <p className="text-xl font-bold text-green-500">
                          {fmtInr(prediction.maxGain)}
                        </p>
                      </div>
                      <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                        <p className="text-xs text-muted-foreground mb-1">Max Loss</p>
                        <p className="text-xl font-bold text-red-500">
                          {fmtInr(prediction.maxLoss)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-background/50 rounded-lg border border-border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Risk Level</span>
                        <Badge className={getRiskColor(prediction.riskLevel)}>
                          {prediction.riskLevel}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Time Frame</span>
                        <span className="font-semibold">{prediction.timeFrame}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">IV Rank</span>
                        <span className="font-semibold">{prediction.ivRank}%</span>
                      </div>
                    </div>

                    <div className="p-4 bg-background/50 rounded-lg border border-border">
                      <h4 className="text-sm font-semibold mb-3">Greeks</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Delta</p>
                          <p className="font-semibold">{safeNum(prediction.greeks?.delta) !== null ? prediction.greeks.delta.toFixed(2) : '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Gamma</p>
                          <p className="font-semibold">{safeNum(prediction.greeks?.gamma) !== null ? prediction.greeks.gamma.toFixed(4) : '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Theta</p>
                          <p className="font-semibold text-red-500">{safeNum(prediction.greeks?.theta) !== null ? `-${Math.abs(prediction.greeks.theta).toFixed(2)}` : '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Vega</p>
                          <p className="font-semibold">{safeNum(prediction.greeks?.vega) !== null ? prediction.greeks.vega.toFixed(2) : '—'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Global Factors */}
              {prediction.globalFactors && prediction.globalFactors.length > 0 && (
                <Card className="p-6 mt-6 bg-accent/50">
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Global Market Factors
                  </h3>
                  <div className="grid md:grid-cols-2 gap-2">
                    {prediction.globalFactors.map((factor, index) => (
                      <div key={index} className="flex items-start gap-2 p-2 bg-background/50 rounded">
                        <TrendingUp className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-foreground">{factor}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </TabsContent>

            {/* Technical Analysis Tab */}
            <TabsContent value="technical" className="mt-6">
              {technicals ? (
                <TechnicalAnalysisCard technicals={technicals} />
              ) : (
                <Card className="p-6 text-center text-muted-foreground">
                  Technical analysis data not available
                </Card>
              )}
            </TabsContent>

            {/* Fundamental Analysis Tab */}
            <TabsContent value="fundamental" className="mt-6">
              {fundamentals ? (
                <FundamentalAnalysisCard fundamentals={fundamentals} commodityName={commodity.name} />
              ) : (
                <Card className="p-6 text-center text-muted-foreground">
                  Fundamental analysis data not available
                </Card>
              )}
            </TabsContent>

            {/* Macro Factors Tab */}
            <TabsContent value="macro" className="mt-6">
              {macro ? (
                <>
                  <MacroFactorsCard macro={macro} commoditySymbol={commodity.symbol} />
                  {termStructure && (
                    <div className="mt-6">
                      <TermStructureCard contract={termStructure} commodityName={commodity.name} />
                    </div>
                  )}
                </>
              ) : (
                <Card className="p-6 text-center text-muted-foreground">
                  Macro indicators data not available
                </Card>
              )}
            </TabsContent>

            {/* Price Forecast Tab */}
            <TabsContent value="forecast" className="mt-6">
              {forecasts ? (
                <PriceForecastCard forecasts={forecasts} currentPrice={prediction.entryPrice} />
              ) : (
                <Card className="p-6 text-center text-muted-foreground">
                  Price forecast data not available
                </Card>
              )}
            </TabsContent>

            {/* Scenario Analysis Tab */}
            <TabsContent value="scenarios" className="mt-6">
              {scenarios ? (
                <ScenarioAnalysisCard 
                  scenarios={scenarios} 
                  currentPrice={prediction.entryPrice} 
                  commodityName={commodity.name}
                />
              ) : (
                <Card className="p-6 text-center text-muted-foreground">
                  Scenario analysis data not available
                </Card>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          /* Fallback to original layout if no professional data */
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
                
                <div className="grid grid-cols-2 gap-3 p-4 bg-background/50 rounded-lg border border-border">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Option</p>
                    <Badge className={prediction.optionType === 'CALL' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}>
                      {prediction.optionType}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Strike</p>
                    <p className="text-lg font-bold">{fmtInr(prediction.strikePrice)}</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-accent/50">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Risk Analysis
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                  <p className="text-xs text-muted-foreground mb-1">Max Gain</p>
                  <p className="text-xl font-bold text-green-500">
                    {fmtInr(prediction.maxGain)}
                  </p>
                </div>
                <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                  <p className="text-xs text-muted-foreground mb-1">Max Loss</p>
                  <p className="text-xl font-bold text-red-500">
                    {fmtInr(prediction.maxLoss)}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Price Chart */}
        {chartData.length > 0 && (
          <Card className="p-6 bg-accent/50 mb-6">
            <h3 className="text-xl font-semibold mb-4">Price Movement (30 Days)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
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
            </div>
          </Card>
        )}

        {/* AI Reasoning */}
        <Card className="p-6 bg-accent/50">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI Analysis & Reasoning
          </h3>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="text-foreground leading-relaxed whitespace-pre-line">
              {prediction.reasoning}
            </p>
          </div>
        </Card>

        {/* Disclaimer */}
        <Alert className="mt-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Commodity Trading Risk Disclaimer</AlertTitle>
          <AlertDescription>
            Commodity trading involves substantial risk of loss. MCX trades extended hours (9 AM - 11:30 PM IST) 
            and prices are affected by global markets, USD/INR rates, and geopolitical events. 
            This analysis is for educational purposes only. Always verify with your broker before trading.
          </AlertDescription>
        </Alert>
      </Card>
    </div>
  );
};

export default CommodityPredictionDisplay;
