import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export function UpstoxAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please login first');
        return;
      }

      // Get authorization URL
      const { data, error } = await supabase.functions.invoke('upstox-auth', {
        body: { action: 'getAuthUrl' }
      });

      if (error) throw error;

      // Open Upstox authorization in new window
      const authWindow = window.open(
        data.authUrl,
        'Upstox Authorization',
        'width=600,height=700'
      );

      // Listen for authorization code
      const handleMessage = async (event: MessageEvent) => {
        if (event.data.type === 'upstox-auth') {
          const code = event.data.code;
          
          // Exchange code for token
          const { error: tokenError } = await supabase.functions.invoke('upstox-auth', {
            body: { 
              action: 'exchangeToken',
              code,
              userId: user.id
            }
          });

          if (tokenError) {
            toast.error('Failed to connect Upstox');
            console.error(tokenError);
          } else {
            setIsConnected(true);
            toast.success('Upstox connected! You can now get live option data.');
          }

          authWindow?.close();
          window.removeEventListener('message', handleMessage);
        }
      };

      window.addEventListener('message', handleMessage);

    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Failed to connect Upstox');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-6 mb-6 border-primary/20">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold mb-1">
            {isConnected ? '✓ Upstox Connected' : 'Connect Upstox for Live Data'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isConnected 
              ? 'Getting live premiums, strikes, and Greeks from market'
              : 'Connect your Upstox account to get real-time option chain data'
            }
          </p>
        </div>
        <Button 
          onClick={handleConnect}
          disabled={isLoading || isConnected}
          variant={isConnected ? "outline" : "default"}
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isConnected ? 'Connected' : 'Connect Upstox'}
        </Button>
      </div>
    </Card>
  );
}
