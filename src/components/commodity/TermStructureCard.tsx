import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, ArrowRight, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";

interface ContractData {
  expiryDate: string;
  daysToExpiry: number;
  termStructure: 'Contango' | 'Backwardation' | 'Flat';
  spreadPercent: number;
  rollRecommendation: string;
  nearMonthPrice: number;
  nextMonthPrice: number;
  farMonthPrice?: number;
}

interface TermStructureCardProps {
  contract: ContractData;
  commodityName: string;
}

const safeNum = (val: any): number | null =>
  typeof val === 'number' && Number.isFinite(val) ? val : null;

const fmtInr = (val: any, fallback = '—'): string => {
  const n = safeNum(val);
  return n !== null ? `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : fallback;
};

const fmt = (val: any, decimals = 2, fallback = '—'): string => {
  const n = safeNum(val);
  return n !== null ? n.toFixed(decimals) : fallback;
};

const TermStructureCard = ({ contract, commodityName }: TermStructureCardProps) => {
  const nearPrice = safeNum(contract?.nearMonthPrice) ?? 0;
  const nextPrice = safeNum(contract?.nextMonthPrice) ?? 0;
  const farPrice = safeNum(contract?.farMonthPrice);
  const spread = safeNum(contract?.spreadPercent) ?? 0;
  const dte = safeNum(contract?.daysToExpiry) ?? 0;

  const getStructureColor = (structure: string) => {
    if (structure === 'Contango') return 'bg-red-500/10 text-red-500 border-red-500/20';
    if (structure === 'Backwardation') return 'bg-green-500/10 text-green-500 border-green-500/20';
    return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
  };

  const getStructureIcon = (structure: string) => {
    if (structure === 'Contango') return <TrendingUp className="h-4 w-4" />;
    if (structure === 'Backwardation') return <TrendingDown className="h-4 w-4" />;
    return null;
  };

  const getStructureDescription = (structure: string) => {
    if (structure === 'Contango') {
      return 'Far month contracts are trading at a premium. Rolling forward will cost money (negative roll yield).';
    }
    if (structure === 'Backwardation') {
      return 'Near month contracts are trading at a premium. Rolling forward will earn money (positive roll yield).';
    }
    return 'Near and far month contracts are trading at similar levels.';
  };

  const getExpiryUrgency = (days: number) => {
    if (days <= 3) return { color: 'bg-red-500', text: 'URGENT - Roll immediately!' };
    if (days <= 7) return { color: 'bg-orange-500', text: 'Warning - Roll soon' };
    if (days <= 14) return { color: 'bg-yellow-500', text: 'Watch - Roll window approaching' };
    return { color: 'bg-green-500', text: 'Safe - Time to plan' };
  };

  const urgency = getExpiryUrgency(dte);

  const calcSpread = (a: number, b: number): string => {
    if (b === 0) return '—';
    return ((a - b) / b * 100).toFixed(2);
  };

  return (
    <Card className="p-6 bg-accent/50">
      <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Calendar className="h-5 w-5 text-primary" />
        Contract & Term Structure - {commodityName}
      </h3>

      {dte <= 7 && (
        <div className={`p-3 mb-4 rounded-lg ${urgency.color}/20 border border-current flex items-center gap-2`}>
          <AlertTriangle className={`h-5 w-5 ${urgency.color === 'bg-red-500' ? 'text-red-500' : 'text-orange-500'}`} />
          <p className="font-semibold">{urgency.text}</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="p-4 bg-background/50 rounded-lg border border-border">
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Current Contract
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Expiry Date</span>
              <span className="font-semibold">{contract?.expiryDate || '—'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Days to Expiry</span>
              <Badge className={`${urgency.color} text-white`}>
                {dte} days
              </Badge>
            </div>
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Roll Recommendation</p>
              <p className="text-sm font-medium text-primary">{contract?.rollRecommendation || '—'}</p>
            </div>
          </div>
        </div>

        <div className={`p-4 rounded-lg border ${getStructureColor(contract?.termStructure || 'Flat')}`}>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            {getStructureIcon(contract?.termStructure || 'Flat')}
            Term Structure: {contract?.termStructure || '—'}
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm opacity-80">Spread</span>
              <span className={`font-bold ${spread > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {spread > 0 ? '+' : ''}{fmt(spread)}%
              </span>
            </div>
            <p className="text-xs opacity-80">{getStructureDescription(contract?.termStructure || 'Flat')}</p>
            <div className="pt-2 border-t border-current/20">
              <Badge variant="outline" className="text-xs">
                {contract?.termStructure === 'Contango' 
                  ? '📉 Negative roll yield expected' 
                  : contract?.termStructure === 'Backwardation'
                  ? '📈 Positive roll yield expected'
                  : '➡️ Minimal roll impact'}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Futures Curve */}
      <div className="mt-4 p-4 bg-background/50 rounded-lg border border-border">
        <h4 className="font-semibold mb-4">Futures Curve</h4>
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 p-3 bg-primary/10 rounded-lg text-center">
            <p className="text-xs text-muted-foreground mb-1">Near Month</p>
            <p className="text-xl font-bold text-primary">{fmtInr(nearPrice)}</p>
            <Badge variant="outline" className="mt-1 text-xs">Current</Badge>
          </div>
          <ArrowRight className={`h-6 w-6 ${contract?.termStructure === 'Contango' ? 'text-red-500' : 'text-green-500'}`} />
          <div className="flex-1 p-3 bg-muted/50 rounded-lg text-center">
            <p className="text-xs text-muted-foreground mb-1">Next Month</p>
            <p className="text-xl font-bold">{fmtInr(nextPrice)}</p>
            <Badge 
              variant="outline" 
              className={`mt-1 text-xs ${nextPrice > nearPrice ? 'text-red-500' : 'text-green-500'}`}
            >
              {calcSpread(nextPrice, nearPrice)}%
            </Badge>
          </div>
          {farPrice !== null && (
            <>
              <ArrowRight className={`h-6 w-6 ${contract?.termStructure === 'Contango' ? 'text-red-500' : 'text-green-500'}`} />
              <div className="flex-1 p-3 bg-muted/50 rounded-lg text-center">
                <p className="text-xs text-muted-foreground mb-1">Far Month</p>
                <p className="text-xl font-bold">{fmtInr(farPrice)}</p>
                <Badge 
                  variant="outline" 
                  className={`mt-1 text-xs ${farPrice > nearPrice ? 'text-red-500' : 'text-green-500'}`}
                >
                  {calcSpread(farPrice, nearPrice)}%
                </Badge>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
        <h4 className="text-sm font-semibold mb-2 text-primary">Roll Strategy Tips</h4>
        <ul className="text-xs space-y-1 text-muted-foreground">
          <li>• Start rolling 5-7 business days before expiry to avoid liquidity issues</li>
          <li>• In contango, consider shorter-dated contracts to minimize roll costs</li>
          <li>• In backwardation, longer-dated contracts can earn positive roll yield</li>
          <li>• Watch for sudden structure changes during contract rolls</li>
        </ul>
      </div>
    </Card>
  );
};

export default TermStructureCard;
