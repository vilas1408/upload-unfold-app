import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AccuracyDashboard from "@/components/AccuracyDashboard";
import OptionsSelector from "@/components/OptionsSelector";
import OptionsPredictionDisplay from "@/components/OptionsPredictionDisplay";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";

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
  const [dataSource, setDataSource] = useState<'NSE_LIVE' | 'AI_ESTIMATED' | null>(null);
  const [realPremiums, setRealPremiums] = useState<{ callPremium: number; putPremium: number; callIV?: number; putIV?: number } | null>(null);
  const [expiryInfo, setExpiryInfo] = useState<any | null>(null);
  const [technicalAnalysis, setTechnicalAnalysis] = useState<any | null>(null);
  const [ivAnalysis, setIvAnalysis] = useState<any | null>(null);
  const [userPlan, setUserPlan] = useState<{
    plan: string;
    daily_limit: number;
    used_today: number;
  } | null>(null);

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

  useEffect(() => {
    const fetchUserQuota = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Get plan
      const { data: planData } = await supabase
        .from('user_plans')
        .select('plan, daily_prediction_limit')
        .eq('user_id', user.id)
        .single();
      
      // Count today's predictions (IST timezone)
      const istNow = new Date();
      const todayIST = istNow.toISOString().split('T')[0];
      
      const { count } = await supabase
        .from('prediction_tracking')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('predicted_at', `${todayIST}T00:00:00`)
        .lt('predicted_at', `${todayIST}T23:59:59`);
      
      setUserPlan({
        plan: planData?.plan || 'free',
        daily_limit: planData?.daily_prediction_limit || 3,
        used_today: count || 0
      });
    };
    
    fetchUserQuota();
  }, [navigate, prediction]); // Refresh after prediction

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
        setDataSource(data.dataSource || 'AI_ESTIMATED');
        setRealPremiums(data.realPremiums || null);
        setExpiryInfo(data.expiryInfo || null);
        setTechnicalAnalysis(data.technicalAnalysis || null);
        setIvAnalysis(data.ivAnalysis || null);
        
        toast({
          title: "Options Research Report Generated",
          description: `${data.dataSource === 'NSE_LIVE' ? '🟢 LIVE NSE DATA:' : '🔮 AI Estimate:'} Professional derivatives analysis for ${name} is ready!`,
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
            Get live option chain data with real premiums, Greeks, and market depth
          </p>
        </div>
        
        <AccuracyDashboard />
        
        {/* Quota Banner */}
        {userPlan && userPlan.plan === 'free' && (
          <Card className={`mb-6 ${userPlan.used_today >= userPlan.daily_limit ? 'border-destructive' : 'border-orange-500'}`}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Daily Predictions Quota
                </span>
                <Badge 
                  variant={userPlan.used_today >= userPlan.daily_limit ? "destructive" : "default"}
                  className="text-base px-3 py-1"
                >
                  {userPlan.used_today} / {userPlan.daily_limit} used today
                </Badge>
              </CardTitle>
              <CardDescription>
                {userPlan.used_today >= userPlan.daily_limit ? (
                  <span className="text-destructive font-medium">
                    ⚠️ You've reached your daily limit of {userPlan.daily_limit} predictions. 
                    Your quota resets at midnight IST. Upgrade to Premium for unlimited predictions.
                  </span>
                ) : (
                  <span>
                    You have <strong>{userPlan.daily_limit - userPlan.used_today} predictions</strong> remaining today. 
                    Quota resets daily at midnight IST.
                  </span>
                )}
              </CardDescription>
            </CardHeader>
          </Card>
        )}
        
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
          <>
            {dataSource === 'NSE_LIVE' ? (
              <div className="text-center mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-green-400 font-semibold flex items-center justify-center gap-2">
                  <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></span>
                  LIVE NSE DATA: Real-time premiums from National Stock Exchange
                </p>
              </div>
            ) : (
              <div className="text-center mb-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-yellow-400 font-semibold">
                  🔮 AI ESTIMATED: Premiums are calculated estimates{expiryInfo && ` with ${expiryInfo.daysToExpiry} days time value`} - verify with your broker before trading
                </p>
              </div>
            )}
            <OptionsPredictionDisplay 
              option={selectedOption} 
              prediction={prediction}
              historicalData={historicalData}
              dataSource={dataSource}
              realPremiums={realPremiums}
              expiryInfo={expiryInfo}
              technicalAnalysis={technicalAnalysis}
              ivAnalysis={ivAnalysis}
            />
          </>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default OptionsTrading;
