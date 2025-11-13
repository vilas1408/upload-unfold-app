import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import StockSelector from "@/components/StockSelector";
import PredictionDisplay from "@/components/PredictionDisplay";
import Footer from "@/components/Footer";

const Index = () => {
  const { toast } = useToast();
  const [selectedStock, setSelectedStock] = useState<{ symbol: string; name: string } | null>(null);
  const [prediction, setPrediction] = useState<any | null>(null);
  const [historicalData, setHistoricalData] = useState<any[] | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelectStock = async (symbol: string, name: string) => {
    setSelectedStock({ symbol, name });
    setIsLoading(true);
    setPrediction(null);

    try {
      const { data, error } = await supabase.functions.invoke('predict-stock', {
        body: { symbol, companyName: name }
      });

      // Check if data contains an error message (from 402/429 responses)
      if (data && !data.success && data.error) {
        throw new Error(data.error);
      }

      if (error) throw error;

      if (data.success) {
        setPrediction(data.prediction);
        setHistoricalData(data.historicalData);
        setIsCached(data.cached || false);
        
        toast({
          title: "Prediction Generated",
          description: `Next-day prediction for ${name} is ready! ${data.cached ? '(Using today\'s cached prediction)' : ''}`,
        });

        // Scroll to prediction
        setTimeout(() => {
          document.getElementById('prediction')?.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
          });
        }, 100);
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
      {isLoading && (
        <div className="text-center py-20">
          <p className="text-xl text-muted-foreground">Analyzing 30 days of data and generating AI prediction...</p>
        </div>
      )}
      {selectedStock && prediction && historicalData && (
        <PredictionDisplay 
          stock={selectedStock} 
          prediction={prediction}
          historicalData={historicalData}
          isCached={isCached}
        />
      )}
      <Footer />
    </div>
  );
};

export default Index;
