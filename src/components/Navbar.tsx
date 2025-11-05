import { TrendingUp } from "lucide-react";
import { Button } from "./ui/button";
import { Link, useLocation } from "react-router-dom";

const Navbar = () => {
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  
  return (
    <nav className="fixed top-0 w-full z-50 glass-strong border-b border-border">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <TrendingUp className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold text-gradient">StockPredictor</span>
        </Link>
        
        <div className="hidden md:flex items-center gap-6">
          <Link to="/" className="text-foreground hover:text-primary transition-colors">
            Home
          </Link>
          <Link to="/options" className="text-foreground hover:text-primary transition-colors">
            Options Trading
          </Link>
          {isHomePage && (
            <>
              <a href="#dashboard" className="text-foreground hover:text-primary transition-colors">
                Dashboard
              </a>
              <a href="#predictions" className="text-foreground hover:text-primary transition-colors">
                Predictions
              </a>
              <a href="#about" className="text-foreground hover:text-primary transition-colors">
                About
              </a>
            </>
          )}
        </div>

        <Button 
          className="gradient-primary"
          onClick={() => {
            if (isHomePage) {
              document.getElementById('dashboard')?.scrollIntoView({ 
                behavior: 'smooth' 
              });
            } else {
              window.location.href = '/#dashboard';
            }
          }}
        >
          Get Started
        </Button>
      </div>
    </nav>
  );
};

export default Navbar;
