import React from 'react';
import { useNseLotSize } from '../hooks/useNseLotSize';  // Adjust path

interface Props {
  symbol?: string;
  buyStrike: number;
  sellStrike: number;
  buyPremium: number;  // e.g., 450
  sellPremium: number;  // e.g., 150
  // Add expiry, greeks as props if dynamic
}

export const BuyCallSpread: React.FC<Props> = ({ 
  symbol = 'NIFTY', 
  buyStrike, 
  sellStrike, 
  buyPremium, 
  sellPremium 
}) => {
  const { data: lotData, loading, error } = useNseLotSize(symbol);
  const lotSize = lotData.lotSize;  // Now 75!

  if (loading) return <div className="flex justify-center p-4"><span className="text-blue-400">Fetching live NSE lot size...</span></div>;
  if (error) return <div className="text-yellow-400 text-sm p-2 bg-yellow-900 rounded">{error}</div>;

  const netPremium = buyPremium - sellPremium;  // ₹300
  const totalInvestment = netPremium * lotSize;  // ₹22,500
  const spreadWidth = sellStrike - buyStrike;  // 900
  const maxProfit = Math.max(0, (spreadWidth - netPremium) * lotSize);  // ₹52,500
  const maxLoss = totalInvestment;  // ₹22,500
  const returnPct = ((maxProfit / totalInvestment) * 100).toFixed(1);  // 233.3%

  return (
    <div className="bg-gray-900 rounded-lg p-6 space-y-4 text-white">  {/* Tailwind classes */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-green-400">BUY CALL SPREAD</h2>
        <span className="bg-green-800 px-3 py-1 rounded-full text-sm">65% Probability</span>
      </div>
      
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <p><strong>Buy Strike:</strong> ₹{buyStrike.toLocaleString()}</p>
          <p><strong>Sell Strike:</strong> ₹{sellStrike.toLocaleString()}</p>
          <p className="font-semibold">Lot Size: <span className="text-green-400">{lotSize} shares</span></p>  {/* Dynamic! */}
          <p><strong>Net Premium/Share:</strong> ₹{netPremium}</p>
        </div>
        <div className="text-right space-y-2">
          <p><strong>Total Investment:</strong> ₹{totalInvestment.toLocaleString()}</p>
          <p><strong>Max Profit:</strong> <span className="text-green-400">₹{maxProfit.toLocaleString()}</span></p>
        </div>
      </div>

      {/* Risk/Reward Card */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-900 p-4 rounded">
          <h3 className="font-bold mb-2">Recommended Strategy</h3>
          <p><strong>Bull Call Spread</strong> • <span className="text-green-400">Call Spread</span></p>
          <p>Buy Strike: ₹{buyStrike.toLocaleString()}</p>
          <p>Sell Strike: ₹{sellStrike.toLocaleString()}</p>
          <p>Time Frame: 7 days</p>
          <p>Technical Score: 8/10</p>
          <p>Recommended Expiry: 18-Nov-2025</p>
        </div>
        <div className="bg-blue-900 p-4 rounded">
          <h3 className="font-bold mb-2">Risk & Reward Profile</h3>
          <p>Risk Level: <span className="text-green-400">Low</span></p>
          <p>IV Rank: 50%</p>
          <p>Expected Return: <span className="text-green-400">+{returnPct}%</span></p>
          <p>Max Gain: ₹{maxProfit.toLocaleString()}</p>
          <p>Max Loss: ₹{maxLoss.toLocaleString()}</p>
        </div>
      </div>

      {/* Premium Details & Greeks */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="bg-blue-800 p-4 rounded">
          <h4 className="font-bold mb-2">Entry, Target & Stop Loss</h4>
          <p>Entry: ₹{netPremium.toLocaleString()}</p>
          <p>Target: ₹{spreadWidth.toLocaleString()}</p>
          <p>Stop Loss: ₹{maxLoss / lotSize + 50} (per share)</p>
        </div>
        <div className="bg-blue-800 p-4 rounded">
          <h4 className="font-bold mb-2">Premium Details (Per Share)</h4>
          <p>Buy Leg Premium: ₹{buyPremium}</p>
          <p>Sell Leg Premium: ₹{sellPremium}</p>
          <p>Net Cost/Share: ₹{netPremium}</p>
          <p>Lot Size: {lotSize} shares</p>
          <p>Total Investment: ₹{totalInvestment.toLocaleString()}</p>
        </div>
      </div>

      {/* Greeks Section - Add your live fetch here if needed */}
      <div className="bg-gray-800 p-4 rounded text-xs">
        <h4 className="font-bold mb-2">Greeks</h4>
        <div className="grid grid-cols-4 gap-2">
          <p>Delta (Long): 0.300</p>
          <p>Delta (Short): -0.500</p>
          <p>Gamma: 0.005</p>
          <p>Vega: 0.100</p>
        </div>
      </div>
    </div>
  );
};
