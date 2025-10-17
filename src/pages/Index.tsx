import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import StockSelector from "@/components/StockSelector";
import PredictionChart from "@/components/PredictionChart";
import PredictionDisplay from "@/components/PredictionDisplay";
import Footer from "@/components/Footer";

const Index = () => {
  const { toast } = useToast();
  const [selectedStock, setSelectedStock] = useState<{ symbol: string; name: string } | null>(null);
  const [prediction, setPrediction] = useState<any>(null);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelectStock = async (symbol: string, name: string) => {
    setSelectedStock({ symbol, name });
    setIsLoading(true);
    setPrediction(null);

    try {
      const { data, error } = await supabase.functions.invoke('predict-stock', {
        body: { symbol, companyName: name }
      });

      if (error) throw error;

      if (data.success) {
        setPrediction(data.prediction);
        setHistoricalData(data.historicalData);
        
        // Scroll to results
        setTimeout(() => {
          const resultsSection = document.getElementById('prediction-results');
          resultsSection?.scrollIntoView({ behavior: 'smooth' });
        }, 100);

        toast({
          title: "Prediction Generated",
          description: `Successfully predicted prices for ${name}`,
        });
      } else {
        throw new Error(data.error || 'Prediction failed');
      }
    } catch (error: any) {
      console.error('Prediction error:', error);
      toast({
        title: "Prediction Failed",
        description: error.message || "Failed to generate prediction. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <StockSelector onSelectStock={handleSelectStock} />
      {(prediction || isLoading) && (
        <PredictionDisplay 
          stockSymbol={selectedStock?.symbol || ""}
          stockName={selectedStock?.name || ""}
          prediction={prediction}
          historicalData={historicalData}
          isLoading={isLoading}
        />
      )}
      <PredictionChart />
      <Footer />
    </div>
  );
};

export default Index;
