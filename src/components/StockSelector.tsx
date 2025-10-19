import { Search } from "lucide-react";
import { Input } from "./ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "./ui/skeleton";

interface Stock {
  symbol: string;
  name: string;
  exchange: string;
  sector: string | null;
}

interface LiveStockData extends Stock {
  currentPrice?: number;
  changePercent?: number;
  change?: number;
}

interface StockSelectorProps {
  onSelectStock: (symbol: string, name: string) => void;
}

const StockSelector = ({ onSelectStock }: StockSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [liveStocks, setLiveStocks] = useState<LiveStockData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchStocksAndPrices();
  }, []);

  const fetchStocksAndPrices = async () => {
    try {
      // Fetch stocks from database
      const { data, error } = await supabase
        .from('stocks')
        .select('*')
        .order('name');

      if (error) throw error;
      setStocks(data || []);

      // Fetch live prices
      if (data && data.length > 0) {
        const symbols = data.map(s => s.symbol);
        const { data: priceData, error: priceError } = await supabase.functions.invoke('fetch-live-prices', {
          body: { symbols }
        });

        if (priceError) {
          console.error('Error fetching live prices:', priceError);
        } else if (priceData?.success) {
          // Merge stock data with live prices
          const stocksWithPrices = data.map(stock => {
            const priceInfo = priceData.data.find((p: any) => p.symbol === stock.symbol);
            return {
              ...stock,
              currentPrice: priceInfo?.currentPrice,
              changePercent: priceInfo?.changePercent,
              change: priceInfo?.change,
            };
          });
          setLiveStocks(stocksWithPrices);
        }
      }
    } catch (error: any) {
      console.error('Error fetching stocks:', error);
      toast({
        title: "Error",
        description: "Failed to load stocks. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const dataToUse: LiveStockData[] = liveStocks.length > 0 ? liveStocks : stocks;

  const filteredStocks: LiveStockData[] = dataToUse.filter(stock => 
    stock.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (stock.sector && stock.sector.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Show top 5 gainers when no search term, otherwise show all filtered results
  const displayedStocks: LiveStockData[] = searchTerm 
    ? filteredStocks 
    : filteredStocks
        .filter(s => s.changePercent !== undefined)
        .sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0))
        .slice(0, 5);

  return (
    <section id="dashboard" className="py-20 px-4">
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">
            {searchTerm ? 'Search Results' : 'Top 5'} <span className="text-gradient">Gainers</span>
          </h2>
          <p className="text-xl text-muted-foreground">
            {searchTerm 
              ? `${filteredStocks.length} stocks found` 
              : `Live market data • ${stocks.length} total stocks available`}
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-2xl mx-auto mb-12">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input 
              placeholder="Search for stocks (e.g., TCS, Reliance, HDFC...)"
              className="pl-12 py-6 text-lg glass-strong border-border"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Stocks Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="glass-strong border-border">
                <CardHeader>
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : displayedStocks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">No stocks found matching your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedStocks.map((stock) => (
              <Card 
                key={stock.symbol} 
                className="glass-strong border-border hover:border-primary transition-all duration-300 cursor-pointer group"
                onClick={() => onSelectStock(stock.symbol, stock.name)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="group-hover:text-primary transition-colors">
                        {stock.name}
                      </CardTitle>
                      <CardDescription className="text-muted-foreground mt-1">
                        {stock.symbol} • {stock.exchange}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {stock.changePercent !== undefined && (
                        <Badge 
                          variant="outline" 
                          className={stock.changePercent >= 0 
                            ? "border-green-500 text-green-600" 
                            : "border-red-500 text-red-600"
                          }
                        >
                          {stock.changePercent >= 0 ? '↑' : '↓'} {Math.abs(stock.changePercent).toFixed(2)}%
                        </Badge>
                      )}
                      {stock.sector && (
                        <Badge variant="outline" className="border-primary/50">
                          {stock.sector}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stock.currentPrice !== undefined && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Current Price:</span>
                        <span className="font-semibold">₹{stock.currentPrice.toFixed(2)}</span>
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Click to view AI predictions
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default StockSelector;
