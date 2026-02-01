import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Activity, DollarSign, BarChart3, Globe } from "lucide-react";

interface MarketContextCardProps {
  marketContext?: {
    nifty?: { level: number; change: number; changePercent: number; trend: string };
    bankNifty?: { level: number; change: number; changePercent: number; trend: string };
    sensex?: { level: number; change: number; changePercent: number };
    indiaVix?: { value: number; level: string; interpretation: string };
    fiiDii?: { fii: number; dii: number; interpretation: string };
    usdInr?: { rate: number; change: number; trend: string };
    crude?: { price: number; change: number; impact: string };
    overallSentiment?: string;
  };
  marketContextSummary?: string;
}

const MarketContextCard = ({ marketContext, marketContextSummary }: MarketContextCardProps) => {
  const getTrendIcon = (changePercent: number) => {
    if (changePercent > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (changePercent < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Activity className="h-4 w-4 text-yellow-500" />;
  };

  const getChangeColor = (changePercent: number) => {
    if (changePercent > 0) return "text-green-500";
    if (changePercent < 0) return "text-red-500";
    return "text-muted-foreground";
  };

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

  return (
    <Card className="glass-strong border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Market Context
          </div>
          {marketContext?.overallSentiment && getSentimentBadge(marketContext.overallSentiment)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        {marketContextSummary && (
          <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-primary pl-3">
            {marketContextSummary}
          </p>
        )}

        {/* Key Indices */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Nifty 50 */}
          {marketContext?.nifty && (
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                <BarChart3 className="h-3 w-3" />
                Nifty 50
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{marketContext.nifty.level.toLocaleString()}</span>
                {getTrendIcon(marketContext.nifty.changePercent)}
              </div>
              <span className={`text-xs ${getChangeColor(marketContext.nifty.changePercent)}`}>
                {marketContext.nifty.changePercent > 0 ? '+' : ''}{marketContext.nifty.changePercent.toFixed(2)}%
              </span>
            </div>
          )}

          {/* Bank Nifty */}
          {marketContext?.bankNifty && (
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                <BarChart3 className="h-3 w-3" />
                Bank Nifty
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{marketContext.bankNifty.level.toLocaleString()}</span>
                {getTrendIcon(marketContext.bankNifty.changePercent)}
              </div>
              <span className={`text-xs ${getChangeColor(marketContext.bankNifty.changePercent)}`}>
                {marketContext.bankNifty.changePercent > 0 ? '+' : ''}{marketContext.bankNifty.changePercent.toFixed(2)}%
              </span>
            </div>
          )}

          {/* India VIX */}
          {marketContext?.indiaVix && (
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                <Activity className="h-3 w-3" />
                India VIX
              </div>
              <div className="font-semibold">{marketContext.indiaVix.value.toFixed(2)}</div>
              <span className="text-xs text-muted-foreground">{marketContext.indiaVix.level}</span>
            </div>
          )}

          {/* USD/INR */}
          {marketContext?.usdInr && (
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                <DollarSign className="h-3 w-3" />
                USD/INR
              </div>
              <div className="font-semibold">₹{marketContext.usdInr.rate.toFixed(2)}</div>
              <span className="text-xs text-muted-foreground">{marketContext.usdInr.trend}</span>
            </div>
          )}
        </div>

        {/* FII/DII Flows */}
        {marketContext?.fiiDii && (
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <div className="text-xs text-muted-foreground mb-2">Institutional Activity</div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm">FII:</span>
                <span className={`font-semibold ${marketContext.fiiDii.fii > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {marketContext.fiiDii.fii > 0 ? '+' : ''}₹{marketContext.fiiDii.fii.toLocaleString()} Cr
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">DII:</span>
                <span className={`font-semibold ${marketContext.fiiDii.dii > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {marketContext.fiiDii.dii > 0 ? '+' : ''}₹{marketContext.fiiDii.dii.toLocaleString()} Cr
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{marketContext.fiiDii.interpretation}</p>
          </div>
        )}

        {/* Crude Oil */}
        {marketContext?.crude && (
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Crude Oil (WTI)</div>
                <div className="font-semibold">${marketContext.crude.price.toFixed(2)}</div>
              </div>
              <div className="text-right">
                <span className={`text-sm ${getChangeColor(marketContext.crude.change)}`}>
                  {marketContext.crude.change > 0 ? '+' : ''}{marketContext.crude.change.toFixed(2)}%
                </span>
                <div className="text-xs text-muted-foreground">{marketContext.crude.impact}</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MarketContextCard;
