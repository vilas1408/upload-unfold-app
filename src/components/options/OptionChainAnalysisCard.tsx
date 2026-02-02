import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, TrendingDown, Target, Activity } from "lucide-react";

interface OptionChainAnalysisCardProps {
  optionsFlow?: {
    pcr: number | null;
    pcrOI: number | null;
    pcrInterpretation: string;
    maxPain: number | null;
    maxPainInterpretation: string;
  };
  oiAnalysis?: {
    highestCallOI?: { strike: number; oi: number };
    highestPutOI?: { strike: number; oi: number };
    callOIChange?: number;
    putOIChange?: number;
    oiBuildupInterpretation?: string;
  };
  spotPrice?: number;
}

const OptionChainAnalysisCard = ({ optionsFlow, oiAnalysis, spotPrice }: OptionChainAnalysisCardProps) => {
  const getPCRColor = (pcr: number | null) => {
    if (!pcr) return "text-muted-foreground";
    if (pcr > 1.2) return "text-green-500";
    if (pcr < 0.8) return "text-red-500";
    return "text-yellow-500";
  };

  const getPCRSentiment = (pcr: number | null) => {
    if (!pcr) return { label: "N/A", color: "bg-muted" };
    if (pcr > 1.5) return { label: "Strong Bullish", color: "bg-green-500" };
    if (pcr > 1.2) return { label: "Bullish", color: "bg-green-500/70" };
    if (pcr < 0.6) return { label: "Strong Bearish", color: "bg-red-500" };
    if (pcr < 0.8) return { label: "Bearish", color: "bg-red-500/70" };
    return { label: "Neutral", color: "bg-yellow-500" };
  };

  const getMaxPainDistance = () => {
    if (!optionsFlow?.maxPain || !spotPrice) return null;
    const distance = ((optionsFlow.maxPain - spotPrice) / spotPrice) * 100;
    return distance;
  };

  const maxPainDistance = getMaxPainDistance();
  const pcrSentiment = getPCRSentiment(optionsFlow?.pcrOI);

  return (
    <Card className="glass-strong border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Option Chain Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* PCR Analysis */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Put-Call Ratio (PCR)
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <div className="text-xs text-muted-foreground mb-1">PCR (Open Interest)</div>
              <div className={`text-2xl font-bold ${getPCRColor(optionsFlow?.pcrOI)}`}>
                {optionsFlow?.pcrOI?.toFixed(2) || '-'}
              </div>
              <Badge className={`mt-2 ${pcrSentiment.color}`}>
                {pcrSentiment.label}
              </Badge>
            </div>
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <div className="text-xs text-muted-foreground mb-1">PCR (Volume)</div>
              <div className={`text-2xl font-bold ${getPCRColor(optionsFlow?.pcr)}`}>
                {optionsFlow?.pcr?.toFixed(2) || '-'}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Intraday sentiment
              </div>
            </div>
          </div>
          {optionsFlow?.pcrInterpretation && (
            <p className="text-sm text-muted-foreground bg-muted/20 p-3 rounded-lg">
              💡 {optionsFlow.pcrInterpretation}
            </p>
          )}
        </div>

        {/* Max Pain */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Max Pain Analysis
          </h4>
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Max Pain Strike</div>
                <div className="text-2xl font-bold text-primary">
                  ₹{optionsFlow?.maxPain?.toLocaleString('en-IN') || '-'}
                </div>
              </div>
              {maxPainDistance !== null && (
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Distance from Spot</div>
                  <div className={`text-lg font-semibold ${maxPainDistance > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {maxPainDistance > 0 ? '+' : ''}{maxPainDistance.toFixed(2)}%
                  </div>
                </div>
              )}
            </div>
            {optionsFlow?.maxPainInterpretation && (
              <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                {optionsFlow.maxPainInterpretation}
              </p>
            )}
          </div>
        </div>

        {/* Highest OI Strikes */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Key OI Levels</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-xs font-medium">Highest Call OI</span>
              </div>
              <div className="text-lg font-bold">
                ₹{oiAnalysis?.highestCallOI?.strike?.toLocaleString('en-IN') || (spotPrice ? Math.round(spotPrice * 1.02).toLocaleString('en-IN') : '-')}
              </div>
              <div className="text-xs text-muted-foreground">
                {oiAnalysis?.highestCallOI?.oi ? `${(oiAnalysis.highestCallOI.oi / 1000).toFixed(0)}K OI` : 'Resistance Zone'}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-4 w-4 text-red-500" />
                <span className="text-xs font-medium">Highest Put OI</span>
              </div>
              <div className="text-lg font-bold">
                ₹{oiAnalysis?.highestPutOI?.strike?.toLocaleString('en-IN') || (spotPrice ? Math.round(spotPrice * 0.98).toLocaleString('en-IN') : '-')}
              </div>
              <div className="text-xs text-muted-foreground">
                {oiAnalysis?.highestPutOI?.oi ? `${(oiAnalysis.highestPutOI.oi / 1000).toFixed(0)}K OI` : 'Support Zone'}
              </div>
            </div>
          </div>
        </div>

        {/* OI Buildup Interpretation */}
        {oiAnalysis?.oiBuildupInterpretation && (
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <div className="text-sm font-medium mb-1">OI Buildup Analysis</div>
            <p className="text-sm text-muted-foreground">{oiAnalysis.oiBuildupInterpretation}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OptionChainAnalysisCard;
