import { useState, useEffect } from 'react';
import * as cheerio from 'cheerio';  // If you install cheerio; else use DOMParser below

interface LotSizes {
  NIFTY: number;
  CNXFMGC: number;
  CNXAUTO: number;
}

export const useLotSizes = () => {
  const [lotSizes, setLotSizes] = useState<LotSizes>({ NIFTY: 75, CNXFMGC: 25, CNXAUTO: 25 });  // Fallback to Nov 2025 values
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLotSizes = async () => {
      try {
        setLoading(true);
        const response = await fetch('https://www.nseindia.com/market-data/lot-size-trading-unit');
        if (!response.ok) throw new Error('NSE fetch failed');
        const html = await response.text();

        // Parse with Cheerio (recommended) or native DOMParser
        const $ = cheerio.load(html);  // Or: const parser = new DOMParser(); const doc = parser.parseFromString(html, 'text/html'); then use doc.querySelector
        
        // NSE table structure: Rows in <table> with <td> for symbol and lot (adapt selector if page changes)
        const rows = $('table tr');  // Target the specific table; inspect NSE page for exact class/id, e.g., '#lotSizeTable tr'
        const extracted: LotSizes = { NIFTY: 75, CNXFMGC: 25, CNXAUTO: 25 };  // Start with fallback

        rows.each((i, row) => {
          const cells = $(row).find('td');
          if (cells.length >= 2) {
            const symbol = $(cells[0]).text().trim().toUpperCase();
            const lot = parseInt($(cells[1]).text().trim(), 10);
            if (symbol === 'NIFTY') extracted.NIFTY = lot;
            else if (symbol === 'CNXFMGC') extracted.CNXFMGC = lot;
            else if (symbol === 'CNXAUTO') extracted.CNXAUTO = lot;
          }
        });

        setLotSizes(extracted);
      } catch (err) {
        console.error('Lot size fetch error:', err);
        setError('Using fallback lot sizes—check NSE for updates');
      } finally {
        setLoading(false);
      }
    };

    fetchLotSizes();
    // Optional: Refetch every 24h
    const interval = setInterval(fetchLotSizes, 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return { lotSizes, loading, error };
};
