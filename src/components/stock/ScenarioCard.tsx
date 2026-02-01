import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Layers, TrendingUp, TrendingDown, Activity } from "lucide-react";

interface ScenarioOutcome {
  probability?: number;
  targetPrice?: number;
  percentChange?: number;
  catalyst?: string;
  conditions?: string[];
}

interface ScenarioCardProps {
  scenarios?: {
    bullCase?: ScenarioOutcome;
    baseCase?: ScenarioOutcome;
    bearCase?: ScenarioOutcome;
  };
  currentPrice?: number;
}

const ScenarioCard = ({ scenarios, currentPrice }: ScenarioCardProps) => {
  const renderScenario = (
    scenario: ScenarioOutcome | undefined, 
    title: string, 
    type: 'bull' | 'base' | 'bear'
  ) => {
    if (!scenario) return null;

    const colors = {
      bull: {
        border: 'border-green-500/30',
        bg: 'bg-green-500/5',
        icon: <TrendingUp className="h-5 w-5 text-green-500" />,
        text: 'text-green-500',
        badge: 'bg-green-500/10 text-green-500 border-green-500/20',
      },
      base: {
        border: 'border-yellow-500/30',
        bg: 'bg-yellow-500/5',
        icon: <Activity className="h-5 w-5 text-yellow-500" />,
        text: 'text-yellow-500',
        badge: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      },
      bear: {
        border: 'border-red-500/30',
        bg: 'bg-red-500/5',
        icon: <TrendingDown className="h-5 w-5 text-red-500" />,
        text: 'text-red-500',
        badge: 'bg-red-500/10 text-red-500 border-red-500/20',
      },
    };

    const style = colors[type];
    const change = scenario.percentChange || 
      (scenario.targetPrice && currentPrice 
        ? ((scenario.targetPrice - currentPrice) / currentPrice) * 100 
        : 0);

    return (
      <div className={`p-4 rounded-lg border ${style.border} ${style.bg}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {style.icon}
            <span className="font-semibold">{title}</span>
          </div>
          <Badge className={style.badge}>
            {scenario.probability || 0}% Probability
          </Badge>
        </div>

        <div className="space-y-3">
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${style.text}`}>
              ₹{scenario.targetPrice?.toLocaleString() || '-'}
            </span>
            <span className={`text-sm ${style.text}`}>
              ({change >= 0 ? '+' : ''}{change.toFixed(1)}%)
            </span>
          </div>

          {scenario.catalyst && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Catalyst:</div>
              <p className="text-sm">{scenario.catalyst}</p>
            </div>
          )}

          {scenario.conditions && scenario.conditions.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Conditions:</div>
              <ul className="text-sm space-y-1">
                {scenario.conditions.map((condition, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className={`mt-1.5 w-1.5 h-1.5 rounded-full ${style.bg.replace('/5', '')} flex-shrink-0`} />
                    {condition}
                  </li>
                ))}
              </ul>
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
          <Layers className="h-5 w-5 text-primary" />
          Scenario Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {renderScenario(scenarios?.bullCase, 'Bull Case', 'bull')}
        {renderScenario(scenarios?.baseCase, 'Base Case', 'base')}
        {renderScenario(scenarios?.bearCase, 'Bear Case', 'bear')}

        {(!scenarios?.bullCase && !scenarios?.baseCase && !scenarios?.bearCase) && (
          <div className="text-center py-8 text-muted-foreground">
            <Layers className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Scenario analysis not available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ScenarioCard;
