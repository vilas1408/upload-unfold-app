import React from 'react';
import { useLotSizes } from '../hooks/useLotSizes';

interface Props {
  symbol: 'NIFTY' | 'CNXFMGC' | 'CNXAUTO';
  buyStrike: number;  // e.g., 25600
  sellStrike: number;  // e.g., 26500
  buyPremium: number;  // e.g., 450
  sellPremium: number;  // e.g., 250
}

export const BullCallSpread: React.FC<Props> = ({ symbol, buyStrike, sellStrike, buyPremium, sellPremium }) => {
  const { lotSizes, loading, error } = useLotSizes();
  const lotSize = lotSizes[symbol as keyof LotSizes];

  if (loading) return <div className="text-blue-200">Loading live lot size...</div>;
  if (error) return <div className="text-red-500 text-sm">{error}</div>;

  const netPremiumPerShare = buyPremium - sellPremium;  // ₹200
  const totalInvestment = netPremiumPerShare * lotSize;  // Now ₹15,000 for NIFTY
  const spreadWidth = sellStrike - buyStrike;  // 900
  const maxProfit = (spreadWidth - netPremiumPerShare) * lotSize;  // ₹52,500
  const maxLoss = totalInvestment;  // ₹15,000
  const expectedReturn = ((maxProfit / totalInvestment) * 100).toFixed(1);  // +350.0%

  return (
    <div className="bg-gray-900 p-6 rounded-lg space-y-4">  {/* Tailwind from your config */}
      <h3 className="text-xl font-bold text-green-400">BUY CALL SPREAD for {symbol}</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p><strong>Buy Strike:</strong> ₹{buyStrike.toLocaleString()}</p>
          <p><strong>Sell Strike:</strong> ₹{sellStrike.toLocaleString()}</p>
          <p><strong>Lot Size:</strong> {lotSize} shares</p>  {/* Dynamic: 75 */}
          <p><strong>Net Premium/Share:</strong> ₹{netPremiumPerShare}</p>
        </div>
        <div className="text-right">
          <p><strong>Total Investment:</strong> ₹{totalInvestment.toLocaleString()}</p>
          <p><strong>Max Profit:</strong> <span className="text-green-400">₹{maxProfit.toLocaleString()}</span></p>
          <p><strong>Max Loss:</strong> <span className="text-red-400">₹{maxLoss.toLocaleString()}</span></p>
          <p><strong>Expected Return:</strong> <span className="text-green-400">+{expectedReturn}%</span></p>
        </div>
      </div>
      {/* Add your Greeks/Trading Levels section here */}
    </div>
  );
};
