import { Button } from "./ui/button";
import { TrendingUp, BarChart3, LineChart } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";

const Hero = () => {
  return (
    <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Background */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${heroBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.3
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background/90 to-background z-0" />
      
      {/* Content */}
      <div className="container mx-auto px-4 z-10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="animate-float mb-8">
            <h1 className="text-5xl md:text-7xl font-bold mb-6">
              Predict Stock Prices with{" "}
              <span className="text-gradient">AI Precision</span>
            </h1>
          </div>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto">
            Advanced machine learning algorithms analyze market trends and predict 
            future stock prices for Nifty 50 companies with unprecedented accuracy.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button 
              size="lg" 
              className="gradient-primary text-lg px-8 py-6 animate-glow"
              onClick={() => {
                const dashboardSection = document.getElementById('dashboard');
                dashboardSection?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Start Predicting
              <TrendingUp className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="text-lg px-8 py-6 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              onClick={() => {
                const predictionsSection = document.getElementById('predictions');
                predictionsSection?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              View Demo
              <BarChart3 className="ml-2 h-5 w-5" />
            </Button>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            <div className="glass p-6 rounded-xl hover:glass-strong transition-all duration-300">
              <TrendingUp className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Real-Time Analysis</h3>
              <p className="text-muted-foreground">
                Live market data processing with instant predictions
              </p>
            </div>
            
            <div className="glass p-6 rounded-xl hover:glass-strong transition-all duration-300">
              <LineChart className="h-12 w-12 text-success mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">ML Predictions</h3>
              <p className="text-muted-foreground">
                Advanced neural networks trained on historical data
              </p>
            </div>
            
            <div className="glass p-6 rounded-xl hover:glass-strong transition-all duration-300">
              <BarChart3 className="h-12 w-12 text-accent mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Nifty 50 Focus</h3>
              <p className="text-muted-foreground">
                Specialized predictions for India's top 50 companies
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
