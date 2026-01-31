import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

interface Scenario {
  probability: number;
  targetPrice: number;
  percentChange: number;
  catalyst: string;
  recommendation: string;
}

interface ScenarioAnalysisCardProps {
  scenarios: {
    bestCase: Scenario;
    baseCase: Scenario;
    worstCase: Scenario;
  };
  currentPrice: number;
  commodityName: string;
}

const ScenarioAnalysisCard = ({ scenarios, currentPrice, commodityName }: ScenarioAnalysisCardProps) => {
  return (
    <Card className="p-6 bg-accent/50">
      <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Target className="h-5 w-5 text-primary" />
        Scenario Analysis - {commodityName}
      </h3>

      <div className="text-center mb-6 p-3 bg-primary/10 rounded-lg">
        <p className="text-sm text-muted-foreground">Current Spot Price</p>
        <p className="text-3xl font-bold text-primary">
          ₹{currentPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Best Case */}
        <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <h4 className="font-semibold text-green-500">Best Case</h4>
            </div>
            <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
              {scenarios.bestCase.probability}%
            </Badge>
          </div>
          
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Target Price</p>
              <p className="text-2xl font-bold text-green-500">
                ₹{scenarios.bestCase.targetPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-sm text-green-400">
                +{scenarios.bestCase.percentChange.toFixed(1)}%
              </p>
            </div>
            
            <div className="pt-2 border-t border-green-500/20">
              <p className="text-xs text-muted-foreground mb-1">Catalyst</p>
              <p className="text-sm text-foreground">{scenarios.bestCase.catalyst}</p>
            </div>
            
            <div className="pt-2 border-t border-green-500/20">
              <p className="text-xs text-muted-foreground mb-1">Recommendation</p>
              <p className="text-sm font-medium text-green-400">{scenarios.bestCase.recommendation}</p>
            </div>
          </div>
        </div>

        {/* Base Case */}
        <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <h4 className="font-semibold text-primary">Base Case</h4>
            </div>
            <Badge className="bg-primary/20 text-primary border-primary/30">
              {scenarios.baseCase.probability}%
            </Badge>
          </div>
          
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Target Price</p>
              <p className="text-2xl font-bold text-primary">
                ₹{scenarios.baseCase.targetPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <p className={`text-sm ${scenarios.baseCase.percentChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {scenarios.baseCase.percentChange >= 0 ? '+' : ''}{scenarios.baseCase.percentChange.toFixed(1)}%
              </p>
            </div>
            
            <div className="pt-2 border-t border-primary/20">
              <p className="text-xs text-muted-foreground mb-1">Catalyst</p>
              <p className="text-sm text-foreground">{scenarios.baseCase.catalyst}</p>
            </div>
            
            <div className="pt-2 border-t border-primary/20">
              <p className="text-xs text-muted-foreground mb-1">Recommendation</p>
              <p className="text-sm font-medium text-primary">{scenarios.baseCase.recommendation}</p>
            </div>
          </div>
        </div>

        {/* Worst Case */}
        <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
              <h4 className="font-semibold text-red-500">Worst Case</h4>
            </div>
            <Badge className="bg-red-500/20 text-red-500 border-red-500/30">
              {scenarios.worstCase.probability}%
            </Badge>
          </div>
          
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Target Price</p>
              <p className="text-2xl font-bold text-red-500">
                ₹{scenarios.worstCase.targetPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-sm text-red-400">
                {scenarios.worstCase.percentChange.toFixed(1)}%
              </p>
            </div>
            
            <div className="pt-2 border-t border-red-500/20">
              <p className="text-xs text-muted-foreground mb-1">Catalyst</p>
              <p className="text-sm text-foreground">{scenarios.worstCase.catalyst}</p>
            </div>
            
            <div className="pt-2 border-t border-red-500/20">
              <p className="text-xs text-muted-foreground mb-1">Recommendation</p>
              <p className="text-sm font-medium text-red-400">{scenarios.worstCase.recommendation}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Risk Warning */}
      <div className="mt-4 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-yellow-500">Note:</span> Scenario probabilities are estimates based on 
          current market conditions and technical analysis. Actual outcomes may differ significantly due to 
          unexpected events. Always use proper position sizing and stop-losses.
        </p>
      </div>
    </Card>
  );
};

export default ScenarioAnalysisCard;
