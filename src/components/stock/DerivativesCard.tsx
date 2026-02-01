import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart2, TrendingUp, TrendingDown, Activity } from "lucide-react";

interface DerivativesCardProps {
  derivatives?: {
    isFnO: boolean;
    pcr?: number;
    pcrInterpretation?: string;
    maxPain?: number;
    maxPainDistance?: number;
    maxPainSignal?: string;
    futuresOI?: { current: number; change: number; changePercent: number; interpretation: string };
    optionsIV?: number;
    ivPercentile?: number;
    ivSignal?: string;
    callOI?: { total: number; change: number; topStrike: number };
    putOI?: { total: number; change: number; topStrike: number };
    sentiment?: string;
    lotSize?: number;
  };
  currentPrice?: number;
}

const DerivativesCard = ({ derivatives, currentPrice }: DerivativesCardProps) => {
  if (!derivatives?.isFnO) {
    return (
      <Card className="glass-strong border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-primary" />
            Derivatives Insight
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <BarChart2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>This stock is not part of F&O segment</p>
            <p className="text-sm mt-1">Derivatives data is only available for F&O stocks</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getSentimentBadge = (sentiment?: string) => {
    if (!sentiment) return null;
    const colors = {
      'Bullish': 'bg-green-500/10 text-green-500 border-green-500/20',
      'Bearish': 'bg-red-500/10 text-red-500 border-red-500/20',
      'Neutral': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    };
    return (
      <Badge className={colors[sentiment as keyof typeof colors] || colors.Neutral}>
        {sentiment}
      </Badge>
    );
  };

  const getPCRColor = (pcr?: number) => {
    if (!pcr) return 'text-muted-foreground';
    if (pcr > 1.2) return 'text-green-500';
    if (pcr < 0.8) return 'text-red-500';
    return 'text-yellow-500';
  };

  return (
    <Card className="glass-strong border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-primary" />
            Derivatives Insight
          </div>
          {getSentimentBadge(derivatives.sentiment)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* PCR */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <div className="text-xs text-muted-foreground">Put-Call Ratio</div>
            <div className={`text-xl font-bold ${getPCRColor(derivatives.pcr)}`}>
              {derivatives.pcr?.toFixed(2) || '-'}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {derivatives.pcr && derivatives.pcr > 1 ? 'Puts dominating' : 'Calls dominating'}
            </div>
          </div>

          {/* Max Pain */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <div className="text-xs text-muted-foreground">Max Pain</div>
            <div className="font-bold">₹{derivatives.maxPain?.toLocaleString() || '-'}</div>
            <div className={`text-xs ${derivatives.maxPainDistance && derivatives.maxPainDistance > 0 ? 'text-green-500' : 'text-red-500'}`}>
              {derivatives.maxPainDistance?.toFixed(2)}% away
            </div>
          </div>

          {/* Options IV */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <div className="text-xs text-muted-foreground">Options IV</div>
            <div className="font-bold">{derivatives.optionsIV?.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">
              Percentile: {derivatives.ivPercentile}%
            </div>
          </div>

          {/* Lot Size */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <div className="text-xs text-muted-foreground">Lot Size</div>
            <div className="font-bold">{derivatives.lotSize?.toLocaleString() || '-'}</div>
            {currentPrice && derivatives.lotSize && (
              <div className="text-xs text-muted-foreground">
                ≈ ₹{((currentPrice * derivatives.lotSize) / 100000).toFixed(1)} L
              </div>
            )}
          </div>
        </div>

        {/* Interpretations */}
        <div className="space-y-2">
          {derivatives.pcrInterpretation && (
            <div className="p-2 rounded bg-muted/30 text-sm flex items-center gap-2">
              {derivatives.pcr && derivatives.pcr > 1 ? (
                <TrendingUp className="h-4 w-4 text-green-500 flex-shrink-0" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500 flex-shrink-0" />
              )}
              <span>{derivatives.pcrInterpretation}</span>
            </div>
          )}
          {derivatives.maxPainSignal && (
            <div className="p-2 rounded bg-muted/30 text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary flex-shrink-0" />
              <span>{derivatives.maxPainSignal}</span>
            </div>
          )}
          {derivatives.ivSignal && (
            <div className="p-2 rounded bg-muted/30 text-sm flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-primary flex-shrink-0" />
              <span>{derivatives.ivSignal}</span>
            </div>
          )}
        </div>

        {/* Futures OI */}
        {derivatives.futuresOI && (
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <div className="text-xs text-muted-foreground mb-2">Futures Open Interest</div>
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold">OI Change: </span>
                <span className={derivatives.futuresOI.changePercent > 0 ? 'text-green-500' : 'text-red-500'}>
                  {derivatives.futuresOI.changePercent > 0 ? '+' : ''}{derivatives.futuresOI.changePercent.toFixed(2)}%
                </span>
              </div>
              <Badge variant="outline">{derivatives.futuresOI.interpretation}</Badge>
            </div>
          </div>
        )}

        {/* Call/Put OI Breakdown */}
        <div className="grid grid-cols-2 gap-3">
          {derivatives.callOI && (
            <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
              <div className="text-xs text-muted-foreground">Call OI</div>
              <div className="font-semibold text-green-500">
                {derivatives.callOI.total?.toLocaleString()}
              </div>
              <div className="text-xs">
                Top Strike: ₹{derivatives.callOI.topStrike?.toLocaleString()}
              </div>
            </div>
          )}
          {derivatives.putOI && (
            <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
              <div className="text-xs text-muted-foreground">Put OI</div>
              <div className="font-semibold text-red-500">
                {derivatives.putOI.total?.toLocaleString()}
              </div>
              <div className="text-xs">
                Top Strike: ₹{derivatives.putOI.topStrike?.toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DerivativesCard;
