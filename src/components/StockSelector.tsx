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

interface StockSelectorProps {
  onSelectStock: (symbol: string, name: string) => void;
}

const StockSelector = ({ onSelectStock }: StockSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchStocks();
  }, []);

  const fetchStocks = async () => {
    try {
      const { data, error } = await supabase
        .from('stocks')
        .select('*')
        .order('name');

      if (error) throw error;
      setStocks(data || []);
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

  const filteredStocks = stocks.filter(stock => 
    stock.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (stock.sector && stock.sector.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <section id="dashboard" className="py-20 px-4">
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">
            Select a <span className="text-gradient">Stock</span>
          </h2>
          <p className="text-xl text-muted-foreground">
            Choose from {stocks.length} NSE & BSE listed stocks
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
        ) : filteredStocks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">No stocks found matching your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStocks.map((stock) => (
              <Card 
                key={stock.symbol} 
                className="glass-strong border-border hover:border-primary transition-all duration-300 cursor-pointer group"
                onClick={() => onSelectStock(stock.symbol, stock.name)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="group-hover:text-primary transition-colors">
                        {stock.name}
                      </CardTitle>
                      <CardDescription className="text-muted-foreground mt-1">
                        {stock.symbol} • {stock.exchange}
                      </CardDescription>
                    </div>
                    {stock.sector && (
                      <Badge variant="outline" className="border-primary/50">
                        {stock.sector}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Click to view AI predictions
                  </p>
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
