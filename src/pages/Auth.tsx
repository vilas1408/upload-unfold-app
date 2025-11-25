import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, Mail, Check } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [emailVerificationPending, setEmailVerificationPending] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        // Check if this is fresh email verification
        if (session.user.confirmed_at) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('mobile_number')
            .eq('id', session.user.id)
            .single();
          
          // If profile hasn't been updated yet, update it now
          if (!profile?.mobile_number && session.user.user_metadata?.mobile_number) {
            await updateProfileAndRequestApproval(session.user.id, session.user.user_metadata);
          } else {
            navigate("/");
          }
        } else {
          // Email not verified yet
          setEmailVerificationPending(true);
        }
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        if (session.user.confirmed_at) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('mobile_number')
            .eq('id', session.user.id)
            .single();
          
          if (!profile?.mobile_number && session.user.user_metadata?.mobile_number) {
            await updateProfileAndRequestApproval(session.user.id, session.user.user_metadata);
          } else {
            navigate("/");
          }
        } else {
          setEmailVerificationPending(true);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast({
            title: "Login failed",
            description: "Invalid email or password. Please try again.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Login failed",
            description: error.message,
            variant: "destructive",
          });
        }
      } else if (data.user) {
        // Check if user is approved
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("is_approved")
          .eq("id", data.user.id)
          .single();

        if (profileError) {
          console.error("Error checking approval status:", profileError);
        } else if (!profile?.is_approved) {
          // Sign out if not approved
          await supabase.auth.signOut();
          toast({
            title: "Account pending approval",
            description: "Your account is awaiting admin approval. You'll receive an email once approved.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        toast({
          title: "Welcome back!",
          description: "You've successfully logged in.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfileAndRequestApproval = async (userId: string, metadata: any) => {
    try {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .single();

      const isAdmin = !!roleData;
      
      const mobileFromMetadata = metadata?.mobile_number;
      const dobFromMetadata = metadata?.date_of_birth;
      
      // Update profile with additional info
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          mobile_number: mobileFromMetadata,
          date_of_birth: dobFromMetadata,
          is_approved: isAdmin,
          approved_at: isAdmin ? new Date().toISOString() : null,
        })
        .eq("id", userId);

      if (updateError) {
        console.error("Failed to update profile:", updateError);
        toast({
          title: "Error",
          description: "Failed to update profile. Please contact support.",
          variant: "destructive",
        });
        throw updateError;
      }

      if (isAdmin) {
        toast({
          title: "Welcome Admin!",
          description: "Your account has been automatically approved.",
        });
        navigate("/");
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        
        // Send approval request email to admin
        const { error: approvalError } = await supabase.functions.invoke("send-approval-request", {
          body: {
            email: user?.email,
            mobile_number: mobileFromMetadata,
            date_of_birth: dobFromMetadata,
            user_id: userId,
          },
        });

        if (approvalError) {
          console.error("Failed to send approval request:", approvalError);
          toast({
            title: "Warning",
            description: "Profile updated but admin notification failed. Please contact support.",
            variant: "destructive",
          });
        }

        // Sign out regular users
        await supabase.auth.signOut();

        toast({
          title: "Email verified!",
          description: "Your account is pending admin approval. You'll receive an email once approved.",
        });
        
        setEmailVerificationPending(false);
      }
    } catch (error) {
      console.error("updateProfileAndRequestApproval failed:", error);
      toast({
        title: "Error",
        description: "Failed to complete registration. Please contact support.",
        variant: "destructive",
      });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (signupPassword !== confirmPassword) {
      toast({
        title: "Password mismatch",
        description: "Passwords do not match. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (signupPassword.length < 6) {
      toast({
        title: "Weak password",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    if (!mobileNumber || !dateOfBirth) {
      toast({
        title: "Missing information",
        description: "Please provide your mobile number and date of birth.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            mobile_number: mobileNumber,
            date_of_birth: dateOfBirth,
          }
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast({
            title: "Account exists",
            description: "This email is already registered. Please login instead.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Signup failed",
            description: error.message,
            variant: "destructive",
          });
        }
      } else if (data.user) {
        // Re-fetch user to get actual confirmation status (handles auto-confirm)
        const { data: userData } = await supabase.auth.getUser();
        
        if (userData.user?.confirmed_at || userData.user?.email_confirmed_at) {
          // Email already confirmed (auto-confirm enabled)
          console.log("Email auto-confirmed, updating profile and requesting approval");
          await updateProfileAndRequestApproval(data.user.id, data.user.user_metadata);
        } else {
          // Email verification required
          setEmailVerificationPending(true);
          toast({
            title: "Verify your email",
            description: `We've sent a verification link to ${signupEmail}. Please check your inbox and click the link to complete registration.`,
          });
        }

        // Clear form
        setSignupEmail("");
        setSignupPassword("");
        setConfirmPassword("");
        setMobileNumber("");
        setDateOfBirth("");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      await supabase.auth.resend({
        type: 'signup',
        email: user.email
      });
      toast({
        title: "Verification email sent",
        description: "Please check your inbox and spam folder.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {emailVerificationPending && (
          <Alert>
            <Mail className="h-4 w-4" />
            <AlertTitle>Email Verification Required</AlertTitle>
            <AlertDescription>
              Please check your email and click the verification link to complete your registration.
              <Button 
                variant="link" 
                onClick={handleResendVerification}
                className="p-0 h-auto ml-1"
              >
                Resend verification email
              </Button>
            </AlertDescription>
          </Alert>
        )}
        <Card className="w-full">
        <CardHeader className="space-y-1 flex flex-col items-center">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-8 w-8 text-primary" />
            <CardTitle className="text-2xl font-bold">StockPredict AI</CardTitle>
          </div>
          <CardDescription>
            Sign in to access AI-powered stock predictions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@example.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Logging in..." : "Login"}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobile-number">Mobile Number</Label>
                  <Input
                    id="mobile-number"
                    type="tel"
                    placeholder="+91 1234567890"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date-of-birth">Date of Birth</Label>
                  <Input
                    id="date-of-birth"
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                
                {/* Plan Information */}
                <div className="space-y-3 pt-4 border-t">
                  <Label className="text-base">Your Plan</Label>
                  <Card className="border-2 border-primary bg-primary/5">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">Free Plan</CardTitle>
                        <Badge>Default</Badge>
                      </div>
                      <CardDescription>Included with your account</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="text-sm space-y-2">
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-primary" />
                          <span><strong>3 predictions per day</strong></span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-primary" />
                          <span>News sentiment analysis</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-primary" />
                          <span>Technical indicators (RSI, MACD, etc.)</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-primary" />
                          <span>Greeks analysis</span>
                        </li>
                      </ul>
                    </CardContent>
                  </Card>
                  
                  <Card className="border opacity-60">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg text-muted-foreground">Premium Plan</CardTitle>
                        <Badge variant="outline">Coming Soon</Badge>
                      </div>
                      <CardDescription>For professional traders</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="text-sm space-y-2 text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4" />
                          <span><strong>Unlimited predictions</strong></span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4" />
                          <span>Real-time alerts</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4" />
                          <span>Advanced backtesting</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4" />
                          <span>Priority support</span>
                        </li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>
                
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Creating account..." : "Sign Up"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
