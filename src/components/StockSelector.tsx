import { Search } from "lucide-react";
import { Input } from "./ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { useState } from "react";

const popularStocks = [
  { symbol: "RELIANCE.NS", name: "Reliance Industries", price: "2,456.50", change: "+2.45%" },
  { symbol: "TCS.NS", name: "Tata Consultancy Services", price: "3,678.90", change: "+1.82%" },
  { symbol: "HDFCBANK.NS", name: "HDFC Bank", price: "1,654.30", change: "-0.45%" },
  { symbol: "INFY.NS", name: "Infosys", price: "1,432.75", change: "+3.21%" },
  { symbol: "ICICIBANK.NS", name: "ICICI Bank", price: "987.60", change: "+1.12%" },
  { symbol: "HINDUNILVR.NS", name: "Hindustan Unilever", price: "2,345.80", change: "-1.05%" },
];

interface StockSelectorProps {
  onSelectStock: (symbol: string, name: string) => void;
}

const StockSelector = ({ onSelectStock }: StockSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  const getChangeColor = (change: string) => {
    return change.startsWith('+') ? 'text-success' : 'text-danger';
  };

  const filteredStocks = popularStocks.filter(stock => 
    stock.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    stock.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <section id="dashboard" className="py-20 px-4">
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">
            Select a <span className="text-gradient">Stock</span>
          </h2>
          <p className="text-xl text-muted-foreground">
            Choose from Nifty 50 companies to view predictions
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

        {/* Popular Stocks Grid */}
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
                      {stock.symbol}
                    </CardDescription>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={`${getChangeColor(stock.change)} border-current`}
                  >
                    {stock.change}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">₹{stock.price}</div>
                <p className="text-sm text-muted-foreground mt-2">
                  Click to view predictions
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StockSelector;
