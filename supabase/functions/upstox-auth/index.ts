import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, code, userId } = await req.json();
    
    const UPSTOX_API_KEY = Deno.env.get('UPSTOX_API_KEY');
    const UPSTOX_API_SECRET = Deno.env.get('UPSTOX_API_SECRET');
    
    if (!UPSTOX_API_KEY || !UPSTOX_API_SECRET) {
      throw new Error('Upstox API credentials not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (action === 'getAuthUrl') {
      // Generate authorization URL
      const redirectUri = `${supabaseUrl}/functions/v1/upstox-auth`;
      const authUrl = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${UPSTOX_API_KEY}&redirect_uri=${encodeURIComponent(redirectUri)}`;
      
      return new Response(
        JSON.stringify({ success: true, authUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'exchangeToken' && code && userId) {
      // Exchange authorization code for access token
      const redirectUri = `${supabaseUrl}/functions/v1/upstox-auth`;
      
      const tokenResponse = await fetch('https://api.upstox.com/v2/login/authorization/token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code: code,
          client_id: UPSTOX_API_KEY,
          client_secret: UPSTOX_API_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        }).toString()
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        console.error('Upstox token exchange failed:', error);
        throw new Error('Failed to exchange authorization code');
      }

      const tokenData = await tokenResponse.json();
      
      // Calculate token expiry (typically 24 hours)
      const expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + 24);
      
      // Store tokens in database
      const { error: dbError } = await supabase
        .from('upstox_tokens')
        .upsert({
          user_id: userId,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || null,
          token_expiry: expiryDate.toISOString()
        });

      if (dbError) {
        console.error('Database error:', dbError);
        throw new Error('Failed to store token');
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Token stored successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action or missing parameters');

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
