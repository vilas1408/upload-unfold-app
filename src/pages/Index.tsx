import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import StockSelector from "@/components/StockSelector";
import PredictionChart from "@/components/PredictionChart";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <StockSelector />
      <PredictionChart />
      <Footer />
    </div>
  );
};

export default Index;
