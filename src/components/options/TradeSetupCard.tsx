import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, AlertTriangle, TrendingUp, TrendingDown, DollarSign, Shield } from "lucide-react";

interface TradeSetupCardProps {
  prediction: {
    strategy: string;
    optionType: 'CALL' | 'PUT' | string;
    strikePrice: number | string;
    expiryDate?: string;
    lotSize?: number;
    premium?: {
      buyLeg: number;
      targetPremium?: number;
      stopLossPremium?: number;
      netCost: number;
      description?: string;
    };
    totalInvestment?: number;
    entryPrice?: number;
    targetExitPrice?: number;
    stopLossPrice?: number;
    profitLoss?: {
      target: number;
      stopLoss: number;
      breakeven: number;
    };
    breakeven?: number | string;
    expectedReturn?: number;
    riskLevel?: string;
  };
  dataSource?: 'NSE_LIVE' | 'AI_ESTIMATED';
}

const TradeSetupCard = ({ prediction, dataSource }: TradeSetupCardProps) => {
  const getRiskColor = (risk: string | undefined) => {
    if (risk === 'Low') return 'bg-green-500';
    if (risk === 'Medium') return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const strikePrice = typeof prediction.strikePrice === 'number' 
    ? prediction.strikePrice 
    : parseFloat(prediction.strikePrice);

  const riskRewardRatio = prediction.profitLoss && typeof prediction.profitLoss.target === 'number' && typeof prediction.profitLoss.stopLoss === 'number' && prediction.profitLoss.stopLoss !== 0
    ? Math.abs(prediction.profitLoss.target / prediction.profitLoss.stopLoss).toFixed(2)
    : '1.0';

  return (
    <Card className="glass-strong border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Trade Setup
          </div>
          <Badge className={getRiskColor(prediction.riskLevel)}>
            {prediction.riskLevel || 'Medium'} Risk
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Strategy Banner */}
        <div className={`p-4 rounded-lg ${prediction.optionType === 'CALL' ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'} border`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Recommended Strategy</div>
              <div className="text-2xl font-bold">{prediction.strategy}</div>
            </div>
            <Badge className={`text-lg px-4 py-2 ${prediction.optionType === 'CALL' ? 'bg-green-500' : 'bg-red-500'}`}>
              {prediction.optionType === 'CALL' ? (
                <TrendingUp className="h-5 w-5 mr-1" />
              ) : (
                <TrendingDown className="h-5 w-5 mr-1" />
              )}
              {prediction.optionType}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-muted-foreground">Strike</div>
              <div className="font-bold">₹{strikePrice.toLocaleString('en-IN')}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Expiry</div>
              <div className="font-bold text-sm">{prediction.expiryDate || 'N/A'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Lot Size</div>
              <div className="font-bold">{prediction.lotSize || 'N/A'}</div>
            </div>
          </div>
        </div>

        {/* Premium Details */}
        {prediction.premium && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Premium Structure
              {dataSource === 'NSE_LIVE' && (
                <Badge className="bg-green-500 text-xs">LIVE</Badge>
              )}
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
                <div className="text-xs text-muted-foreground mb-1">Entry</div>
                <div className="text-xl font-bold text-primary">
                  {typeof prediction.premium.buyLeg === 'number' ? `₹${prediction.premium.buyLeg.toFixed(2)}` : '—'}
                </div>
                <div className="text-xs text-muted-foreground">per lot</div>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                <div className="text-xs text-muted-foreground mb-1">Target</div>
                <div className="text-xl font-bold text-green-500">
                  {typeof prediction.premium.buyLeg === 'number' 
                    ? `₹${(prediction.premium.targetPremium || prediction.premium.buyLeg * 1.4).toFixed(2)}`
                    : '—'}
                </div>
                <div className="text-xs text-green-500">
                  {typeof prediction.premium.buyLeg === 'number' 
                    ? `+${(((prediction.premium.targetPremium || prediction.premium.buyLeg * 1.4) - prediction.premium.buyLeg) / prediction.premium.buyLeg * 100).toFixed(0)}%`
                    : '—'}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
                <div className="text-xs text-muted-foreground mb-1">Stop Loss</div>
                <div className="text-xl font-bold text-red-500">
                  {typeof prediction.premium.buyLeg === 'number'
                    ? `₹${(prediction.premium.stopLossPremium || prediction.premium.buyLeg * 0.7).toFixed(2)}`
                    : '—'}
                </div>
                <div className="text-xs text-red-500">
                  {typeof prediction.premium.buyLeg === 'number'
                    ? `${(((prediction.premium.stopLossPremium || prediction.premium.buyLeg * 0.7) - prediction.premium.buyLeg) / prediction.premium.buyLeg * 100).toFixed(0)}%`
                    : '—'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Investment Summary */}
        <div className="p-4 rounded-lg bg-muted/30 border border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold">Total Investment</span>
            <span className="text-2xl font-bold text-primary">
              ₹{prediction.totalInvestment?.toLocaleString('en-IN') || '-'}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            ₹{prediction.premium?.buyLeg || 0} × {prediction.lotSize || 0} units
          </div>
        </div>

        {/* P&L Scenarios */}
        {prediction.profitLoss && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Profit & Loss Scenarios
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="text-xs text-muted-foreground mb-1">At Target</div>
                <div className="text-2xl font-bold text-green-500">
                  {typeof prediction.profitLoss.target === 'number' ? `+₹${Math.abs(prediction.profitLoss.target).toLocaleString('en-IN')}` : '—'}
                </div>
                <div className="text-xs text-green-500">
                  +{typeof prediction.expectedReturn === 'number' ? prediction.expectedReturn.toFixed(1) : '40'}% return
                </div>
              </div>
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="text-xs text-muted-foreground mb-1">At Stop Loss</div>
                <div className="text-2xl font-bold text-red-500">
                  {typeof prediction.profitLoss.stopLoss === 'number' ? `-₹${Math.abs(prediction.profitLoss.stopLoss).toLocaleString('en-IN')}` : '—'}
                </div>
                <div className="text-xs text-red-500">Max loss</div>
              </div>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30 border border-border">
              <div>
                <div className="text-xs text-muted-foreground">Breakeven</div>
                <div className="font-semibold">{typeof prediction.profitLoss.breakeven === 'number' ? `₹${prediction.profitLoss.breakeven.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Risk:Reward</div>
                <div className="font-semibold text-primary">1:{riskRewardRatio}</div>
              </div>
            </div>
          </div>
        )}

        {/* Warning for AI Estimated */}
        {dataSource === 'AI_ESTIMATED' && (
          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-yellow-500">Estimated Premiums:</span> NSE live data unavailable. 
              Verify actual premiums with your broker before trading.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TradeSetupCard;
