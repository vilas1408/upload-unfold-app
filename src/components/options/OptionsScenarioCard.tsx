import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Target, AlertTriangle, CheckCircle } from "lucide-react";

interface OptionsScenarioCardProps {
  scenarios?: {
    bullCase: {
      probability: number;
      targetPrice: number;
      premiumTarget: number;
      pnl: number;
      catalyst: string;
    };
    baseCase: {
      probability: number;
      targetPrice: number;
      premiumTarget: number;
      pnl: number;
      catalyst: string;
    };
    bearCase: {
      probability: number;
      targetPrice: number;
      premiumTarget: number;
      pnl: number;
      catalyst: string;
    };
  };
  optionType: 'CALL' | 'PUT' | string;
  spotPrice: number;
  entryPremium: number;
  lotSize: number;
}

const OptionsScenarioCard = ({ scenarios, optionType, spotPrice, entryPremium, lotSize }: OptionsScenarioCardProps) => {
  // Generate default scenarios if not provided
  const defaultScenarios = {
    bullCase: {
      probability: 25,
      targetPrice: spotPrice * 1.03,
      premiumTarget: entryPremium * 1.6,
      pnl: (entryPremium * 1.6 - entryPremium) * lotSize,
      catalyst: optionType === 'CALL' 
        ? 'Strong breakout above resistance, positive FII flows, bullish momentum continuation'
        : 'Breakdown below support fails, short covering rally, positive news flow'
    },
    baseCase: {
      probability: 50,
      targetPrice: spotPrice * (optionType === 'CALL' ? 1.01 : 0.99),
      premiumTarget: entryPremium * 1.3,
      pnl: (entryPremium * 1.3 - entryPremium) * lotSize,
      catalyst: 'Range-bound movement with gradual drift in predicted direction'
    },
    bearCase: {
      probability: 25,
      targetPrice: spotPrice * 0.97,
      premiumTarget: entryPremium * 0.5,
      pnl: (entryPremium * 0.5 - entryPremium) * lotSize,
      catalyst: optionType === 'CALL'
        ? 'Break below support, negative FII flows, global risk-off sentiment'
        : 'Strong bounce from support, short covering, positive news catalyst'
    }
  };

  const activeScenarios = scenarios || defaultScenarios;

  const getScenarioIcon = (type: string) => {
    switch (type) {
      case 'bull': return <TrendingUp className="h-5 w-5 text-green-500" />;
      case 'base': return <Minus className="h-5 w-5 text-yellow-500" />;
      case 'bear': return <TrendingDown className="h-5 w-5 text-red-500" />;
      default: return null;
    }
  };

  const formatPnL = (pnl: number) => {
    const isProfit = pnl > 0;
    return (
      <span className={isProfit ? 'text-green-500' : 'text-red-500'}>
        {isProfit ? '+' : ''}₹{Math.abs(pnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
      </span>
    );
  };

  return (
    <Card className="glass-strong border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Scenario Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bull Case */}
        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {getScenarioIcon('bull')}
              <span className="font-semibold">Bull Case</span>
            </div>
            <Badge className="bg-green-500">{activeScenarios.bullCase.probability}% Probability</Badge>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-3">
            <div>
              <div className="text-xs text-muted-foreground">Spot Target</div>
              <div className="font-bold">₹{activeScenarios.bullCase.targetPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
              <div className="text-xs text-green-500">
                +{(((activeScenarios.bullCase.targetPrice - spotPrice) / spotPrice) * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Premium Target</div>
              <div className="font-bold">₹{activeScenarios.bullCase.premiumTarget.toFixed(0)}</div>
              <div className="text-xs text-green-500">
                +{(((activeScenarios.bullCase.premiumTarget - entryPremium) / entryPremium) * 100).toFixed(0)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Expected P&L</div>
              <div className="font-bold">{formatPnL(activeScenarios.bullCase.pnl)}</div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground flex items-start gap-1">
            <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0 mt-0.5" />
            <span>{activeScenarios.bullCase.catalyst}</span>
          </div>
        </div>

        {/* Base Case */}
        <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {getScenarioIcon('base')}
              <span className="font-semibold">Base Case</span>
            </div>
            <Badge className="bg-yellow-500">{activeScenarios.baseCase.probability}% Probability</Badge>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-3">
            <div>
              <div className="text-xs text-muted-foreground">Spot Target</div>
              <div className="font-bold">₹{activeScenarios.baseCase.targetPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
              <div className="text-xs text-yellow-500">
                {(((activeScenarios.baseCase.targetPrice - spotPrice) / spotPrice) * 100) > 0 ? '+' : ''}
                {(((activeScenarios.baseCase.targetPrice - spotPrice) / spotPrice) * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Premium Target</div>
              <div className="font-bold">₹{activeScenarios.baseCase.premiumTarget.toFixed(0)}</div>
              <div className="text-xs text-yellow-500">
                +{(((activeScenarios.baseCase.premiumTarget - entryPremium) / entryPremium) * 100).toFixed(0)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Expected P&L</div>
              <div className="font-bold">{formatPnL(activeScenarios.baseCase.pnl)}</div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground flex items-start gap-1">
            <Minus className="h-3 w-3 text-yellow-500 flex-shrink-0 mt-0.5" />
            <span>{activeScenarios.baseCase.catalyst}</span>
          </div>
        </div>

        {/* Bear Case */}
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {getScenarioIcon('bear')}
              <span className="font-semibold">Bear Case</span>
            </div>
            <Badge className="bg-red-500">{activeScenarios.bearCase.probability}% Probability</Badge>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-3">
            <div>
              <div className="text-xs text-muted-foreground">Spot Target</div>
              <div className="font-bold">₹{activeScenarios.bearCase.targetPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
              <div className="text-xs text-red-500">
                {(((activeScenarios.bearCase.targetPrice - spotPrice) / spotPrice) * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Premium at SL</div>
              <div className="font-bold">₹{activeScenarios.bearCase.premiumTarget.toFixed(0)}</div>
              <div className="text-xs text-red-500">
                {(((activeScenarios.bearCase.premiumTarget - entryPremium) / entryPremium) * 100).toFixed(0)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Max Loss</div>
              <div className="font-bold">{formatPnL(activeScenarios.bearCase.pnl)}</div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground flex items-start gap-1">
            <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0 mt-0.5" />
            <span>{activeScenarios.bearCase.catalyst}</span>
          </div>
        </div>

        {/* Summary */}
        <div className="p-3 rounded-lg bg-muted/30 border border-border text-center">
          <div className="text-xs text-muted-foreground mb-1">Expected Value</div>
          <div className="font-bold text-primary">
            ₹{(
              (activeScenarios.bullCase.pnl * activeScenarios.bullCase.probability / 100) +
              (activeScenarios.baseCase.pnl * activeScenarios.baseCase.probability / 100) +
              (activeScenarios.bearCase.pnl * activeScenarios.bearCase.probability / 100)
            ).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Probability-weighted average outcome
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default OptionsScenarioCard;
