// Example: src/components/BullCallSpread.tsx (or wherever your screenshot's card is)
import React from 'react';
import { useLotSizes } from '../hooks/useLotSizes';  // Adjust path

interface Props {
  symbol: 'NIFTY' | 'CNXFMGC' | 'CNXAUTO';
  buyStrike: number;
  sellStrike: number;
  // ... other props like premiums
}

export const BullCallSpread: React.FC<Props> = ({ symbol, buyStrike, sellStrike }) => {
  const { lotSizes, loading, error } = useLotSizes();
  const lotSize = lotSizes[symbol as keyof LotSizes];  // e.g., lotSizes.NIFTY = 75

  if (loading) return <div>Loading lot sizes...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  // Your calc logic (update with live lotSize)
  const netDebit = 30 * lotSize;  // Example: (buyPremium - sellPremium) * lotSize
  const maxGain = (sellStrike - buyStrike - 30) * lotSize;  // Adjust for your premiums
  const totalInvestment = netDebit;
  const expectedReturn = ((maxGain / totalInvestment) * 100).toFixed(0);

  return (
    <div className="bg-blue-900 p-4 rounded-lg">  {/* Tailwind classes from your config */}
      <h3>Bull Call Spread for {symbol}</h3>
      <p>Lot Size: {lotSize} shares</p>  {/* Now dynamic: 75 for NIFTY */}
      <p>Total Investment: ₹{totalInvestment.toLocaleString()}</p>
      <p>Max Gain: ₹{maxGain.toLocaleString()}</p>
      <p>Expected Return: +{expectedReturn}%</p>
      {/* Add your buy/sell strikes, expiry, etc. */}
    </div>
  );
};
