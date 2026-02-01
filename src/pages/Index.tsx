import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import StockSelector from "@/components/StockSelector";
import PredictionDisplay from "@/components/PredictionDisplay";
import Footer from "@/components/Footer";

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedStock, setSelectedStock] = useState<{ symbol: string; name: string } | null>(null);
  const [prediction, setPrediction] = useState<any | null>(null);
  const [historicalData, setHistoricalData] = useState<any[] | null>(null);
  const [marketContext, setMarketContext] = useState<any | null>(null);
  const [fundamentals, setFundamentals] = useState<any | null>(null);
  const [derivatives, setDerivatives] = useState<any | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if user is logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSelectStock = async (symbol: string, name: string) => {
    setSelectedStock({ symbol, name });
    setIsLoading(true);
    setPrediction(null);
    setMarketContext(null);
    setFundamentals(null);
    setDerivatives(null);

    try {
      // Fetch all data in parallel
      const [predictionResult, marketResult, fundamentalsResult, derivativesResult] = await Promise.all([
        supabase.functions.invoke('predict-stock', {
          body: { symbol, companyName: name }
        }),
        supabase.functions.invoke('fetch-india-market-context', {
          body: {}
        }),
        supabase.functions.invoke('fetch-stock-fundamentals', {
          body: { symbol, companyName: name }
        }),
        supabase.functions.invoke('fetch-stock-derivatives', {
          body: { symbol, currentPrice: null }
        }),
      ]);

      // Handle prediction result
      if (predictionResult.data && !predictionResult.data.success && predictionResult.data.error) {
        throw new Error(predictionResult.data.error);
      }

      if (predictionResult.error) throw predictionResult.error;

      if (predictionResult.data?.success) {
        setPrediction(predictionResult.data.prediction);
        setHistoricalData(predictionResult.data.historicalData);
        setIsCached(predictionResult.data.cached || false);

        // Set market context
        if (marketResult.data?.success) {
          setMarketContext(marketResult.data.data);
        }

        // Set fundamentals
        if (fundamentalsResult.data?.success) {
          setFundamentals(fundamentalsResult.data.data);
        }

        // Fetch derivatives with current price now that we have it
        if (predictionResult.data.prediction?.technicals?.currentPrice) {
          const derivativesWithPrice = await supabase.functions.invoke('fetch-stock-derivatives', {
            body: { 
              symbol, 
              currentPrice: predictionResult.data.prediction.technicals.currentPrice 
            }
          });
          if (derivativesWithPrice.data?.success) {
            setDerivatives(derivativesWithPrice.data.data);
          }
        } else if (derivativesResult.data?.success) {
          setDerivatives(derivativesResult.data.data);
        }
        
        toast({
          title: "Research Report Generated",
          description: `Professional analysis for ${name} is ready! ${predictionResult.data.cached ? '(Using today\'s cached prediction)' : ''}`,
        });

        // Scroll to prediction
        setTimeout(() => {
          document.getElementById('prediction')?.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
          });
        }, 100);
      } else {
        throw new Error(predictionResult.data?.error || 'Prediction failed');
      }
    } catch (error: any) {
      console.error('Prediction error:', error);
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to generate research report. Please try again.",
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
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-xl text-muted-foreground">Generating professional research report...</p>
          <p className="text-sm text-muted-foreground mt-2">Analyzing 100 days of data, market context, and news sentiment</p>
        </div>
      )}
      {selectedStock && prediction && historicalData && (
        <PredictionDisplay 
          stock={selectedStock} 
          prediction={prediction}
          historicalData={historicalData}
          isCached={isCached}
          marketContext={marketContext}
          fundamentals={fundamentals}
          derivatives={derivatives}
        />
      )}
      <Footer />
    </div>
  );
};

export default Index;
