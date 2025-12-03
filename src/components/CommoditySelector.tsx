import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Gem, Fuel, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CommoditySelectorProps {
  onSelectCommodity: (symbol: string, name: string) => void;
}

const metals = [
  { symbol: "GOLD", name: "Gold", lotSize: "1 kg", margin: "~₹5.5L" },
  { symbol: "GOLDM", name: "Gold Mini", lotSize: "100 gm", margin: "~₹55K" },
  { symbol: "SILVER", name: "Silver", lotSize: "30 kg", margin: "~₹3L" },
  { symbol: "SILVERM", name: "Silver Mini", lotSize: "5 kg", margin: "~₹50K" },
  { symbol: "COPPER", name: "Copper", lotSize: "2500 kg", margin: "~₹1.8L" },
];

const energy = [
  { symbol: "CRUDEOIL", name: "Crude Oil", lotSize: "100 barrels", margin: "~₹2L" },
  { symbol: "NATURALGAS", name: "Natural Gas", lotSize: "1250 mmBtu", margin: "~₹70K" },
];

const CommoditySelector = ({ onSelectCommodity }: CommoditySelectorProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<'metals' | 'energy'>('metals');

  const handleSelect = (symbol: string, name: string) => {
    onSelectCommodity(symbol, name);
  };

  const handleSearch = () => {
    if (searchTerm.trim()) {
      onSelectCommodity(searchTerm.toUpperCase(), searchTerm.toUpperCase());
    }
  };

  return (
    <div id="commodity-selector" className="container mx-auto px-4 py-12">
      <Card className="p-6 md:p-8 backdrop-blur-sm bg-card/50 border-primary/20">
        {/* MCX Trading Hours Banner */}
        <div className="mb-6 p-4 bg-primary/10 rounded-lg border border-primary/20 flex items-center gap-3">
          <Clock className="h-5 w-5 text-primary" />
          <div>
            <p className="font-semibold text-foreground">MCX Trading Hours</p>
            <p className="text-sm text-muted-foreground">9:00 AM - 11:30 PM IST (Mon-Fri) | Extended hours for global market correlation</p>
          </div>
        </div>

        <Tabs defaultValue="metals" onValueChange={(v) => setActiveTab(v as 'metals' | 'energy')}>
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="metals" className="flex items-center gap-2">
              <Gem className="h-4 w-4" />
              Metals
            </TabsTrigger>
            <TabsTrigger value="energy" className="flex items-center gap-2">
              <Fuel className="h-4 w-4" />
              Energy
            </TabsTrigger>
          </TabsList>

          <div className="mb-8">
            <div className="flex gap-2">
              <Input
                placeholder={`Search ${activeTab === 'metals' ? 'metal' : 'energy'} commodity...`}
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

          <TabsContent value="metals" className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">Precious & Base Metals</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {metals.map((commodity) => (
                <Card
                  key={commodity.symbol}
                  className="p-4 cursor-pointer hover:border-primary transition-all hover:shadow-lg hover:scale-105"
                  onClick={() => handleSelect(commodity.symbol, commodity.name)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-foreground">{commodity.symbol}</h4>
                      <p className="text-sm text-muted-foreground">{commodity.name}</p>
                    </div>
                    <Gem className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs">
                      Lot: {commodity.lotSize}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {commodity.margin}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="energy" className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">Energy Commodities</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {energy.map((commodity) => (
                <Card
                  key={commodity.symbol}
                  className="p-4 cursor-pointer hover:border-primary transition-all hover:shadow-lg hover:scale-105"
                  onClick={() => handleSelect(commodity.symbol, commodity.name)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-foreground">{commodity.symbol}</h4>
                      <p className="text-sm text-muted-foreground">{commodity.name}</p>
                    </div>
                    <Fuel className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs">
                      Lot: {commodity.lotSize}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {commodity.margin}
                    </Badge>
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

export default CommoditySelector;
