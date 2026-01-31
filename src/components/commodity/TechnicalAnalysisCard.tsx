import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";

interface TechnicalData {
  trend: string;
  trendStrength: string;
  rsi: number;
  macd: { value: number; signal: number; histogram: number };
  stochastic: { k: number; d: number };
  adx: number;
  atr: number;
  movingAverages: {
    sma20: number;
    sma50: number;
    sma100: number;
    sma200: number;
    ema12: number;
    ema26: number;
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  };
  fibonacci: {
    levels: { ratio: number; price: number }[];
  };
  supportResistance: {
    supports: number[];
    resistances: number[];
  };
  patterns: string[];
  spotPrice: number;
}

interface TechnicalAnalysisCardProps {
  technicals: TechnicalData;
}

const TechnicalAnalysisCard = ({ technicals }: TechnicalAnalysisCardProps) => {
  const getTrendIcon = () => {
    if (technicals.trend === 'Bullish') return <TrendingUp className="h-5 w-5 text-green-500" />;
    if (technicals.trend === 'Bearish') return <TrendingDown className="h-5 w-5 text-red-500" />;
    return <Minus className="h-5 w-5 text-yellow-500" />;
  };

  const getTrendColor = () => {
    if (technicals.trend === 'Bullish') return 'text-green-500';
    if (technicals.trend === 'Bearish') return 'text-red-500';
    return 'text-yellow-500';
  };

  const getRsiColor = (rsi: number) => {
    if (rsi >= 70) return 'text-red-500';
    if (rsi <= 30) return 'text-green-500';
    return 'text-foreground';
  };

  const getRsiLabel = (rsi: number) => {
    if (rsi >= 70) return 'Overbought';
    if (rsi <= 30) return 'Oversold';
    return 'Neutral';
  };

  return (
    <Card className="p-6 bg-accent/50">
      <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Activity className="h-5 w-5 text-primary" />
        Technical Analysis
      </h3>

      {/* Trend Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-3 bg-background/50 rounded-lg border border-border">
          <p className="text-xs text-muted-foreground mb-1">Trend</p>
          <div className="flex items-center gap-2">
            {getTrendIcon()}
            <span className={`font-bold ${getTrendColor()}`}>{technicals.trend}</span>
          </div>
        </div>
        <div className="p-3 bg-background/50 rounded-lg border border-border">
          <p className="text-xs text-muted-foreground mb-1">Trend Strength</p>
          <p className="font-semibold">{technicals.trendStrength}</p>
          <p className="text-xs text-muted-foreground">ADX: {technicals.adx.toFixed(1)}</p>
        </div>
        <div className="p-3 bg-background/50 rounded-lg border border-border">
          <p className="text-xs text-muted-foreground mb-1">RSI (14)</p>
          <p className={`font-bold text-lg ${getRsiColor(technicals.rsi)}`}>
            {technicals.rsi.toFixed(1)}
          </p>
          <Badge variant="outline" className="text-xs mt-1">
            {getRsiLabel(technicals.rsi)}
          </Badge>
        </div>
        <div className="p-3 bg-background/50 rounded-lg border border-border">
          <p className="text-xs text-muted-foreground mb-1">ATR</p>
          <p className="font-semibold">₹{technicals.atr.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">Daily volatility</p>
        </div>
      </div>

      {/* Momentum Indicators */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Momentum Indicators</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="p-3 bg-background/50 rounded-lg border border-border">
            <p className="text-xs text-muted-foreground mb-1">MACD</p>
            <p className={`font-bold ${technicals.macd.histogram > 0 ? 'text-green-500' : 'text-red-500'}`}>
              {technicals.macd.value.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">
              Signal: {technicals.macd.signal.toFixed(2)}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-xs">Histogram:</span>
              <span className={`text-xs font-semibold ${technicals.macd.histogram > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {technicals.macd.histogram > 0 ? '+' : ''}{technicals.macd.histogram.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="p-3 bg-background/50 rounded-lg border border-border">
            <p className="text-xs text-muted-foreground mb-1">Stochastic</p>
            <p className="font-semibold">
              %K: {technicals.stochastic.k.toFixed(1)} / %D: {technicals.stochastic.d.toFixed(1)}
            </p>
            <Badge variant="outline" className="text-xs mt-1">
              {technicals.stochastic.k > 80 ? 'Overbought' : 
               technicals.stochastic.k < 20 ? 'Oversold' : 'Neutral'}
            </Badge>
          </div>
          <div className="p-3 bg-background/50 rounded-lg border border-border">
            <p className="text-xs text-muted-foreground mb-1">ADX Trend</p>
            <p className="font-semibold">{technicals.adx.toFixed(1)}</p>
            <Badge variant="outline" className="text-xs mt-1">
              {technicals.adx > 25 ? 'Strong Trend' : 
               technicals.adx > 20 ? 'Developing' : 'Weak/No Trend'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Moving Averages */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Moving Averages</h4>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {[
            { label: 'SMA 20', value: technicals.movingAverages.sma20 },
            { label: 'SMA 50', value: technicals.movingAverages.sma50 },
            { label: 'SMA 100', value: technicals.movingAverages.sma100 },
            { label: 'SMA 200', value: technicals.movingAverages.sma200 },
            { label: 'EMA 12', value: technicals.movingAverages.ema12 },
            { label: 'EMA 26', value: technicals.movingAverages.ema26 },
          ].map((ma) => (
            <div key={ma.label} className="p-2 bg-background/50 rounded border border-border text-center">
              <p className="text-xs text-muted-foreground">{ma.label}</p>
              <p className={`text-sm font-semibold ${technicals.spotPrice > ma.value ? 'text-green-500' : 'text-red-500'}`}>
                ₹{ma.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {technicals.spotPrice > technicals.movingAverages.sma200 
            ? '✅ Price above all major MAs - Bullish structure' 
            : technicals.spotPrice < technicals.movingAverages.sma200
            ? '⚠️ Price below 200 SMA - Bearish structure'
            : 'Price testing key moving averages'}
        </p>
      </div>

      {/* Bollinger Bands */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Bollinger Bands (20, 2)</h4>
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20 text-center">
            <p className="text-xs text-muted-foreground">Upper Band</p>
            <p className="font-semibold text-red-400">
              ₹{technicals.bollingerBands.upper.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="p-3 bg-primary/10 rounded-lg border border-primary/20 text-center">
            <p className="text-xs text-muted-foreground">Middle (SMA 20)</p>
            <p className="font-semibold text-primary">
              ₹{technicals.bollingerBands.middle.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20 text-center">
            <p className="text-xs text-muted-foreground">Lower Band</p>
            <p className="font-semibold text-green-400">
              ₹{technicals.bollingerBands.lower.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      </div>

      {/* Fibonacci Levels */}
      {technicals.fibonacci.levels.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Fibonacci Retracement Levels</h4>
          <div className="flex flex-wrap gap-2">
            {technicals.fibonacci.levels.map((level) => (
              <Badge 
                key={level.ratio} 
                variant="outline" 
                className={`${technicals.spotPrice < level.price ? 'border-red-500/50' : 'border-green-500/50'}`}
              >
                {(level.ratio * 100).toFixed(1)}%: ₹{level.price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Support & Resistance */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Key Support & Resistance</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
            <p className="text-xs text-muted-foreground mb-2">Support Levels</p>
            <div className="space-y-1">
              {technicals.supportResistance.supports.slice(0, 3).map((level, i) => (
                <p key={i} className="text-sm font-semibold text-green-400">
                  S{i + 1}: ₹{level.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
              ))}
            </div>
          </div>
          <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
            <p className="text-xs text-muted-foreground mb-2">Resistance Levels</p>
            <div className="space-y-1">
              {technicals.supportResistance.resistances.slice(0, 3).map((level, i) => (
                <p key={i} className="text-sm font-semibold text-red-400">
                  R{i + 1}: ₹{level.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Chart Patterns */}
      {technicals.patterns.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Detected Chart Patterns</h4>
          <div className="flex flex-wrap gap-2">
            {technicals.patterns.map((pattern, i) => (
              <Badge key={i} variant="secondary">
                {pattern}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

export default TechnicalAnalysisCard;
