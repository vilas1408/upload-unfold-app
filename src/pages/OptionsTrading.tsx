import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import OptionsSelector from "@/components/OptionsSelector";
import OptionsPredictionDisplay from "@/components/OptionsPredictionDisplay";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link2 } from "lucide-react";

const OptionsTrading = () => {
  const { toast } = useToast();
  const [selectedOption, setSelectedOption] = useState<{
    symbol: string;
    name: string;
    type: 'share' | 'index';
  } | null>(null);
  const [prediction, setPrediction] = useState<any | null>(null);
  const [historicalData, setHistoricalData] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    checkUpstoxConnection();
    
    // Handle OAuth callback
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    
    if (code && userId) {
      handleOAuthCallback(code);
    }
  }, [userId]);

  const checkUpstoxConnection = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setUserId(null);
        setIsConnected(false);
        return;
      }

      setUserId(user.id);

      const { data, error } = await supabase
        .from('upstox_tokens')
        .select('token_expiry')
        .eq('user_id', user.id)
        .single();

      if (!error && data) {
        const expiry = new Date(data.token_expiry);
        setIsConnected(expiry > new Date());
      } else {
        setIsConnected(false);
      }
    } catch (error) {
      console.error('Error checking Upstox connection:', error);
      setIsConnected(false);
    }
  };

  const handleConnectUpstox = () => {
    const apiKey = import.meta.env.VITE_UPSTOX_API_KEY || 'YOUR_UPSTOX_API_KEY';
    const redirectUri = `${window.location.origin}/options`;
    const authUrl = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${apiKey}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    
    window.location.href = authUrl;
  };

  const handleOAuthCallback = async (code: string) => {
    if (!userId) return;

    try {
      const { data, error } = await supabase.functions.invoke('upstox-oauth-callback', {
        body: { code, userId }
      });

      if (error) throw error;

      if (data.success) {
        setIsConnected(true);
        toast({
          title: "Connected to Upstox",
          description: "You can now fetch live market data",
        });
        
        // Clear URL params
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch (error: any) {
      console.error('OAuth callback error:', error);
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect to Upstox",
        variant: "destructive",
      });
    }
  };

  const handleSelectOption = async (symbol: string, name: string, type: 'share' | 'index') => {
    if (!isConnected || !userId) {
      toast({
        title: "Connect Upstox First",
        description: "Please connect your Upstox account to fetch live data",
        variant: "destructive",
      });
      return;
    }

    setSelectedOption({ symbol, name, type });
    setIsLoading(true);
    setPrediction(null);

    try {
      const { data, error } = await supabase.functions.invoke('predict-options', {
        body: { symbol, name, type, userId }
      });

      if (error) throw error;

      if (data.error === 'UPSTOX_NOT_CONNECTED' || data.error === 'TOKEN_EXPIRED') {
        setIsConnected(false);
        toast({
          title: "Reconnect Required",
          description: data.message,
          variant: "destructive",
        });
        return;
      }

      if (data.success) {
        setPrediction(data.prediction);
        setHistoricalData(data.historicalData);
        
        toast({
          title: "Options Prediction Generated",
          description: `Live analysis for ${name} is ready!`,
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
            Live options trading predictions using real-time Upstox market data
          </p>
        </div>

        {!isConnected && (
          <Card className="max-w-2xl mx-auto p-8 mb-8 text-center bg-accent/50">
            <Link2 className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h2 className="text-2xl font-bold mb-3">Connect Upstox</h2>
            <p className="text-muted-foreground mb-6">
              To access live market data and accurate options predictions, connect your Upstox account
            </p>
            <Button onClick={handleConnectUpstox} size="lg" className="px-8">
              Connect Upstox Account
            </Button>
          </Card>
        )}

        {isConnected && (
          <>
            <OptionsSelector onSelectOption={handleSelectOption} />
            
            {isLoading && (
              <div className="text-center py-20">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                <p className="text-xl text-muted-foreground">
                  Fetching live data and generating predictions...
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
          </>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default OptionsTrading;
