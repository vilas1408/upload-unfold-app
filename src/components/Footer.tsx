import { TrendingUp, Github, Linkedin, Twitter } from "lucide-react";

const Footer = () => {
  return (
    <footer id="about" className="bg-background/50 border-t border-border py-12 px-4">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold text-gradient">StockPredictor</span>
            </div>
            <p className="text-muted-foreground mb-4">
              Advanced AI-powered stock price prediction platform for Nifty 50 companies.
              Built with machine learning to help you make informed investment decisions.
            </p>
            <div className="flex gap-4">
              <a href="https://github.com/vilas1408/Stock_predictor" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                <Github className="h-5 w-5" />
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                <Linkedin className="h-5 w-5" />
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                <Twitter className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold mb-4 text-foreground">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <a href="#home" className="text-muted-foreground hover:text-primary transition-colors">
                  Home
                </a>
              </li>
              <li>
                <a href="#dashboard" className="text-muted-foreground hover:text-primary transition-colors">
                  Dashboard
                </a>
              </li>
              <li>
                <a href="#predictions" className="text-muted-foreground hover:text-primary transition-colors">
                  Predictions
                </a>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-semibold mb-4 text-foreground">Resources</h3>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  Documentation
                </a>
              </li>
              <li>
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  API
                </a>
              </li>
              <li>
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  Support
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-border pt-8 text-center text-muted-foreground">
          <p>© 2025 StockPredictor. Built with AI for smarter investments.</p>
          <p className="text-sm mt-2">
            Disclaimer: Predictions are for informational purposes only. Past performance does not guarantee future results.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
