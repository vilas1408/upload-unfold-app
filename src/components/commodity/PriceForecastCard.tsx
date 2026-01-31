import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, TrendingUp, TrendingDown, Minus, Target } from "lucide-react";

interface TimeframeForecast {
  timeframe: string;
  period: string;
  bias: 'Bullish' | 'Bearish' | 'Neutral';
  targetPrice: number;
  supportLevel: number;
  resistanceLevel: number;
  probability: number;
  keyDrivers: string[];
}

interface PriceForecastCardProps {
  forecasts: {
    shortTerm: TimeframeForecast;
    mediumTerm: TimeframeForecast;
    longTerm: TimeframeForecast;
  };
  currentPrice: number;
}

const PriceForecastCard = ({ forecasts, currentPrice }: PriceForecastCardProps) => {
  const getBiasIcon = (bias: string) => {
    if (bias === 'Bullish') return <TrendingUp className="h-5 w-5 text-green-500" />;
    if (bias === 'Bearish') return <TrendingDown className="h-5 w-5 text-red-500" />;
    return <Minus className="h-5 w-5 text-yellow-500" />;
  };

  const getBiasColor = (bias: string) => {
    if (bias === 'Bullish') return 'bg-green-500/10 border-green-500/20';
    if (bias === 'Bearish') return 'bg-red-500/10 border-red-500/20';
    return 'bg-yellow-500/10 border-yellow-500/20';
  };

  const getBiasTextColor = (bias: string) => {
    if (bias === 'Bullish') return 'text-green-500';
    if (bias === 'Bearish') return 'text-red-500';
    return 'text-yellow-500';
  };

  const calculateChange = (target: number) => {
    return ((target - currentPrice) / currentPrice * 100).toFixed(1);
  };

  const renderForecast = (forecast: TimeframeForecast, label: string) => (
    <div className={`p-4 rounded-lg border ${getBiasColor(forecast.bias)}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <div>
            <h4 className="font-semibold">{label}</h4>
            <p className="text-xs text-muted-foreground">{forecast.period}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getBiasIcon(forecast.bias)}
          <Badge variant="outline" className={getBiasTextColor(forecast.bias)}>
            {forecast.bias}
          </Badge>
        </div>
      </div>

      <div className="space-y-3">
        {/* Target Price */}
        <div className="p-3 bg-background/50 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Target Price</span>
            <div className="text-right">
              <p className={`text-xl font-bold ${getBiasTextColor(forecast.bias)}`}>
                ₹{forecast.targetPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <p className={`text-xs ${parseFloat(calculateChange(forecast.targetPrice)) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {parseFloat(calculateChange(forecast.targetPrice)) >= 0 ? '+' : ''}{calculateChange(forecast.targetPrice)}%
              </p>
            </div>
          </div>
        </div>

        {/* Support & Resistance */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 bg-green-500/10 rounded text-center">
            <p className="text-xs text-muted-foreground">Support</p>
            <p className="text-sm font-semibold text-green-500">
              ₹{forecast.supportLevel.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="p-2 bg-red-500/10 rounded text-center">
            <p className="text-xs text-muted-foreground">Resistance</p>
            <p className="text-sm font-semibold text-red-500">
              ₹{forecast.resistanceLevel.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        {/* Probability */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Probability</span>
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${
                  forecast.probability >= 60 ? 'bg-green-500' : 
                  forecast.probability >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${forecast.probability}%` }}
              />
            </div>
            <span className="text-sm font-semibold">{forecast.probability}%</span>
          </div>
        </div>

        {/* Key Drivers */}
        <div className="pt-2 border-t border-border/50">
          <p className="text-xs text-muted-foreground mb-2">Key Drivers:</p>
          <div className="space-y-1">
            {forecast.keyDrivers.slice(0, 3).map((driver, i) => (
              <p key={i} className="text-xs flex items-start gap-1">
                <span className="text-primary">•</span>
                <span>{driver}</span>
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Card className="p-6 bg-accent/50">
      <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Target className="h-5 w-5 text-primary" />
        Multi-Timeframe Price Forecast
      </h3>

      {/* Current Price Reference */}
      <div className="text-center mb-6 p-3 bg-primary/10 rounded-lg">
        <p className="text-sm text-muted-foreground">Current Price</p>
        <p className="text-2xl font-bold text-primary">
          ₹{currentPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {renderForecast(forecasts.shortTerm, 'Short-Term')}
        {renderForecast(forecasts.mediumTerm, 'Medium-Term')}
        {renderForecast(forecasts.longTerm, 'Long-Term')}
      </div>

      {/* Forecast Summary */}
      <div className="mt-4 p-4 bg-background/50 rounded-lg border border-border">
        <h4 className="text-sm font-semibold mb-2">Forecast Alignment Summary</h4>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Short:</span>
            <Badge variant="outline" className={getBiasTextColor(forecasts.shortTerm.bias)}>
              {forecasts.shortTerm.bias}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Medium:</span>
            <Badge variant="outline" className={getBiasTextColor(forecasts.mediumTerm.bias)}>
              {forecasts.mediumTerm.bias}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Long:</span>
            <Badge variant="outline" className={getBiasTextColor(forecasts.longTerm.bias)}>
              {forecasts.longTerm.bias}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {forecasts.shortTerm.bias === forecasts.mediumTerm.bias && forecasts.mediumTerm.bias === forecasts.longTerm.bias
            ? `✅ All timeframes aligned ${forecasts.shortTerm.bias.toLowerCase()} - high conviction setup`
            : forecasts.shortTerm.bias === forecasts.mediumTerm.bias
            ? `⚠️ Short & medium term aligned, long term ${forecasts.longTerm.bias.toLowerCase()}`
            : `⚠️ Mixed signals across timeframes - exercise caution`
          }
        </p>
      </div>
    </Card>
  );
};

export default PriceForecastCard;
