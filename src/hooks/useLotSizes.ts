import { useState, useEffect } from 'react';

interface LotSizes {
  NIFTY: number;
  CNXFMGC: number;
  CNXAUTO: number;
}

export const useLotSizes = () => {
  const [lotSizes, setLotSizes] = useState<LotSizes>({ NIFTY: 75, CNXFMGC: 25, CNXAUTO: 25 });  // Current Nov 2025 fallbacks
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLotSizes = async () => {
      try {
        setLoading(true);
        // Updated NSE endpoint: Daily securities file (includes lot info; parse for symbols)
        // Alternative: Use free API like https://api.stocksnse.com/lot-size?symbol=NIFTY (unofficial but reliable; add if needed)
        const response = await fetch('https://archives.nseindia.com/content/fo/fo_sec_bhav.csv');  // Or try 'https://www.nseindia.com/api/master-quote'
        if (!response.ok) throw new Error('NSE fetch failed');
        const csvText = await response.text();

        // Simple CSV parse (no deps needed)
        const rows = csvText.split('\n').map(row => row.split(','));
        const header = rows[0];
        const symbolIdx = header.indexOf('SYMBOL');
        const lotIdx = header.indexOf('MARKET_LOT');  // If present; else fallback

        const extracted: LotSizes = { NIFTY: 75, CNXFMGC: 25, CNXAUTO: 25 };
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row[symbolIdx]?.trim() === 'NIFTY') extracted.NIFTY = parseInt(row[lotIdx] || '75', 10);
          if (row[symbolIdx]?.trim() === 'CNXFMGC') extracted.CNXFMGC = parseInt(row[lotIdx] || '25', 10);
          if (row[symbolIdx]?.trim() === 'CNXAUTO') extracted.CNXAUTO = parseInt(row[lotIdx] || '25', 10);
        }

        setLotSizes(extracted);
      } catch (err) {
        console.error('Lot size fetch error:', err);
        setError('Using fallback lot sizes (NIFTY:75)—NSE updates quarterly');
      } finally {
        setLoading(false);
      }
    };

    fetchLotSizes();
    // Refetch daily
    const interval = setInterval(fetchLotSizes, 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return { lotSizes, loading, error };
};
