import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, TrendingUp, BarChart3 } from "lucide-react";

interface OptionsSelectorProps {
  onSelectOption: (symbol: string, name: string, type: 'share' | 'index') => void;
}

const popularShares = [
  { symbol: "RELIANCE", name: "Reliance Industries" },
  { symbol: "TCS", name: "Tata Consultancy Services" },
  { symbol: "HDFCBANK", name: "HDFC Bank" },
  { symbol: "INFY", name: "Infosys" },
  { symbol: "ICICIBANK", name: "ICICI Bank" },
  { symbol: "SBIN", name: "State Bank of India" },
];

const indianIndices = [
  { symbol: "^NSEI", name: "Nifty 50" },
  { symbol: "^BSESN", name: "BSE Sensex" },
  { symbol: "^NSEBANK", name: "Nifty Bank" },
  { symbol: "^CNXIT", name: "Nifty IT" },
  { symbol: "^CNXFMCG", name: "Nifty FMCG" },
  { symbol: "^CNXAUTO", name: "Nifty Auto" },
];

const OptionsSelector = ({ onSelectOption }: OptionsSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<'share' | 'index'>('share');

  const handleSelect = (symbol: string, name: string) => {
    onSelectOption(symbol, name, activeTab);
  };

  const handleSearch = () => {
    if (searchTerm.trim()) {
      onSelectOption(searchTerm.toUpperCase(), searchTerm.toUpperCase(), activeTab);
    }
  };

  return (
    <div id="options-selector" className="container mx-auto px-4 py-12">
      <Card className="p-6 md:p-8 backdrop-blur-sm bg-card/50 border-primary/20">
        <Tabs defaultValue="share" onValueChange={(v) => setActiveTab(v as 'share' | 'index')}>
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="share" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Shares
            </TabsTrigger>
            <TabsTrigger value="index" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Indices
            </TabsTrigger>
          </TabsList>

          <div className="mb-8">
            <div className="flex gap-2">
              <Input
                placeholder={`Search ${activeTab === 'share' ? 'share' : 'index'} symbol...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} className="gradient-primary">
                <Search className="h-4 w-4 mr-2" />
                Analyze
              </Button>
            </div>
          </div>

          <TabsContent value="share" className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">Popular Shares for Options Trading</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {popularShares.map((stock) => (
                <Card
                  key={stock.symbol}
                  className="p-4 cursor-pointer hover:border-primary transition-all hover:shadow-lg hover:scale-105"
                  onClick={() => handleSelect(stock.symbol, stock.name)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-foreground">{stock.symbol}</h4>
                      <p className="text-sm text-muted-foreground">{stock.name}</p>
                    </div>
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="index" className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">Major Indian Indices</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {indianIndices.map((index) => (
                <Card
                  key={index.symbol}
                  className="p-4 cursor-pointer hover:border-primary transition-all hover:shadow-lg hover:scale-105"
                  onClick={() => handleSelect(index.symbol, index.name)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-foreground">{index.name}</h4>
                      <p className="text-sm text-muted-foreground">{index.symbol}</p>
                    </div>
                    <BarChart3 className="h-5 w-5 text-primary" />
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default OptionsSelector;
