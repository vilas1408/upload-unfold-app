import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PieChart, TrendingUp, TrendingDown, DollarSign, BarChart3 } from "lucide-react";

interface FundamentalCardProps {
  fundamentals?: {
    sector?: string;
    sectorPeAvg?: number;
    marketCap?: number;
    marketCapCategory?: string;
    peRatio?: { value: number; sectorAvg: number; assessment: string };
    pbRatio?: { value: number; assessment: string };
    evEbitda?: number;
    roe?: number;
    revenueGrowth?: number;
    profitGrowth?: number;
    debtToEquity?: number;
    dividendYield?: number;
    eps?: { ttm: number; growth: number };
    bookValue?: number;
    fiftyTwoWeek?: { high: number; low: number; currentPosition: number };
    valuation?: string;
    fundamentalScore?: number;
    fundamentalSignal?: string;
  };
  fundamentalView?: string;
}

const FundamentalCard = ({ fundamentals, fundamentalView }: FundamentalCardProps) => {
  const getValuationBadge = (valuation?: string) => {
    if (!valuation) return null;
    const colors = {
      'Undervalued': 'bg-green-500/10 text-green-500 border-green-500/20',
      'Fair Valued': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      'Premium': 'bg-red-500/10 text-red-500 border-red-500/20',
    };
    return (
      <Badge className={colors[valuation as keyof typeof colors] || 'bg-muted'}>
        {valuation}
      </Badge>
    );
  };

  const getGrowthIcon = (value?: number) => {
    if (!value) return null;
    if (value > 0) return <TrendingUp className="h-3 w-3 text-green-500" />;
    return <TrendingDown className="h-3 w-3 text-red-500" />;
  };

  const getScoreColor = (score?: number) => {
    if (!score) return 'text-muted-foreground';
    if (score >= 70) return 'text-green-500';
    if (score >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  const formatMarketCap = (cap?: number) => {
    if (!cap) return '-';
    if (cap >= 100000) return `₹${(cap / 100000).toFixed(2)} L Cr`;
    if (cap >= 1000) return `₹${(cap / 1000).toFixed(2)} K Cr`;
    return `₹${cap} Cr`;
  };

  return (
    <Card className="glass-strong border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-primary" />
            Fundamental Analysis
          </div>
          {getValuationBadge(fundamentals?.valuation)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Fundamental View */}
        {fundamentalView && (
          <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-primary pl-3">
            {fundamentalView}
          </p>
        )}

        {/* Sector & Market Cap */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <div className="text-xs text-muted-foreground">Sector</div>
            <div className="font-semibold">{fundamentals?.sector || '-'}</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <div className="text-xs text-muted-foreground">Market Cap</div>
            <div className="font-semibold">{formatMarketCap(fundamentals?.marketCap)}</div>
            <div className="text-xs text-muted-foreground">{fundamentals?.marketCapCategory}</div>
          </div>
        </div>

        {/* Valuation Metrics */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Valuation Metrics
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <div className="text-xs text-muted-foreground">P/E Ratio</div>
              <div className="font-semibold">{fundamentals?.peRatio?.value?.toFixed(2) || '-'}</div>
              <div className="text-xs text-muted-foreground">
                Sector: {fundamentals?.peRatio?.sectorAvg}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <div className="text-xs text-muted-foreground">P/B Ratio</div>
              <div className="font-semibold">{fundamentals?.pbRatio?.value?.toFixed(2) || '-'}</div>
              <div className="text-xs text-muted-foreground">{fundamentals?.pbRatio?.assessment}</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <div className="text-xs text-muted-foreground">EV/EBITDA</div>
              <div className="font-semibold">{fundamentals?.evEbitda?.toFixed(2) || '-'}</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <div className="text-xs text-muted-foreground">EPS (TTM)</div>
              <div className="font-semibold">₹{fundamentals?.eps?.ttm?.toFixed(2) || '-'}</div>
            </div>
          </div>
        </div>

        {/* Growth & Profitability */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Growth & Profitability
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <div className="text-xs text-muted-foreground">Revenue Growth</div>
              <div className="flex items-center gap-1">
                {getGrowthIcon(fundamentals?.revenueGrowth)}
                <span className={`font-semibold ${fundamentals?.revenueGrowth && fundamentals.revenueGrowth > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {fundamentals?.revenueGrowth?.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <div className="text-xs text-muted-foreground">Profit Growth</div>
              <div className="flex items-center gap-1">
                {getGrowthIcon(fundamentals?.profitGrowth)}
                <span className={`font-semibold ${fundamentals?.profitGrowth && fundamentals.profitGrowth > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {fundamentals?.profitGrowth?.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <div className="text-xs text-muted-foreground">ROE</div>
              <div className={`font-semibold ${fundamentals?.roe && fundamentals.roe > 15 ? 'text-green-500' : 'text-muted-foreground'}`}>
                {fundamentals?.roe?.toFixed(1)}%
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <div className="text-xs text-muted-foreground">Debt/Equity</div>
              <div className={`font-semibold ${fundamentals?.debtToEquity && fundamentals.debtToEquity < 0.5 ? 'text-green-500' : 'text-muted-foreground'}`}>
                {fundamentals?.debtToEquity?.toFixed(2) || '-'}
              </div>
            </div>
          </div>
        </div>

        {/* 52-Week Range */}
        {fundamentals?.fiftyTwoWeek && (
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <div className="text-xs text-muted-foreground mb-2">52-Week Range</div>
            <div className="relative h-2 bg-muted rounded-full mb-2">
              <div 
                className="absolute h-full bg-primary rounded-full" 
                style={{ width: `${fundamentals.fiftyTwoWeek.currentPosition}%` }}
              />
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full border-2 border-background" 
                style={{ left: `${fundamentals.fiftyTwoWeek.currentPosition}%`, marginLeft: '-6px' }}
              />
            </div>
            <div className="flex justify-between text-xs">
              <span>₹{fundamentals.fiftyTwoWeek.low?.toLocaleString()}</span>
              <span className="text-primary font-medium">{fundamentals.fiftyTwoWeek.currentPosition}% from low</span>
              <span>₹{fundamentals.fiftyTwoWeek.high?.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Fundamental Score */}
        {fundamentals?.fundamentalScore !== undefined && (
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Fundamental Score</div>
                <div className={`text-2xl font-bold ${getScoreColor(fundamentals.fundamentalScore)}`}>
                  {fundamentals.fundamentalScore}/100
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">{fundamentals.fundamentalSignal}</div>
                {fundamentals.dividendYield !== undefined && fundamentals.dividendYield > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Dividend Yield: {fundamentals.dividendYield.toFixed(2)}%
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FundamentalCard;
