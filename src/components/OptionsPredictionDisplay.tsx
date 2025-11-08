import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Target, Shield } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface OptionsPrediction {
  strategy: string;
  actionSignal?: string;
  strikePrice: string | number;
  optionType: 'CALL' | 'PUT' | 'Mixed (Call & Put)';
  entryPrice?: number;
  targetPrice: string | number;
  stopLoss: number;
  expectedReturn: number;
  probability: string;
  maxLoss: number;
  maxGain: number;
  breakeven: string | number;
  premium?: {
    buyLeg: number;
    sellLeg: number | null;
    netCost: number;
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
}

interface OptionsPredictionDisplayProps {
  option: { symbol: string; name: string; type: 'share' | 'index' };
  prediction: OptionsPrediction;
  historicalData: any[];
}

const OptionsPredictionDisplay = ({ option, prediction, historicalData }: OptionsPredictionDisplayProps) => {
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

  return (
    <div id="options-prediction" className="container mx-auto px-4 py-12">
      <Card className="p-6 md:p-8 backdrop-blur-sm bg-card/50 border-primary/20">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-3xl font-bold gradient-text mb-2">
                {option.name} ({option.symbol})
              </h2>
              <Badge variant="outline" className="text-sm">
                {option.type === 'share' ? 'Stock Options' : 'Index Options'}
              </Badge>
            </div>
            <Badge className={`text-lg px-4 py-2 ${getConfidenceBgColor(prediction.probability)}`}>
              <span className={getConfidenceColor(prediction.probability)}>
                {prediction.probability} Probability
              </span>
            </Badge>
          </div>

          {/* Direct Action Signal */}
          {prediction.actionSignal && (
            <Card className={`p-6 mb-6 ${prediction.optionType === 'CALL' ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`text-5xl font-bold ${prediction.optionType === 'CALL' ? 'text-green-500' : 'text-red-500'}`}>
                    {prediction.actionSignal}
                  </div>
                  <div className="text-left">
                    <p className="text-sm text-muted-foreground">For {option.name}</p>
                    <p className="text-lg font-semibold">Strike: {typeof prediction.strikePrice === 'number' ? `₹${prediction.strikePrice.toFixed(2)}` : prediction.strikePrice}</p>
                  </div>
                </div>
                <div className="text-right">
                  {prediction.entryPrice && (
                    <>
                      <p className="text-sm text-muted-foreground">Entry (Premium)</p>
                      <p className="text-2xl font-bold text-primary">₹{Number(prediction.entryPrice).toFixed(2)}</p>
                    </>
                  )}
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Option Type</p>
                  <Badge className={prediction.optionType === 'CALL' ? 'bg-green-500' : 'bg-red-500'}>
                    {prediction.optionType}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Strike Price</p>
                  <p className="text-lg font-semibold">{typeof prediction.strikePrice === 'number' ? `₹${prediction.strikePrice.toFixed(2)}` : prediction.strikePrice}</p>
                </div>
              </div>
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
              Risk & Reward Profile
            </h3>
            <div className="space-y-4">
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
            </div>
          </Card>
        </div>

        <Card className="p-6 bg-accent/50 mb-8">
          <h3 className="text-xl font-semibold mb-4">Trading Levels & Greeks</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Entry, Target & Stop Loss
              </h4>
              <div className="space-y-3">
                {prediction.entryPrice && (
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <span className="text-xs text-muted-foreground block">ENTRY (Premium)</span>
                    <span className="text-xl font-bold text-primary">₹{Number(prediction.entryPrice).toFixed(2)}</span>
                  </div>
                )}
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <span className="text-xs text-muted-foreground block">TARGET</span>
                  <span className="text-xl font-bold text-green-500">{typeof prediction.targetPrice === 'number' ? `₹${prediction.targetPrice.toFixed(2)}` : prediction.targetPrice}</span>
                </div>
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <span className="text-xs text-muted-foreground block">STOP LOSS</span>
                  <span className="text-xl font-bold text-red-500">₹{Number(prediction.stopLoss).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border">
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
                    <span className="text-sm text-muted-foreground">Buy Leg Premium:</span>
                    <span className="font-semibold text-blue-500">₹{Number(prediction.premium.buyLeg).toFixed(2)}</span>
                  </div>
                  {prediction.premium.sellLeg !== null && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Sell Leg Premium:</span>
                      <span className="font-semibold text-green-500">₹{Number(prediction.premium.sellLeg).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-border">
                    <span className="text-sm font-semibold">Net Cost:</span>
                    <span className="font-bold text-primary">₹{Number(prediction.premium.netCost).toFixed(2)}</span>
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
