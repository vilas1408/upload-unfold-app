import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, TrendingDown, Minus, BarChart3, Percent, Activity } from "lucide-react";

interface MacroData {
  dxy: { value: number; change: number; trend: string };
  usTreasuryYield10Y: { value: number; change: number };
  fedFundsRate: { value: number; outlook: string };
  usdInr: { value: number; change: number; trend: string };
  vix: { value: number; level: string };
  chinaPmi: { value: number; trend: string };
  goldDemand?: string;
  oilSupply?: string;
}

interface MacroFactorsCardProps {
  macro: MacroData;
  commoditySymbol: string;
}

const MacroFactorsCard = ({ macro, commoditySymbol }: MacroFactorsCardProps) => {
  const getTrendIcon = (change: number) => {
    if (change > 0.1) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (change < -0.1) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-yellow-500" />;
  };

  const getVixColor = (value: number) => {
    if (value < 15) return 'bg-green-500/10 text-green-500 border-green-500/20';
    if (value < 20) return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    if (value < 30) return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    return 'bg-red-500/10 text-red-500 border-red-500/20';
  };

  const getCommodityImpact = (symbol: string, dxyTrend: string, vixValue: number) => {
    const isGold = symbol.includes('GOLD') || symbol.includes('SILVER');
    const isCrude = symbol.includes('CRUDE');
    
    if (isGold) {
      if (dxyTrend === 'Weakening' && vixValue > 20) {
        return { impact: 'Bullish', reason: 'Weak dollar + high volatility supportive for precious metals' };
      } else if (dxyTrend === 'Strengthening') {
        return { impact: 'Bearish', reason: 'Strong dollar reduces gold appeal' };
      }
      return { impact: 'Neutral', reason: 'Mixed macro signals for precious metals' };
    }
    
    if (isCrude) {
      if (vixValue > 25) {
        return { impact: 'Volatile', reason: 'High uncertainty may cause oil price swings' };
      }
      return { impact: 'Neutral', reason: 'Macro environment balanced for oil' };
    }
    
    return { impact: 'Neutral', reason: 'Standard macro conditions' };
  };

  const commodityImpact = getCommodityImpact(commoditySymbol, macro.dxy.trend, macro.vix.value);

  return (
    <Card className="p-6 bg-accent/50">
      <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        Macro Economic Indicators
      </h3>

      {/* Overall Impact Assessment */}
      <div className={`p-4 mb-6 rounded-lg border ${
        commodityImpact.impact === 'Bullish' ? 'bg-green-500/10 border-green-500/20' :
        commodityImpact.impact === 'Bearish' ? 'bg-red-500/10 border-red-500/20' :
        'bg-yellow-500/10 border-yellow-500/20'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold">Macro Impact on {commoditySymbol}:</span>
          <Badge variant="outline" className={
            commodityImpact.impact === 'Bullish' ? 'border-green-500 text-green-500' :
            commodityImpact.impact === 'Bearish' ? 'border-red-500 text-red-500' :
            'border-yellow-500 text-yellow-500'
          }>
            {commodityImpact.impact}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{commodityImpact.reason}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {/* US Dollar Index */}
        <div className="p-4 bg-background/50 rounded-lg border border-border">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">US Dollar Index</span>
          </div>
          <p className="text-2xl font-bold">{macro.dxy.value.toFixed(2)}</p>
          <div className="flex items-center gap-1 mt-1">
            {getTrendIcon(macro.dxy.change)}
            <span className={`text-xs ${macro.dxy.change > 0 ? 'text-green-500' : 'text-red-500'}`}>
              {macro.dxy.change > 0 ? '+' : ''}{macro.dxy.change.toFixed(2)}%
            </span>
          </div>
          <Badge variant="outline" className="mt-2 text-xs">{macro.dxy.trend}</Badge>
        </div>

        {/* US 10Y Treasury Yield */}
        <div className="p-4 bg-background/50 rounded-lg border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Percent className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">US 10Y Yield</span>
          </div>
          <p className="text-2xl font-bold">{macro.usTreasuryYield10Y.value.toFixed(2)}%</p>
          <div className="flex items-center gap-1 mt-1">
            {getTrendIcon(macro.usTreasuryYield10Y.change)}
            <span className={`text-xs ${macro.usTreasuryYield10Y.change > 0 ? 'text-red-500' : 'text-green-500'}`}>
              {macro.usTreasuryYield10Y.change > 0 ? '+' : ''}{macro.usTreasuryYield10Y.change.toFixed(2)}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {macro.usTreasuryYield10Y.value > 4.5 ? 'Elevated yields' : 'Normal range'}
          </p>
        </div>

        {/* VIX */}
        <div className={`p-4 rounded-lg border ${getVixColor(macro.vix.value)}`}>
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4" />
            <span className="text-xs opacity-80">VIX (Fear Index)</span>
          </div>
          <p className="text-2xl font-bold">{macro.vix.value.toFixed(2)}</p>
          <p className="text-xs mt-2 opacity-80">{macro.vix.level}</p>
        </div>

        {/* USD/INR */}
        <div className="p-4 bg-background/50 rounded-lg border border-border">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-muted-foreground">USD/INR</span>
          </div>
          <p className="text-2xl font-bold">₹{macro.usdInr.value.toFixed(2)}</p>
          <div className="flex items-center gap-1 mt-1">
            {getTrendIcon(macro.usdInr.change)}
            <span className={`text-xs ${macro.usdInr.change > 0 ? 'text-red-500' : 'text-green-500'}`}>
              {macro.usdInr.change > 0 ? '+' : ''}{macro.usdInr.change.toFixed(2)}%
            </span>
          </div>
          <Badge variant="outline" className="mt-2 text-xs">{macro.usdInr.trend}</Badge>
        </div>

        {/* Fed Outlook */}
        <div className="p-4 bg-background/50 rounded-lg border border-border">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-muted-foreground">Fed Funds Rate</span>
          </div>
          <p className="text-2xl font-bold">{macro.fedFundsRate.value.toFixed(2)}%</p>
          <p className="text-xs mt-2 text-muted-foreground">{macro.fedFundsRate.outlook}</p>
        </div>

        {/* China PMI */}
        <div className="p-4 bg-background/50 rounded-lg border border-border">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-muted-foreground">China PMI</span>
          </div>
          <p className={`text-2xl font-bold ${macro.chinaPmi.value >= 50 ? 'text-green-500' : 'text-red-500'}`}>
            {macro.chinaPmi.value.toFixed(1)}
          </p>
          <p className="text-xs mt-2 text-muted-foreground">{macro.chinaPmi.trend}</p>
          <Badge variant="outline" className="mt-1 text-xs">
            {macro.chinaPmi.value >= 50 ? 'Expansion' : 'Contraction'}
          </Badge>
        </div>
      </div>

      {/* Commodity-Specific Insights */}
      <div className="mt-4 grid md:grid-cols-2 gap-4">
        {macro.goldDemand && (
          <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
            <p className="text-xs text-muted-foreground mb-1">Gold/Silver Demand Assessment</p>
            <p className="text-sm font-semibold text-yellow-500">{macro.goldDemand}</p>
          </div>
        )}
        {macro.oilSupply && (
          <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
            <p className="text-xs text-muted-foreground mb-1">Oil Supply Assessment</p>
            <p className="text-sm font-semibold text-green-500">{macro.oilSupply}</p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default MacroFactorsCard;
