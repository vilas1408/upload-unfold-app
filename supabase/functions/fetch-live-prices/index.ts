import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbols } = await req.json();
    console.log('Fetching live prices for symbols:', symbols);

    const priceData = await Promise.all(
      symbols.map(async (symbol: string) => {
        try {
          // Yahoo Finance uses different suffixes for Indian stocks
          const yahooSymbol = symbol.includes('.') ? symbol : `${symbol}.NS`;
          
          const response = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1d`,
            {
              headers: {
                'User-Agent': 'Mozilla/5.0',
              },
            }
          );

          if (!response.ok) {
            console.error(`Failed to fetch data for ${symbol}:`, response.status);
            return null;
          }

          const data = await response.json();
          const result = data.chart?.result?.[0];
          
          if (!result) {
            console.error(`No data found for ${symbol}`);
            return null;
          }

          const meta = result.meta;
          const currentPrice = meta.regularMarketPrice;
          const previousClose = meta.chartPreviousClose || meta.previousClose;
          const change = currentPrice - previousClose;
          const changePercent = (change / previousClose) * 100;

          return {
            symbol: symbol,
            currentPrice: currentPrice,
            previousClose: previousClose,
            change: change,
            changePercent: changePercent,
          };
        } catch (error) {
          console.error(`Error fetching ${symbol}:`, error);
          return null;
        }
      })
    );

    const validData = priceData.filter(d => d !== null);
    
    return new Response(
      JSON.stringify({ success: true, data: validData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fetch-live-prices:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
