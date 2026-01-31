import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Factory, Users, Globe, Cloud, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface FundamentalsData {
  inventory: {
    level: string;
    change: number;
    trend: string;
    details: string;
  };
  production: {
    outlook: string;
    factors: string[];
  };
  consumption: {
    outlook: string;
    factors: string[];
  };
  geopolitical: {
    risk: 'Low' | 'Medium' | 'High';
    factors: string[];
  };
  weather: {
    impact: string;
    details: string;
  };
  supplyDemandBalance: 'Surplus' | 'Deficit' | 'Balanced';
  priceDrivers: string[];
}

interface FundamentalAnalysisCardProps {
  fundamentals: FundamentalsData;
  commodityName: string;
}

const FundamentalAnalysisCard = ({ fundamentals, commodityName }: FundamentalAnalysisCardProps) => {
  const getBalanceColor = (balance: string) => {
    if (balance === 'Deficit') return 'bg-green-500/10 text-green-500 border-green-500/20';
    if (balance === 'Surplus') return 'bg-red-500/10 text-red-500 border-red-500/20';
    return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
  };

  const getBalanceIcon = (balance: string) => {
    if (balance === 'Deficit') return <TrendingUp className="h-4 w-4" />;
    if (balance === 'Surplus') return <TrendingDown className="h-4 w-4" />;
    return <Minus className="h-4 w-4" />;
  };

  const getBalanceDescription = (balance: string) => {
    if (balance === 'Deficit') return 'Supply deficit is bullish for prices';
    if (balance === 'Surplus') return 'Supply surplus is bearish for prices';
    return 'Market in equilibrium';
  };

  const getRiskColor = (risk: string) => {
    if (risk === 'High') return 'bg-red-500 hover:bg-red-600';
    if (risk === 'Medium') return 'bg-yellow-500 hover:bg-yellow-600';
    return 'bg-green-500 hover:bg-green-600';
  };

  const getTrendIcon = (trend: string) => {
    if (trend.toLowerCase().includes('declin') || trend.toLowerCase().includes('draw')) {
      return <TrendingDown className="h-4 w-4 text-green-500" />;
    }
    if (trend.toLowerCase().includes('build') || trend.toLowerCase().includes('increas')) {
      return <TrendingUp className="h-4 w-4 text-red-500" />;
    }
    return <Minus className="h-4 w-4 text-yellow-500" />;
  };

  return (
    <Card className="p-6 bg-accent/50">
      <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Package className="h-5 w-5 text-primary" />
        Fundamental Analysis - {commodityName}
      </h3>

      {/* Supply-Demand Balance Summary */}
      <div className={`p-4 mb-6 rounded-lg border ${getBalanceColor(fundamentals.supplyDemandBalance)}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getBalanceIcon(fundamentals.supplyDemandBalance)}
            <span className="font-bold text-lg">Market: {fundamentals.supplyDemandBalance}</span>
          </div>
          <Badge className={getBalanceColor(fundamentals.supplyDemandBalance)}>
            {fundamentals.supplyDemandBalance === 'Deficit' ? 'Price Supportive' :
             fundamentals.supplyDemandBalance === 'Surplus' ? 'Price Pressured' : 'Neutral'}
          </Badge>
        </div>
        <p className="text-sm mt-2 opacity-80">{getBalanceDescription(fundamentals.supplyDemandBalance)}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Inventory Status */}
        <div className="p-4 bg-background/50 rounded-lg border border-border">
          <div className="flex items-center gap-2 mb-3">
            <Package className="h-4 w-4 text-primary" />
            <h4 className="font-semibold">Inventory Status</h4>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Level:</span>
            <Badge variant="outline">{fundamentals.inventory.level}</Badge>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Weekly Change:</span>
            <span className={`font-semibold ${fundamentals.inventory.change < 0 ? 'text-green-500' : 'text-red-500'}`}>
              {fundamentals.inventory.change > 0 ? '+' : ''}{fundamentals.inventory.change}%
            </span>
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Trend:</span>
            <div className="flex items-center gap-1">
              {getTrendIcon(fundamentals.inventory.trend)}
              <span className="font-semibold">{fundamentals.inventory.trend}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{fundamentals.inventory.details}</p>
        </div>

        {/* Geopolitical Risk */}
        <div className="p-4 bg-background/50 rounded-lg border border-border">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="h-4 w-4 text-primary" />
            <h4 className="font-semibold">Geopolitical Risk</h4>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <Badge className={getRiskColor(fundamentals.geopolitical.risk)}>
              {fundamentals.geopolitical.risk} Risk
            </Badge>
          </div>
          <div className="space-y-1">
            {fundamentals.geopolitical.factors.slice(0, 4).map((factor, i) => (
              <p key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                <span className="text-primary">•</span>
                {factor}
              </p>
            ))}
          </div>
        </div>

        {/* Production Outlook */}
        <div className="p-4 bg-background/50 rounded-lg border border-border">
          <div className="flex items-center gap-2 mb-3">
            <Factory className="h-4 w-4 text-primary" />
            <h4 className="font-semibold">Production Outlook</h4>
          </div>
          <Badge variant="outline" className="mb-3">{fundamentals.production.outlook}</Badge>
          <div className="space-y-1">
            {fundamentals.production.factors.slice(0, 3).map((factor, i) => (
              <p key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                <span className="text-primary">•</span>
                {factor}
              </p>
            ))}
          </div>
        </div>

        {/* Consumption Outlook */}
        <div className="p-4 bg-background/50 rounded-lg border border-border">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-primary" />
            <h4 className="font-semibold">Consumption Outlook</h4>
          </div>
          <Badge variant="outline" className="mb-3">{fundamentals.consumption.outlook}</Badge>
          <div className="space-y-1">
            {fundamentals.consumption.factors.slice(0, 3).map((factor, i) => (
              <p key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                <span className="text-primary">•</span>
                {factor}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Weather Impact */}
      <div className="mt-4 p-3 bg-background/50 rounded-lg border border-border">
        <div className="flex items-center gap-2 mb-2">
          <Cloud className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm">Weather Impact: {fundamentals.weather.impact}</h4>
        </div>
        <p className="text-xs text-muted-foreground">{fundamentals.weather.details}</p>
      </div>

      {/* Key Price Drivers */}
      <div className="mt-4">
        <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Key Price Drivers</h4>
        <div className="flex flex-wrap gap-2">
          {fundamentals.priceDrivers.map((driver, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {driver}
            </Badge>
          ))}
        </div>
      </div>
    </Card>
  );
};

export default FundamentalAnalysisCard;
