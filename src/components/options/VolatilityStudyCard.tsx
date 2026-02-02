import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface VolatilityStudyCardProps {
  ivAnalysis?: {
    ivRank: number;
    ivPercentile: number;
    level: string;
    strategy: string;
  };
  realPremiums?: {
    callIV?: number | null;
    putIV?: number | null;
  };
  technicalAnalysis?: {
    volatility?: {
      hv7d: number;
      hv30d: number;
      atr: number;
      atrPercent: number;
    };
  };
  spotPrice: number;
}

const VolatilityStudyCard = ({ ivAnalysis, realPremiums, technicalAnalysis, spotPrice }: VolatilityStudyCardProps) => {
  const avgIV = realPremiums?.callIV && realPremiums?.putIV 
    ? (realPremiums.callIV + realPremiums.putIV) / 2 
    : (realPremiums?.callIV || realPremiums?.putIV || 0);
  
  const hv30d = technicalAnalysis?.volatility?.hv30d || 0;
  const ivHvSpread = avgIV - hv30d;
  
  const getIVRankColor = (rank: number) => {
    if (rank > 70) return 'text-red-500';
    if (rank > 40) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getIVRankBg = (rank: number) => {
    if (rank > 70) return 'bg-red-500';
    if (rank > 40) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getIVHVInterpretation = () => {
    if (ivHvSpread > 10) return { 
      label: 'IV Premium High', 
      color: 'text-red-500',
      advice: 'Options are expensive. Consider selling strategies or wait for IV crush.'
    };
    if (ivHvSpread > 5) return { 
      label: 'IV Slightly Elevated', 
      color: 'text-yellow-500',
      advice: 'Moderate premium. Standard strategies applicable.'
    };
    if (ivHvSpread < -5) return { 
      label: 'IV Discount', 
      color: 'text-green-500',
      advice: 'Options are cheap. Good time for buying strategies.'
    };
    return { 
      label: 'IV Fair', 
      color: 'text-muted-foreground',
      advice: 'IV is aligned with realized volatility.'
    };
  };

  const ivHvInfo = getIVHVInterpretation();
  
  // Calculate expected move (1 standard deviation)
  const expectedMovePercent = avgIV / Math.sqrt(252) * Math.sqrt(technicalAnalysis?.volatility?.atr ? 5 : 7);
  const expectedMovePrice = spotPrice * (expectedMovePercent / 100);

  return (
    <Card className="glass-strong border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Volatility Study
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* IV Rank & Percentile */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Implied Volatility Rank</h4>
            <Badge className={ivAnalysis?.ivRank && ivAnalysis.ivRank > 70 ? 'bg-red-500' : ivAnalysis?.ivRank && ivAnalysis.ivRank < 30 ? 'bg-green-500' : 'bg-yellow-500'}>
              {ivAnalysis?.level || 'N/A'}
            </Badge>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">IV Rank</span>
              <span className={`font-semibold ${getIVRankColor(ivAnalysis?.ivRank || 50)}`}>
                {ivAnalysis?.ivRank || 50}%
              </span>
            </div>
            <Progress 
              value={ivAnalysis?.ivRank || 50} 
              className="h-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Low (Buy)</span>
              <span>High (Sell)</span>
            </div>
          </div>
        </div>

        {/* IV Values */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="text-xs text-muted-foreground mb-1">Call IV</div>
            <div className="text-xl font-bold text-green-500">
              {realPremiums?.callIV?.toFixed(1) || '-'}%
            </div>
          </div>
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="text-xs text-muted-foreground mb-1">Put IV</div>
            <div className="text-xl font-bold text-red-500">
              {realPremiums?.putIV?.toFixed(1) || '-'}%
            </div>
          </div>
        </div>

        {/* IV vs HV Comparison */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">IV vs Historical Volatility</h4>
          <div className="p-4 rounded-lg bg-muted/30 border border-border">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">Current IV</div>
                <div className="text-lg font-bold text-primary">{avgIV.toFixed(1)}%</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">HV (30d)</div>
                <div className="text-lg font-bold">{hv30d.toFixed(1)}%</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">Spread</div>
                <div className={`text-lg font-bold ${ivHvInfo.color}`}>
                  {ivHvSpread > 0 ? '+' : ''}{ivHvSpread.toFixed(1)}%
                </div>
              </div>
            </div>
            <div className={`text-sm p-2 rounded ${ivHvSpread > 5 ? 'bg-red-500/10' : ivHvSpread < -5 ? 'bg-green-500/10' : 'bg-muted/30'}`}>
              <div className="font-medium mb-1">{ivHvInfo.label}</div>
              <p className="text-xs text-muted-foreground">{ivHvInfo.advice}</p>
            </div>
          </div>
        </div>

        {/* Historical Volatility */}
        {technicalAnalysis?.volatility && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Historical Volatility</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <div className="text-xs text-muted-foreground mb-1">HV (7 Day)</div>
                <div className="text-lg font-bold">{technicalAnalysis.volatility.hv7d.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">Short-term volatility</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <div className="text-xs text-muted-foreground mb-1">HV (30 Day)</div>
                <div className="text-lg font-bold">{technicalAnalysis.volatility.hv30d.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">Medium-term volatility</div>
              </div>
            </div>
          </div>
        )}

        {/* Expected Range */}
        {avgIV > 0 && (
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <h4 className="text-sm font-semibold mb-3">Expected Weekly Range</h4>
            <div className="flex items-center justify-between">
              <div className="text-center">
                <div className="flex items-center gap-1 text-red-500">
                  <TrendingDown className="h-4 w-4" />
                  <span className="text-lg font-bold">
                    ₹{(spotPrice - expectedMovePrice).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">-{expectedMovePercent.toFixed(1)}%</div>
              </div>
              <div className="text-center">
                <div className="text-primary font-semibold">
                  ₹{spotPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </div>
                <div className="text-xs text-muted-foreground">Current</div>
              </div>
              <div className="text-center">
                <div className="flex items-center gap-1 text-green-500">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-lg font-bold">
                    ₹{(spotPrice + expectedMovePrice).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">+{expectedMovePercent.toFixed(1)}%</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Based on current IV, ~68% probability of staying within this range
            </p>
          </div>
        )}

        {/* Strategy Recommendation */}
        {ivAnalysis?.strategy && (
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <div className="text-sm font-medium mb-1">Volatility-Based Strategy</div>
            <p className="text-sm text-muted-foreground">{ivAnalysis.strategy}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VolatilityStudyCard;
