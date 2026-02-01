import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, TrendingUp, TrendingDown, BarChart2 } from "lucide-react";

interface TechnicalAnalysisCardProps {
  technicals?: {
    trend?: string;
    trendStrength?: string;
    rsi?: number;
    rsiSignal?: string;
    sma20?: number;
    sma50?: number;
    sma100?: number;
    sma200?: number;
    ema12?: number;
    ema26?: number;
    macd?: { value: number; signal: number; histogram: number; status: string };
    adx?: number;
    adxInterpretation?: string;
    stochastic?: { k: number; d: number; signal: string };
    bollingerBands?: { upper: number; middle: number; lower: number; position: string };
    atr?: number;
    volumeRatio?: string;
    volumeSignal?: string;
    pivotPoints?: { pivot: number; r1: number; r2: number; s1: number; s2: number };
    fibonacci?: { fib38: number; fib50: number; fib61: number };
    currentPrice?: number;
  };
  technicalOutlook?: string;
}

const TechnicalAnalysisCard = ({ technicals, technicalOutlook }: TechnicalAnalysisCardProps) => {
  const getTrendColor = (trend?: string) => {
    if (trend === 'Bullish') return 'text-green-500';
    if (trend === 'Bearish') return 'text-red-500';
    return 'text-yellow-500';
  };

  const getRSIColor = (rsi?: number) => {
    if (!rsi) return 'text-muted-foreground';
    if (rsi > 70) return 'text-red-500';
    if (rsi < 30) return 'text-green-500';
    return 'text-muted-foreground';
  };

  const getIndicatorBadge = (status: string) => {
    if (status.toLowerCase().includes('bullish') || status.toLowerCase().includes('strong momentum')) {
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">{status}</Badge>;
    }
    if (status.toLowerCase().includes('bearish') || status.toLowerCase().includes('weak')) {
      return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">{status}</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <Card className="glass-strong border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Technical Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Trend Overview */}
        <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 border border-border">
          <div className="flex items-center gap-2">
            {technicals?.trend === 'Bullish' ? (
              <TrendingUp className="h-5 w-5 text-green-500" />
            ) : technicals?.trend === 'Bearish' ? (
              <TrendingDown className="h-5 w-5 text-red-500" />
            ) : (
              <Activity className="h-5 w-5 text-yellow-500" />
            )}
            <span className={`font-semibold ${getTrendColor(technicals?.trend)}`}>
              {technicals?.trend || 'Neutral'} Trend
            </span>
          </div>
          <Badge variant="outline">{technicals?.trendStrength || 'Moderate'}</Badge>
        </div>

        {/* Technical Outlook */}
        {technicalOutlook && (
          <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-primary pl-3">
            {technicalOutlook}
          </p>
        )}

        {/* Momentum Indicators */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <BarChart2 className="h-4 w-4" />
            Momentum Indicators
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* RSI */}
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <div className="text-xs text-muted-foreground">RSI (14)</div>
              <div className={`font-semibold text-lg ${getRSIColor(technicals?.rsi)}`}>
                {technicals?.rsi || '-'}
              </div>
              <div className="text-xs text-muted-foreground">{technicals?.rsiSignal}</div>
            </div>

            {/* MACD */}
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <div className="text-xs text-muted-foreground">MACD</div>
              <div className="font-semibold">{technicals?.macd?.value?.toFixed(2) || '-'}</div>
              <div className="text-xs">
                {technicals?.macd?.status && getIndicatorBadge(technicals.macd.status)}
              </div>
            </div>

            {/* ADX */}
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <div className="text-xs text-muted-foreground">ADX</div>
              <div className="font-semibold">{technicals?.adx || '-'}</div>
              <div className="text-xs text-muted-foreground">{technicals?.adxInterpretation}</div>
            </div>

            {/* Stochastic */}
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <div className="text-xs text-muted-foreground">Stochastic</div>
              <div className="font-semibold">
                %K: {technicals?.stochastic?.k || '-'} / %D: {technicals?.stochastic?.d || '-'}
              </div>
              <div className="text-xs text-muted-foreground">{technicals?.stochastic?.signal}</div>
            </div>
          </div>
        </div>

        {/* Moving Averages */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Moving Averages</h4>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            <div className="p-2 rounded bg-muted/30 text-center">
              <div className="text-xs text-muted-foreground">20 DMA</div>
              <div className={`text-sm font-medium ${technicals?.currentPrice && technicals?.sma20 && technicals.currentPrice > technicals.sma20 ? 'text-green-500' : 'text-red-500'}`}>
                ₹{technicals?.sma20?.toLocaleString() || '-'}
              </div>
            </div>
            <div className="p-2 rounded bg-muted/30 text-center">
              <div className="text-xs text-muted-foreground">50 DMA</div>
              <div className={`text-sm font-medium ${technicals?.currentPrice && technicals?.sma50 && technicals.currentPrice > technicals.sma50 ? 'text-green-500' : 'text-red-500'}`}>
                ₹{technicals?.sma50?.toLocaleString() || '-'}
              </div>
            </div>
            <div className="p-2 rounded bg-muted/30 text-center">
              <div className="text-xs text-muted-foreground">100 DMA</div>
              <div className={`text-sm font-medium ${technicals?.currentPrice && technicals?.sma100 && technicals.currentPrice > technicals.sma100 ? 'text-green-500' : 'text-red-500'}`}>
                ₹{technicals?.sma100?.toLocaleString() || '-'}
              </div>
            </div>
            <div className="p-2 rounded bg-muted/30 text-center">
              <div className="text-xs text-muted-foreground">200 DMA</div>
              <div className={`text-sm font-medium ${technicals?.currentPrice && technicals?.sma200 && technicals.currentPrice > technicals.sma200 ? 'text-green-500' : 'text-red-500'}`}>
                ₹{technicals?.sma200?.toLocaleString() || '-'}
              </div>
            </div>
            <div className="p-2 rounded bg-muted/30 text-center">
              <div className="text-xs text-muted-foreground">EMA 12</div>
              <div className="text-sm font-medium">₹{technicals?.ema12?.toLocaleString() || '-'}</div>
            </div>
            <div className="p-2 rounded bg-muted/30 text-center">
              <div className="text-xs text-muted-foreground">EMA 26</div>
              <div className="text-sm font-medium">₹{technicals?.ema26?.toLocaleString() || '-'}</div>
            </div>
          </div>
        </div>

        {/* Bollinger Bands & Volume */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <div className="text-xs text-muted-foreground mb-2">Bollinger Bands</div>
            <div className="flex items-center justify-between text-sm">
              <span>Upper: ₹{technicals?.bollingerBands?.upper?.toLocaleString()}</span>
              <span>Lower: ₹{technicals?.bollingerBands?.lower?.toLocaleString()}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">{technicals?.bollingerBands?.position}</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <div className="text-xs text-muted-foreground mb-2">Volume Analysis</div>
            <div className="font-semibold">{technicals?.volumeRatio}x Avg</div>
            <div className="text-xs text-muted-foreground">{technicals?.volumeSignal}</div>
          </div>
        </div>

        {/* Support & Resistance */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Key Levels</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
              <div className="text-xs text-muted-foreground mb-2">Resistance</div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>R1:</span>
                  <span className="font-medium text-green-500">₹{technicals?.pivotPoints?.r1?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>R2:</span>
                  <span className="font-medium text-green-500">₹{technicals?.pivotPoints?.r2?.toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
              <div className="text-xs text-muted-foreground mb-2">Support</div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>S1:</span>
                  <span className="font-medium text-red-500">₹{technicals?.pivotPoints?.s1?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>S2:</span>
                  <span className="font-medium text-red-500">₹{technicals?.pivotPoints?.s2?.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fibonacci Levels */}
        {technicals?.fibonacci && (
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <div className="text-xs text-muted-foreground mb-2">Fibonacci Retracements</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-xs text-muted-foreground">38.2%</div>
                <div className="text-sm font-medium">₹{technicals.fibonacci.fib38?.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">50%</div>
                <div className="text-sm font-medium">₹{technicals.fibonacci.fib50?.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">61.8%</div>
                <div className="text-sm font-medium">₹{technicals.fibonacci.fib61?.toLocaleString()}</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TechnicalAnalysisCard;
