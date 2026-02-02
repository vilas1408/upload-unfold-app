import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Activity, BarChart3 } from "lucide-react";

interface TechnicalUnderlyingCardProps {
  technicalAnalysis?: {
    macd?: number;
    macdTrend?: string;
    bollingerBands?: {
      upper: number;
      lower: number;
      position: string;
      signal: string;
    };
    volume?: {
      ratio: number;
      signal: string;
    };
    volatility?: {
      hv7d: number;
      hv30d: number;
      atr: number;
      atrPercent: number;
    };
    supportResistance?: {
      support: number;
      resistance: number;
    };
  };
  analysis?: {
    current: number;
    rsi: number;
    sma20: number;
    trend: string;
    trendScore: number;
  };
  pivotPoints?: {
    pivot: number;
    r1: number;
    r2: number;
    r3: number;
    s1: number;
    s2: number;
    s3: number;
    interpretation: string;
  };
  fibonacciLevels?: { [key: string]: number };
}

const TechnicalUnderlyingCard = ({ technicalAnalysis, analysis, pivotPoints, fibonacciLevels }: TechnicalUnderlyingCardProps) => {
  const getTrendColor = (trend: string) => {
    if (trend?.toLowerCase().includes('bullish')) return 'text-green-500';
    if (trend?.toLowerCase().includes('bearish')) return 'text-red-500';
    return 'text-yellow-500';
  };

  const getTrendBg = (trend: string) => {
    if (trend?.toLowerCase().includes('bullish')) return 'bg-green-500';
    if (trend?.toLowerCase().includes('bearish')) return 'bg-red-500';
    return 'bg-yellow-500';
  };

  const getRSIColor = (rsi: number) => {
    if (rsi > 70) return 'text-red-500';
    if (rsi < 30) return 'text-green-500';
    return 'text-yellow-500';
  };

  const getRSILabel = (rsi: number) => {
    if (rsi > 70) return 'Overbought';
    if (rsi < 30) return 'Oversold';
    return 'Neutral';
  };

  return (
    <Card className="glass-strong border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Technical Analysis
          </div>
          {analysis?.trend && (
            <Badge className={getTrendBg(analysis.trend)}>
              {analysis.trend}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Price & RSI */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-muted/30 border border-border">
            <div className="text-xs text-muted-foreground mb-1">Current Price</div>
            <div className="text-2xl font-bold text-primary">
              ₹{analysis?.current?.toLocaleString('en-IN', { maximumFractionDigits: 2 }) || '-'}
            </div>
            {analysis?.sma20 && (
              <div className="text-xs text-muted-foreground mt-1">
                {analysis.current > analysis.sma20 ? 'Above' : 'Below'} 20 SMA (₹{analysis.sma20.toFixed(2)})
              </div>
            )}
          </div>
          <div className="p-4 rounded-lg bg-muted/30 border border-border">
            <div className="text-xs text-muted-foreground mb-1">RSI (14)</div>
            <div className={`text-2xl font-bold ${getRSIColor(analysis?.rsi || 50)}`}>
              {analysis?.rsi?.toFixed(1) || '-'}
            </div>
            <Badge variant="outline" className={`mt-1 ${getRSIColor(analysis?.rsi || 50)}`}>
              {getRSILabel(analysis?.rsi || 50)}
            </Badge>
          </div>
        </div>

        {/* MACD & Bollinger */}
        {technicalAnalysis && (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <div className="text-xs text-muted-foreground mb-1">MACD Trend</div>
              <div className="flex items-center gap-2">
                {technicalAnalysis.macdTrend?.toLowerCase().includes('bullish') ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : technicalAnalysis.macdTrend?.toLowerCase().includes('bearish') ? (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                ) : (
                  <Activity className="h-4 w-4 text-yellow-500" />
                )}
                <span className={`font-semibold ${getTrendColor(technicalAnalysis.macdTrend || '')}`}>
                  {technicalAnalysis.macdTrend || 'N/A'}
                </span>
              </div>
            </div>
            {technicalAnalysis.bollingerBands && (
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <div className="text-xs text-muted-foreground mb-1">Bollinger Position</div>
                <div className="font-semibold">{technicalAnalysis.bollingerBands.signal}</div>
                <div className="text-xs text-muted-foreground">
                  {technicalAnalysis.bollingerBands.position}% from mean
                </div>
              </div>
            )}
          </div>
        )}

        {/* Volume & ATR */}
        {technicalAnalysis && (
          <div className="grid grid-cols-2 gap-4">
            {technicalAnalysis.volume && (
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <div className="text-xs text-muted-foreground mb-1">Volume</div>
                <div className="font-semibold">{technicalAnalysis.volume.ratio.toFixed(2)}x avg</div>
                <Badge variant="outline" className="mt-1 text-xs">
                  {technicalAnalysis.volume.signal}
                </Badge>
              </div>
            )}
            {technicalAnalysis.volatility && (
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <div className="text-xs text-muted-foreground mb-1">ATR (14)</div>
                <div className="font-semibold">₹{technicalAnalysis.volatility.atr.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">
                  {technicalAnalysis.volatility.atrPercent.toFixed(2)}% of price
                </div>
              </div>
            )}
          </div>
        )}

        {/* Support & Resistance */}
        {technicalAnalysis?.supportResistance && (
          <div className="p-4 rounded-lg bg-muted/30 border border-border">
            <h4 className="text-sm font-semibold mb-3">Key Levels</h4>
            <div className="flex justify-between items-center">
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Support</div>
                <div className="text-lg font-bold text-green-500">
                  ₹{technicalAnalysis.supportResistance.support.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Current</div>
                <div className="text-lg font-bold text-primary">
                  ₹{analysis?.current?.toLocaleString('en-IN', { maximumFractionDigits: 2 }) || '-'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Resistance</div>
                <div className="text-lg font-bold text-red-500">
                  ₹{technicalAnalysis.supportResistance.resistance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pivot Points */}
        {pivotPoints && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Pivot Points</h4>
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              <div className="p-2 bg-green-500/10 rounded">
                <div className="text-muted-foreground">R3</div>
                <div className="font-semibold text-green-500">₹{pivotPoints.r3.toFixed(0)}</div>
              </div>
              <div className="p-2 bg-green-500/10 rounded">
                <div className="text-muted-foreground">R2</div>
                <div className="font-semibold text-green-500">₹{pivotPoints.r2.toFixed(0)}</div>
              </div>
              <div className="p-2 bg-green-500/10 rounded">
                <div className="text-muted-foreground">R1</div>
                <div className="font-semibold text-green-500">₹{pivotPoints.r1.toFixed(0)}</div>
              </div>
              <div className="p-2 bg-primary/10 rounded">
                <div className="text-muted-foreground">PP</div>
                <div className="font-semibold text-primary">₹{pivotPoints.pivot.toFixed(0)}</div>
              </div>
              <div className="p-2 bg-red-500/10 rounded">
                <div className="text-muted-foreground">S1</div>
                <div className="font-semibold text-red-500">₹{pivotPoints.s1.toFixed(0)}</div>
              </div>
              <div className="p-2 bg-red-500/10 rounded">
                <div className="text-muted-foreground">S2</div>
                <div className="font-semibold text-red-500">₹{pivotPoints.s2.toFixed(0)}</div>
              </div>
              <div className="p-2 bg-red-500/10 rounded">
                <div className="text-muted-foreground">S3</div>
                <div className="font-semibold text-red-500">₹{pivotPoints.s3.toFixed(0)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Fibonacci Levels */}
        {fibonacciLevels && Object.keys(fibonacciLevels).length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Fibonacci Retracement</h4>
            <div className="grid grid-cols-4 gap-2">
              {['23.6%', '38.2%', '50%', '61.8%'].map((level) => (
                <div key={level} className={`p-2 rounded text-center ${level === '50%' ? 'bg-primary/10' : 'bg-muted/30'}`}>
                  <div className="text-xs text-muted-foreground">{level}</div>
                  <div className="font-semibold text-sm">
                    ₹{fibonacciLevels[level]?.toFixed(0) || '-'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trend Score */}
        {analysis?.trendScore !== undefined && (
          <div className="p-3 rounded-lg bg-muted/30 border border-border flex justify-between items-center">
            <span className="text-sm font-medium">Overall Technical Score</span>
            <Badge className={analysis.trendScore > 5 ? 'bg-green-500' : analysis.trendScore < -5 ? 'bg-red-500' : 'bg-yellow-500'}>
              {analysis.trendScore}/10
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TechnicalUnderlyingCard;
