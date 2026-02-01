import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Target, TrendingUp, TrendingDown, Activity } from "lucide-react";

interface TimeframeForecast {
  timeframe?: string;
  bias?: string;
  target?: number;
  targetPercent?: number;
  support?: number;
  stopLoss?: number;
  probability?: number;
  keyDrivers?: string[];
}

interface ForecastCardProps {
  forecasts?: {
    shortTerm?: TimeframeForecast;
    mediumTerm?: TimeframeForecast;
    longTerm?: TimeframeForecast;
  };
  currentPrice?: number;
}

const ForecastCard = ({ forecasts, currentPrice }: ForecastCardProps) => {
  const getBiasIcon = (bias?: string) => {
    if (bias === 'Bullish') return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (bias === 'Bearish') return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Activity className="h-4 w-4 text-yellow-500" />;
  };

  const getBiasColor = (bias?: string) => {
    if (bias === 'Bullish') return 'border-green-500/30 bg-green-500/5';
    if (bias === 'Bearish') return 'border-red-500/30 bg-red-500/5';
    return 'border-yellow-500/30 bg-yellow-500/5';
  };

  const getBiasBadge = (bias?: string) => {
    if (!bias) return null;
    const colors = {
      'Bullish': 'bg-green-500/10 text-green-500 border-green-500/20',
      'Bearish': 'bg-red-500/10 text-red-500 border-red-500/20',
      'Neutral': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    };
    return (
      <Badge className={colors[bias as keyof typeof colors] || colors.Neutral}>
        {bias}
      </Badge>
    );
  };

  const calculateChange = (target?: number) => {
    if (!target || !currentPrice) return null;
    const change = ((target - currentPrice) / currentPrice) * 100;
    return change;
  };

  const renderForecast = (forecast: TimeframeForecast | undefined, title: string, icon: React.ReactNode) => {
    if (!forecast) return null;
    
    const change = calculateChange(forecast.target);
    
    return (
      <div className={`p-4 rounded-lg border ${getBiasColor(forecast.bias)}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-semibold">{title}</span>
          </div>
          {getBiasBadge(forecast.bias)}
        </div>
        
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-muted-foreground">Target</div>
              <div className="font-semibold text-lg">₹{forecast.target?.toLocaleString() || '-'}</div>
              {change !== null && (
                <div className={`text-xs ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                </div>
              )}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Probability</div>
              <div className="font-semibold text-lg">{forecast.probability || '-'}%</div>
            </div>
          </div>

          <div className="flex gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Support: </span>
              <span className="font-medium text-green-500">₹{forecast.support?.toLocaleString() || '-'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">SL: </span>
              <span className="font-medium text-red-500">₹{forecast.stopLoss?.toLocaleString() || '-'}</span>
            </div>
          </div>

          {forecast.keyDrivers && forecast.keyDrivers.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Key Drivers:</div>
              <div className="flex flex-wrap gap-1">
                {forecast.keyDrivers.map((driver, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {driver}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="glass-strong border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Price Forecasts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {renderForecast(
          forecasts?.shortTerm, 
          forecasts?.shortTerm?.timeframe || 'Short Term (1-7 Days)',
          <Calendar className="h-4 w-4 text-primary" />
        )}
        {renderForecast(
          forecasts?.mediumTerm, 
          forecasts?.mediumTerm?.timeframe || 'Medium Term (1-3 Months)',
          <Calendar className="h-4 w-4 text-primary" />
        )}
        {renderForecast(
          forecasts?.longTerm, 
          forecasts?.longTerm?.timeframe || 'Long Term (6-12 Months)',
          <Calendar className="h-4 w-4 text-primary" />
        )}

        {(!forecasts?.shortTerm && !forecasts?.mediumTerm && !forecasts?.longTerm) && (
          <div className="text-center py-8 text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Forecast data not available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ForecastCard;
