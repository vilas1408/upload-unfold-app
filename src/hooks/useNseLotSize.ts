import { useState, useEffect } from 'react';

export interface LotSizeData {
  symbol: string;
  lotSize: number;
}

export const useNseLotSize = (symbol: string = 'NIFTY') => {
  const [data, setData] = useState<LotSizeData>({ symbol, lotSize: 75 });  // Fallback to current (Nov 2025)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLotSize = async () => {
      try {
        setLoading(true);
        // NSE's live contract specs CSV (daily update, includes MARKETLOT)
        const url = 'https://www.nseindia.com/api/reports?archives=%7B%22name%22:%22Futures%20contract%20specifications%22,%22filter%22:%5B%7B%22columnName%22:%22SYMBOL%22,%22value%22:%22NIFTY%22%7D%5D%7D&category=fo&csvDownload=true';  // Direct CSV download endpoint
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',  // Bypass basic blocks
            'Accept': 'text/csv,*/*;q=0.01',
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        if (!response.ok) throw new Error(`NSE API error: ${response.status}`);
        
        const csvText = await response.text();
        const rows = csvText.split('\n').slice(1);  // Skip header
        let foundLot = 75;  // Fallback

        for (const row of rows) {
          const cols = row.split(',');
          if (cols[0]?.trim() === symbol) {
            foundLot = parseInt(cols.find(col => col.includes('MARKETLOT'))?.split('=')[1] || '75', 10);
            break;
          }
        }

        setData({ symbol, lotSize: foundLot });
      } catch (err) {
        console.error('NSE lot size fetch failed:', err);
        setError(`Fallback to ${75}—NSE review quarterly. Check nseindia.com for updates.`);
      } finally {
        setLoading(false);
      }
    };

    fetchLotSize();
    // Refetch weekly (lots change infrequently)
    const interval = setInterval(fetchLotSize, 7 * 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [symbol]);

  return { data, loading, error };
};
