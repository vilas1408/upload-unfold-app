import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import OptionsSelector from "@/components/OptionsSelector";
import OptionsPredictionDisplay from "@/components/OptionsPredictionDisplay";

const OptionsTrading = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedOption, setSelectedOption] = useState<{
    symbol: string;
    name: string;
    type: 'share' | 'index';
  } | null>(null);
  const [prediction, setPrediction] = useState<any | null>(null);
  const [historicalData, setHistoricalData] = useState<any[] | null>(null);
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

  const handleSelectOption = async (symbol: string, name: string, type: 'share' | 'index') => {
    setSelectedOption({ symbol, name, type });
    setIsLoading(true);
    setPrediction(null);

    try {
      const { data, error } = await supabase.functions.invoke('predict-options', {
        body: { symbol, name, type }
      });

      // Check if data contains an error message (from 402/429 responses)
      if (data && !data.success && data.error) {
        throw new Error(data.error);
      }

      if (error) throw error;

      if (data.success) {
        setPrediction(data.prediction);
        setHistoricalData(data.historicalData);
        
        toast({
          title: "Options Prediction Generated",
          description: `Options analysis for ${name} is ready!`,
        });

        setTimeout(() => {
          document.getElementById('options-prediction')?.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
          });
        }, 100);
      } else {
        throw new Error(data.error || 'Options prediction failed');
      }
    } catch (error: any) {
      console.error('Options prediction error:', error);
      toast({
        title: "Prediction Failed",
        description: error.message || "Failed to generate options prediction. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 gradient-text">
            Options Trading Predictions
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Advanced AI-powered options trading predictions for shares and indexes with comprehensive technical analysis
          </p>
        </div>
        
        <OptionsSelector onSelectOption={handleSelectOption} />
        
        {isLoading && (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            <p className="text-xl text-muted-foreground">
              Analyzing options data and generating predictions...
            </p>
          </div>
        )}
        
        {selectedOption && prediction && historicalData && (
          <OptionsPredictionDisplay 
            option={selectedOption} 
            prediction={prediction}
            historicalData={historicalData}
          />
        )}
      </div>
      <Footer />
    </div>
  );
};

export default OptionsTrading;
