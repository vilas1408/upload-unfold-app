import { TrendingUp, LogOut, Shield, Home, BarChart3, Menu, X } from "lucide-react";
import { Button } from "./ui/button";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@supabase/supabase-js";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isHomePage = location.pathname === '/';
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const isActive = (path: string) => location.pathname === path;
  
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminStatus(session.user.id);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminStatus(session.user.id);
      } else {
        setIsAdmin(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminStatus = async (userId: string) => {
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .single();

    setIsAdmin(!!roleData);
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Logged out",
        description: "You've been successfully logged out.",
      });
      navigate("/auth");
    }
  };
  
  return (
    <nav className="fixed top-0 w-full z-50 glass-strong border-b border-border">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <TrendingUp className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold text-gradient">StockPredictor</span>
        </Link>
        
        <div className="hidden md:flex items-center gap-6">
          <Link 
            to="/" 
            className={`flex items-center gap-2 transition-colors ${
              isActive('/') 
                ? 'text-primary font-semibold' 
                : 'text-foreground hover:text-primary'
            }`}
          >
            <Home className="h-4 w-4" />
            Home
          </Link>
          <Link 
            to="/options" 
            className={`flex items-center gap-2 transition-colors ${
              isActive('/options') 
                ? 'text-primary font-semibold' 
                : 'text-foreground hover:text-primary'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            Options Trading
          </Link>
          <Link 
            to="/backtesting" 
            className={`flex items-center gap-2 transition-colors ${
              isActive('/backtesting') 
                ? 'text-primary font-semibold' 
                : 'text-foreground hover:text-primary'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Backtesting
          </Link>
          {isAdmin && (
            <Link 
              to="/admin" 
              className={`flex items-center gap-2 transition-colors ${
                isActive('/admin') 
                  ? 'text-primary font-semibold' 
                  : 'text-foreground hover:text-primary'
              }`}
            >
              <Shield className="h-4 w-4" />
              Admin
            </Link>
          )}
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

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="hidden md:flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {user.email?.[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-foreground">{user.email}</span>
              </div>
              <div className="h-6 w-px bg-border hidden md:block" />
              <Button 
                variant="outline"
                onClick={handleLogout}
                className="hidden md:flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </>
          ) : (
            <Button 
              onClick={() => navigate("/auth")}
              className="hidden md:flex"
            >
              Login
            </Button>
          )}
          
          {/* Mobile Menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <nav className="flex flex-col gap-4 mt-8">
                <Link 
                  to="/" 
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive('/') 
                      ? 'bg-primary text-primary-foreground font-semibold' 
                      : 'text-foreground hover:bg-muted'
                  }`}
                >
                  <Home className="h-5 w-5" />
                  Home
                </Link>
                <Link 
                  to="/options" 
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive('/options') 
                      ? 'bg-primary text-primary-foreground font-semibold' 
                      : 'text-foreground hover:bg-muted'
                  }`}
                >
                  <TrendingUp className="h-5 w-5" />
                  Options Trading
                </Link>
                <Link 
                  to="/backtesting" 
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive('/backtesting') 
                      ? 'bg-primary text-primary-foreground font-semibold' 
                      : 'text-foreground hover:bg-muted'
                  }`}
                >
                  <BarChart3 className="h-5 w-5" />
                  Backtesting
                </Link>
                {isAdmin && (
                  <Link 
                    to="/admin" 
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive('/admin') 
                        ? 'bg-primary text-primary-foreground font-semibold' 
                        : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    <Shield className="h-5 w-5" />
                    Admin Dashboard
                  </Link>
                )}
                
                {user && (
                  <>
                    <div className="h-px bg-border my-2" />
                    <div className="flex items-center gap-3 px-4 py-2">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {user.email?.[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-foreground">{user.email}</span>
                    </div>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        handleLogout();
                        setMobileMenuOpen(false);
                      }}
                      className="mx-4 flex items-center gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </Button>
                  </>
                )}
                
                {!user && (
                  <Button 
                    onClick={() => {
                      navigate("/auth");
                      setMobileMenuOpen(false);
                    }}
                    className="mx-4"
                  >
                    Login
                  </Button>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
