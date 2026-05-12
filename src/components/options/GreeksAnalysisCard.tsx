import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertTriangle, TrendingUp, TrendingDown, Clock, Gauge } from "lucide-react";

interface GreeksAnalysisCardProps {
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
  optionType: 'CALL' | 'PUT';
  daysToExpiry: number;
  premium: number;
  lotSize: number;
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

const GreeksAnalysisCard = ({ 
  greeks, 
  optionType, 
  daysToExpiry, 
  premium,
  lotSize,
  greeksValidation,
  positionSizing
}: GreeksAnalysisCardProps) => {
  const getDeltaInterpretation = (delta: number, optionType: string) => {
    const absDelta = Math.abs(delta);
    if (absDelta > 0.7) return { label: 'Deep ITM', color: 'text-green-500', risk: 'Low theta decay' };
    if (absDelta > 0.5) return { label: 'ITM', color: 'text-green-400', risk: 'Moderate' };
    if (absDelta > 0.4) return { label: 'Near ATM', color: 'text-yellow-500', risk: 'Highest gamma risk' };
    if (absDelta > 0.25) return { label: 'OTM', color: 'text-orange-500', risk: 'High theta decay' };
    return { label: 'Deep OTM', color: 'text-red-500', risk: 'Very high theta decay' };
  };

  const getGammaRisk = (gamma: number) => {
    if (gamma > 0.05) return { label: 'High', color: 'text-red-500' };
    if (gamma > 0.03) return { label: 'Moderate', color: 'text-yellow-500' };
    return { label: 'Low', color: 'text-green-500' };
  };

  const getThetaImpact = (theta: number, premium: number) => {
    const dailyDecayPercent = (Math.abs(theta) / premium) * 100;
    if (dailyDecayPercent > 5) return { label: 'Critical', color: 'text-red-500', advice: 'Intraday only' };
    if (dailyDecayPercent > 2) return { label: 'High', color: 'text-orange-500', advice: 'Exit within 2-3 days' };
    if (dailyDecayPercent > 1) return { label: 'Moderate', color: 'text-yellow-500', advice: 'Monitor daily' };
    return { label: 'Low', color: 'text-green-500', advice: 'Comfortable for swing' };
  };

  const getVegaImpact = (vega: number) => {
    if (vega > 100) return { label: 'High', color: 'text-purple-500', sensitivity: 'Very IV sensitive' };
    if (vega > 50) return { label: 'Moderate', color: 'text-blue-500', sensitivity: 'Moderately IV sensitive' };
    return { label: 'Low', color: 'text-muted-foreground', sensitivity: 'Less IV sensitive' };
  };

  const num = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const safeGreeks = {
    delta: num(greeks?.delta),
    gamma: num(greeks?.gamma),
    theta: num(greeks?.theta),
    vega: num(greeks?.vega),
    rho: num(greeks?.rho),
    interpretation: greeks?.interpretation,
  };
  const deltaInfo = getDeltaInterpretation(safeGreeks.delta, optionType);
  const gammaRisk = getGammaRisk(safeGreeks.gamma);
  const thetaImpact = getThetaImpact(safeGreeks.theta, num(premium) || 1);
  const vegaImpact = getVegaImpact(safeGreeks.vega);
  const dailyThetaLoss = Math.abs(safeGreeks.theta) * num(lotSize);

  return (
    <Card className="glass-strong border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-primary" />
          Greeks Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Greeks Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Delta */}
          <div className="p-4 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Delta (Δ)</span>
              <Badge variant="outline" className={deltaInfo.color}>
                {deltaInfo.label}
              </Badge>
            </div>
            <div className="text-2xl font-bold">{greeks.delta.toFixed(3)}</div>
            <div className="mt-2 space-y-1">
              <div className="text-xs text-muted-foreground">
                {optionType === 'CALL' ? '↑' : '↓'} ₹{Math.abs(greeks.delta).toFixed(2)} per ₹1 move
              </div>
              <div className="text-xs text-muted-foreground">
                Probability ITM: ~{(Math.abs(greeks.delta) * 100).toFixed(0)}%
              </div>
            </div>
          </div>

          {/* Gamma */}
          <div className="p-4 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Gamma (Γ)</span>
              <Badge variant="outline" className={gammaRisk.color}>
                {gammaRisk.label} Risk
              </Badge>
            </div>
            <div className="text-2xl font-bold">{greeks.gamma.toFixed(4)}</div>
            <div className="mt-2 text-xs text-muted-foreground">
              Delta changes by {greeks.gamma.toFixed(4)} per ₹1 move
            </div>
          </div>

          {/* Theta */}
          <div className="p-4 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Theta (Θ)</span>
              <Badge variant="outline" className={thetaImpact.color}>
                {thetaImpact.label}
              </Badge>
            </div>
            <div className="text-2xl font-bold text-red-500">{greeks.theta.toFixed(2)}</div>
            <div className="mt-2 space-y-1">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                ₹{dailyThetaLoss.toFixed(0)} loss/day
              </div>
              <div className="text-xs text-muted-foreground">
                {thetaImpact.advice}
              </div>
            </div>
          </div>

          {/* Vega */}
          <div className="p-4 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Vega (ν)</span>
              <Badge variant="outline" className={vegaImpact.color}>
                {vegaImpact.label}
              </Badge>
            </div>
            <div className="text-2xl font-bold">{greeks.vega.toFixed(2)}</div>
            <div className="mt-2 text-xs text-muted-foreground">
              ₹{greeks.vega.toFixed(2)} per 1% IV change
            </div>
          </div>
        </div>

        {/* Greeks Interpretations */}
        {greeks.interpretation && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Interpretation</h4>
            <div className="space-y-2 text-sm">
              {greeks.interpretation.delta && (
                <div className="p-2 rounded bg-muted/20 flex items-start gap-2">
                  <TrendingUp className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <span>{greeks.interpretation.delta}</span>
                </div>
              )}
              {greeks.interpretation.theta && (
                <div className="p-2 rounded bg-muted/20 flex items-start gap-2">
                  <Clock className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                  <span>{greeks.interpretation.theta}</span>
                </div>
              )}
              {greeks.interpretation.vega && (
                <div className="p-2 rounded bg-muted/20 flex items-start gap-2">
                  <Activity className="h-4 w-4 text-purple-500 flex-shrink-0 mt-0.5" />
                  <span>{greeks.interpretation.vega}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Greeks Validation Warnings */}
        {greeksValidation && greeksValidation.warnings.length > 0 && (
          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-semibold text-yellow-500">Risk Warnings</span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
              {greeksValidation.warnings.map((warning, idx) => (
                <li key={idx} className="flex items-start gap-1">
                  <span>•</span>
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Position Sizing Recommendation */}
        {positionSizing && (
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">Position Sizing</span>
              <Badge>{positionSizing.recommendedLots} Lot{positionSizing.recommendedLots > 1 ? 's' : ''}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{positionSizing.reasoning}</p>
            <div className="mt-2 pt-2 border-t border-border flex justify-between text-sm">
              <span className="text-muted-foreground">Adjusted Investment:</span>
              <span className="font-semibold">₹{positionSizing.adjustedInvestment.toLocaleString('en-IN')}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GreeksAnalysisCard;
