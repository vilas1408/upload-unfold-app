import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, TrendingDown, AlertCircle, Clock } from "lucide-react";

interface RecommendationCardProps {
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
  riskLevel?: string;
  riskFactors?: string[];
  confidence?: number;
  currentPrice?: number;
}

const RecommendationCard = ({ 
  recommendation, 
  riskLevel, 
  riskFactors, 
  confidence,
  currentPrice 
}: RecommendationCardProps) => {
  const getActionColor = (action?: string) => {
    if (!action) return 'bg-muted';
    if (action.includes('BUY')) return 'bg-green-500';
    if (action.includes('SELL')) return 'bg-red-500';
    return 'bg-yellow-500';
  };

  const getActionIcon = (action?: string) => {
    if (!action) return <Target className="h-6 w-6" />;
    if (action.includes('BUY')) return <TrendingUp className="h-6 w-6" />;
    if (action.includes('SELL')) return <TrendingDown className="h-6 w-6" />;
    return <Target className="h-6 w-6" />;
  };

  const getRiskBadge = (level?: string) => {
    if (!level) return null;
    const colors = {
      'Low': 'bg-green-500/10 text-green-500 border-green-500/20',
      'Medium': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      'High': 'bg-red-500/10 text-red-500 border-red-500/20',
    };
    return (
      <Badge className={colors[level as keyof typeof colors] || 'bg-muted'}>
        {level} Risk
      </Badge>
    );
  };

  const calculateChange = (price?: number) => {
    if (!price || !currentPrice) return null;
    return ((price - currentPrice) / currentPrice) * 100;
  };

  return (
    <Card className="glass-strong border-border overflow-hidden">
      {/* Action Banner */}
      <div className={`${getActionColor(recommendation?.action)} text-white p-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getActionIcon(recommendation?.action)}
            <div>
              <div className="text-2xl font-bold">{recommendation?.action || 'HOLD'}</div>
              {recommendation?.holdingPeriod && (
                <div className="text-sm opacity-90 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {recommendation.holdingPeriod}
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm opacity-90">Confidence</div>
            <div className="text-2xl font-bold">{confidence || 0}%</div>
          </div>
        </div>
      </div>

      <CardContent className="pt-4 space-y-4">
        {/* Price Targets */}
        <div className="grid grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-muted/30 border border-border text-center">
            <div className="text-xs text-muted-foreground">Entry</div>
            <div className="font-semibold">₹{recommendation?.entryPrice?.toLocaleString() || '-'}</div>
          </div>
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
            <div className="text-xs text-muted-foreground">Target 1</div>
            <div className="font-semibold text-green-500">₹{recommendation?.target1?.toLocaleString() || '-'}</div>
            {calculateChange(recommendation?.target1) !== null && (
              <div className="text-xs text-green-500">
                +{calculateChange(recommendation?.target1)?.toFixed(1)}%
              </div>
            )}
          </div>
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
            <div className="text-xs text-muted-foreground">Target 2</div>
            <div className="font-semibold text-green-500">₹{recommendation?.target2?.toLocaleString() || '-'}</div>
            {calculateChange(recommendation?.target2) !== null && (
              <div className="text-xs text-green-500">
                +{calculateChange(recommendation?.target2)?.toFixed(1)}%
              </div>
            )}
          </div>
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-center">
            <div className="text-xs text-muted-foreground">Stop Loss</div>
            <div className="font-semibold text-red-500">₹{recommendation?.stopLoss?.toLocaleString() || '-'}</div>
            {calculateChange(recommendation?.stopLoss) !== null && (
              <div className="text-xs text-red-500">
                {calculateChange(recommendation?.stopLoss)?.toFixed(1)}%
              </div>
            )}
          </div>
        </div>

        {/* Reasoning */}
        {recommendation?.reasoning && (
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <div className="text-xs text-muted-foreground mb-2">Reasoning</div>
            <p className="text-sm leading-relaxed">{recommendation.reasoning}</p>
          </div>
        )}

        {/* Risk Assessment */}
        <div className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-orange-600">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">Risk Assessment</span>
            </div>
            {getRiskBadge(riskLevel)}
          </div>
          {riskFactors && riskFactors.length > 0 && (
            <ul className="space-y-1">
              {riskFactors.map((factor, idx) => (
                <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-orange-500 mt-1">•</span>
                  <span>{factor}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RecommendationCard;
